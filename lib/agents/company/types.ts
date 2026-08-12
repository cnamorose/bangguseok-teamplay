// 기업 분석의 출력 형태.
//
// 두 단계로 나뉜다.
//   회사 레벨(CompanyAnalysis) — 직무를 바꿔도 그대로다. Company.analysis에 저장.
//   직무 레벨(RoleAnalysis)    — 직무마다 다시 뽑는다. Application.roleAnalysis에 저장.

export interface Source {
  label: string;
  url: string;
  date: string; // 확인 못 하면 빈 문자열
}

/** 연도별로 관찰된 키워드 (흐름 전이도의 한 열) */
export interface ShiftYear {
  year: number;
  keywords: string[];
}

/** 회사가 스스로 선언한 방향 */
export interface Declared {
  text: string;
  horizon: string; // "2030년까지" 등. 모르면 빈 문자열
  date: string;
}

export interface Issue {
  date: string;
  title: string;
  source: string;
}

export interface Competitor {
  name: string;
  difference: string;
}

/** 회사가 쓰는 단어. official=true면 회사가 자기 입으로 한 말 */
export interface LanguageWord {
  word: string;
  weight: number; // 1~10
  official: boolean;
  from: string[];
}

/** ── 회사 레벨 ── */
export interface CompanyAnalysis {
  /** "이 회사는 지금 {cause} 때문에 {direction}을 강화하고 있다" */
  headline: {
    cause: string;
    direction: string;
    keywords: string[];
  };
  identity: {
    summary: string;
    customers: string;
    connect: string;
  };
  shift: {
    years: ShiftYear[];
    declared: Declared[];
    issues: Issue[];
    conclusion: string;
    connect: string;
  };
  competitors: Competitor[];
  edge: string;
  language: LanguageWord[];
  sources: Source[];
  asOf: string; // 분석 기준일 (YYYY-MM-DD)
}

/** ── 직무 레벨 ── */
export interface RoleAnalysis {
  role: string;
  /** 채용공고의 자격요건·우대사항 */
  requirements: string[];
  /** 회사의 흐름과 이 직무가 닿는 지점 */
  linkToStrategy: string;
  /** 자소서에서 짚어야 할 포인트 */
  checkpoints: string[];
  sources: Source[];
  asOf: string;
}

/** 회사마다 다르지 않으므로 매번 LLM에 뽑게 하지 않는다 */
export const CLICHES = [
  "혁신",
  "도전",
  "글로벌 리더",
  "열정",
  "소통",
  "인재 중심",
  "최고의 서비스",
  "고객 감동",
];
