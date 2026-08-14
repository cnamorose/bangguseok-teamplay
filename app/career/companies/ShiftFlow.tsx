import { ShiftYear, Declared } from "@/lib/agents/company/types";

// 연도별 키워드 전이도. 이 화면의 주인공이다.
//
// 유지 = 앞 연도와 선으로 이어짐 / 신규 = + / 사라짐 = 취소선.
// 색만으로 뜻을 전하지 않으려고 기호를 함께 쓴다.
// 연도가 2개 미만이면 그림 대신 결론 한 줄로 폴백한다.

type Mark = "keep" | "new" | "gone";

interface Cell {
  word: string;
  mark: Mark;
}

/** 연도별 목록을 표 형태(줄 = 키워드, 칸 = 연도)로 바꾼다 */
function toRows(years: ShiftYear[]): { word: string; cells: (Cell | null)[] }[] {
  const sorted = [...years].sort((a, b) => a.year - b.year);
  const words: string[] = [];
  for (const y of sorted) {
    for (const w of y.keywords) if (!words.includes(w)) words.push(w);
  }

  return words.map((word) => {
    const has = sorted.map((y) => y.keywords.includes(word));
    const lastIndex = has.lastIndexOf(true);

    const cells = has.map((present, i): Cell | null => {
      if (present) return { word, mark: i > 0 && has[i - 1] ? "keep" : "new" };
      // 있다가 없어진 자리만 취소선으로 남긴다 (등장 전은 빈칸)
      const appearedBefore = has.slice(0, i).includes(true);
      if (appearedBefore && i > lastIndex) return { word, mark: "gone" };
      return null;
    });

    return { word, cells };
  });
}

export default function ShiftFlow({
  years,
  declared,
  conclusion,
}: {
  years: ShiftYear[];
  declared: Declared[];
  conclusion: string;
}) {
  const sorted = [...years].sort((a, b) => a.year - b.year);

  // 연도가 하나뿐이면 전이도가 의미 없다 → 결론만
  if (sorted.length < 2) {
    return conclusion ? <p className="ui-judge-body">{conclusion}</p> : null;
  }

  const rows = toRows(sorted);
  const hasPlan = declared.length > 0;
  const cols = sorted.length + (hasPlan ? 1 : 0);

  // 선언한 방향이 키워드 줄보다 많으면 빈 줄을 붙여서 다 보이게 한다
  const rowCount = Math.max(rows.length, hasPlan ? declared.length : 0);

  return (
    <div className="ui-shift">
      <div
        className="ui-shift-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(118px, 1fr))` }}
      >
        {sorted.map((y) => (
          <div key={y.year} className="ui-shift-head">
            {y.year}
          </div>
        ))}
        {hasPlan && <div className="ui-shift-head is-plan">선언한 방향</div>}

        {Array.from({ length: rowCount }, (_, r) => {
          const row = rows[r];
          const plan = declared[r];
          return (
            <div className="ui-shift-row" key={r} style={{ display: "contents" }}>
              {sorted.map((_, c) => {
                const cell = row?.cells[c] ?? null;
                return (
                  <div key={c} className="ui-shift-cell">
                    {cell && (
                      <span className={`ui-kw is-${cell.mark}`}>
                        {cell.mark === "gone" ? <del>{cell.word}</del> : cell.word}
                        {cell.mark === "new" && <b aria-label="새로 등장"> +</b>}
                      </span>
                    )}
                  </div>
                );
              })}
              {hasPlan && (
                <div className="ui-shift-cell">
                  {plan && (
                    <span className="ui-kw is-plan">
                      {plan.text}
                      {plan.horizon && <em> · {plan.horizon}</em>}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {conclusion && <p className="ui-shift-concl">{conclusion}</p>}
      <p className="ui-shift-legend">
        <span className="ui-kw is-new">
          유지·신규<b> +</b>
        </span>
        <span className="ui-kw is-gone">
          <del>빠짐</del>
        </span>
        {hasPlan && <span className="ui-kw is-plan">점선 = 회사가 선언한 것</span>}
      </p>
    </div>
  );
}
