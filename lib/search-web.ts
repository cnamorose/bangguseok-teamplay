import { tavily } from "@tavily/core";

// 빌드 시점(키 없음)에 터지지 않도록, 검색할 때 클라이언트를 만든다
type TavilyClient = ReturnType<typeof tavily>;
let _client: TavilyClient | null = null;
function getClient(): TavilyClient {
  if (!_client) _client = tavily({ apiKey: process.env.TAVILY_API_KEY });
  return _client;
}

export interface WebSearchResult {
  title: string;
  url: string;
  content: string; // Tavily가 추출한 페이지 내용 요약
}

/**
 * Tavily로 실제 웹 검색을 수행하고, 결과를 정제해서 반환.
 */
export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const response = await getClient().search(query, {
    searchDepth: "basic",   // basic = 1크레딧 (빠르고 저렴)
    maxResults: 5,          // 상위 5개
  });

  return response.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));
}