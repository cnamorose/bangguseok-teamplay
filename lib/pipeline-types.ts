// 각 단계의 출력 형태 (표준 인터페이스)

export interface SearchOutput {
  sources: string[];    // 참고 출처
  keyPoints: string[];  // 핵심 포인트 목록
}

export interface GenerateOutput {
  title: string;
  content: string;
}

export interface OrganizeOutput {
  title: string;
  content: string;
  feedback: string;  // 다듬으면서 남긴 코멘트 (나중에 비평가 루프 자리)
}

export interface VisualizeOutput {
  format: "report" | "slides" | "paper";  // 어떤 산출물인지 (파일 생성 때 구분용)
  title: string;
  sections: {
    heading: string;      // 섹션/슬라이드 제목
    content: string[];    // 내용 (문단들 or 불릿들 — 배열로 통일)
  }[];
}

// 비평가의 평가 결과
export interface CriticResult {
  pass: boolean;       // 통과 여부 (true면 더 이상 재생성 안 함)
  feedback: string;    // 개선 피드백 (재생성 시 생성에게 전달)
  comment: string;     // 대화체 코멘트 (화면에 캐릭터 대사로 보여줄 것)
}

// 채점 세부 항목 (rubric 한 줄)
export interface ScoreBreakdown {
  label: string;    // 화면 표시명 (예: "논리성")
  score: number;    // 이 항목 점수
  maxScore: number; // 이 항목 만점
}

// 개별 평가자의 평가 결과
export interface EvaluationResult {
  evaluatorId: string;
  evaluatorName: string;
  scoreLabel: string;
  score: number;
  maxScore: number;
  comment: string;
  breakdown?: ScoreBreakdown[]; // 세부 항목별 점수 (rubric)
  sources?: string[]; // 서치 평가자만: 검색한 출처
}