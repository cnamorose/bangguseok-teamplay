import { LanguageWord, CLICHES } from "@/lib/agents/company/types";

// 회사가 실제로 쓰는 단어. 막대 길이 = 등장 빈도, 점 = 누가 말했나.
// ● 회사가 자기 입으로 한 말(신년사·뉴스룸·공시) — 자소서에 그대로 써도 되는 단어
// ○ 외부에서만 관찰된 말 — 기자가 붙인 표현일 수 있다

export default function LanguageBars({ words }: { words: LanguageWord[] }) {
  if (words.length === 0) return null;

  const max = Math.max(...words.map((w) => w.weight), 1);
  const sorted = [...words].sort((a, b) => b.weight - a.weight).slice(0, 8);

  return (
    <div className="tp-lang">
      {sorted.map((w, i) => (
        <div key={i} className="tp-lang-row">
          <span className="tp-lang-word">{w.word}</span>
          <span className="tp-lang-bar">
            <span
              className={`tp-lang-fill${w.official ? " is-official" : ""}`}
              style={{ width: `${Math.round((w.weight / max) * 100)}%` }}
            />
          </span>
          <span
            className="tp-lang-dot"
            title={w.official ? "회사가 직접 쓰는 말" : "외부에서만 관찰됨"}
          >
            {w.official ? "●" : "○"}
          </span>
          <span className="tp-lang-from">{w.from.join("·")}</span>
        </div>
      ))}

      <p className="tp-lang-note">
        <strong>●</strong> 회사가 직접 쓰는 말 — 자소서에 그대로 넣어도 되는 단어 ·{" "}
        <strong>○</strong> 외부에서만 관찰됨
      </p>
      <p className="tp-lang-cliche">
        피하세요 — {CLICHES.join(" · ")}
      </p>
    </div>
  );
}
