// 결과물(resultData)에서 평가에 넣을 "글" 본문을 뽑아낸다.
// "결과물 다운로드"와 내용을 일치시키기 위해, 다운로드가 쓰는 것과 같은
// visualize(시각화 최종 산출물)를 평문으로 펼쳐서 사용한다.
// (다운로드 문서는 visualize의 title/sections를 서식만 입혀 옮긴 것이라 텍스트 내용이 같다.)
// visualize가 없을 때만 organize → generate 순으로 대체한다.
export function extractArticleText(resultData: unknown): string {
  if (!resultData || typeof resultData !== "object") return "";
  const data = resultData as Record<string, any>;

  // 다운로드 문서와 같은 내용: 제목 + 각 섹션(제목 + 본문)을 평문으로 펼친다.
  const visualize = data.visualize;
  const sections = visualize?.sections;
  if (Array.isArray(sections) && sections.length > 0) {
    const body = sections
      .map((s: any) => {
        const lines = Array.isArray(s?.content) ? s.content.join("\n") : "";
        return s?.heading ? `${s.heading}\n${lines}` : lines;
      })
      .join("\n\n")
      .trim();
    return visualize?.title ? `${visualize.title}\n\n${body}` : body;
  }

  // 시각화 결과가 없으면 다듬은 글, 그다음 초안으로 대체.
  if (data.organize?.content) return String(data.organize.content);
  if (data.generate?.content) return String(data.generate.content);

  return "";
}
