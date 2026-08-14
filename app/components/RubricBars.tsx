// 세부 항목 점수를 막대로 보여준다. (평가 화면 / 클립보드 / 자소서 컨설팅 공용)

export interface ScoreBreakdown {
  label: string;
  score: number;
  maxScore: number;
}

export default function RubricBars({ breakdown }: { breakdown: ScoreBreakdown[] }) {
  if (breakdown.length === 0) return null;

  return (
    <div className="ui-rubric">
      {breakdown.map((b, i) => {
        const pct = b.maxScore > 0 ? Math.round((b.score / b.maxScore) * 100) : 0;
        return (
          <div key={i} className="ui-rubric-row">
            <span className="ui-rubric-label">{b.label}</span>
            <span className="ui-rubric-bar">
              <span className="ui-rubric-fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="ui-rubric-score">
              {b.score}
              <span>/{b.maxScore}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
