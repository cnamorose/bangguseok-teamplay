// "제목 (https://...)" 형태의 출처 문자열에서 제목과 URL을 안전하게 분리.
// PDF처럼 제목에 줄바꿈이 섞이거나 URL이 문자열 끝이 아니어도 동작하도록,
// 전체 앵커 매칭 대신 URL을 어디서든 찾아서 추출한다.
export function parseSource(s: string): { title: string; url: string | null } {
  // 공백이나 ')' 를 만나기 전까지를 URL로 본다 (포맷의 감싼 괄호를 자연히 제외).
  const urlMatch = s.match(/https?:\/\/[^\s)]+/);
  if (!urlMatch) return { title: s.trim(), url: null };

  const url = urlMatch[0];
  // 원본에서 "(url)" 또는 url 자체를 걷어내 제목만 남긴다.
  const title = s.replace(`(${url})`, "").replace(url, "").trim();

  // 제목이 비면(예: PDF 제목 미상) URL을 표시 텍스트로 사용.
  return { title: title || url, url };
}
