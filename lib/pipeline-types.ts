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