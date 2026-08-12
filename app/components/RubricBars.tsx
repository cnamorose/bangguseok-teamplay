// 세부 항목 점수를 막대로 보여준다. (평가 화면 / 클립보드 / 자소서 컨설팅 공용)

export interface ScoreBreakdown {
  label: string;
  score: number;
  maxScore: number;
}

export default function RubricBars({ breakdown }: { breakdown: ScoreBreakdown[] }) {
  if (breakdown.length === 0) return null;

  return (
    <div className="tp-rubric">
      {breakdown.map((b, i) => {
        const pct = b.maxScore > 0 ? Math.round((b.score / b.maxScore) * 100) : 0;
        return (
          <div key={i} className="tp-rubric-row">
            <span className="tp-rubric-label">{b.label}</span>
            <span className="tp-rubric-bar">
              <span className="tp-rubric-fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="tp-rubric-score">
              {b.score}
              <span className="tp-rubric-max">/{b.maxScore}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
