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
  slides: {
    heading: string;
    bullets: string[];
  }[];
}