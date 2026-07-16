// 화면 표시용 페르소나 카탈로그 (프론트에서 사용)
// 실제 프롬프트는 서버의 personas.ts에 있고, 여기엔 보여줄 정보만.

export interface PersonaCard {
  id: string;
  name: string;
  description: string; // 사용자에게 보여줄 짧은 설명
  emoji: string;       // 임시 아이콘 (나중에 이미지로 교체 가능)
  line: string;        // 말풍선에 띄울 대사 한 줄
}

export const PERSONA_CATALOG: Record<string, PersonaCard[]> = {
  search: [
    { id: "magnifier", name: "꼼꼼한 돋보기", description: "핵심 출처를 깊이 파고들어 정확하게", emoji: "🔍", line: "출처 하나하나, 제가 다 확인할게요." },
    { id: "map", name: "다양한 지도", description: "여러 관점을 넓게 훑어 다채롭게", emoji: "🗺️", line: "여기저기 두루 둘러보고 올게요!" },
  ],
  generate: [
    { id: "logic", name: "논리왕", description: "서론-근거-결론의 탄탄한 논증", emoji: "🧠", line: "근거 없는 주장은 그냥 못 넘어가죠." },
    { id: "story", name: "스토리텔러", description: "이야기와 비유로 몰입감 있게", emoji: "📖", line: "이 얘기, 재밌게 풀어드릴게요." },
  ],
  organize: [
    { id: "proofreader", name: "교정관", description: "문법과 문체를 매끄럽게 다듬어요", emoji: "✏️", line: "어색한 문장은 제가 다듬을게요." },
    { id: "summarizer", name: "요약 전문가", description: "핵심만 남기고 간결하게 압축해요", emoji: "📌", line: "핵심만 딱. 군더더기는 덜어냅니다." },
  ],
  visualize: [
    { id: "typewriter", name: "인간 타자기", description: "실무 보고서로 정돈해 드려요 (.docx)", emoji: "📄", line: "보고서 양식은 제게 맡기세요." },
    { id: "slideMaker", name: "슬라이드 장인", description: "발표용 슬라이드로 만들어요 (.pptx)", emoji: "📊", line: "한 장에 하나씩, 시원하게 갑니다." },
    { id: "alchemist", name: "초안 연금술사", description: "학술 논문 초안으로 빚어내요 (.docx)", emoji: "📜", line: "논문의 격식, 제대로 갖춰드리죠." },
  ],
};

export const WRITING_STYLES = [
  { id: "plain", name: "평서체", description: "~한다, ~했다 (논문·보고서용)" },
  { id: "formal", name: "합쇼체", description: "~합니다, ~습니다 (정중한 발표용)" },
  { id: "soft", name: "해요체", description: "~해요 (부드럽고 친근하게)" },
] as const;

// 단계 정보 (순서 + 라벨)
export const STAGES = [
  { key: "search", label: "서치", order: 1 },
  { key: "generate", label: "생성", order: 2 },
  { key: "organize", label: "정리", order: 3 },
  { key: "visualize", label: "시각화", order: 4 },
] as const;

