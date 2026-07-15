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