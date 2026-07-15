import { tavily } from "@tavily/core";

const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });

export interface WebSearchResult {
  title: string;
  url: string;
  content: string; // Tavily가 추출한 페이지 내용 요약
}

/**
 * Tavily로 실제 웹 검색을 수행하고, 결과를 정제해서 반환.
 */
export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const response = await client.search(query, {
    searchDepth: "basic",   // basic = 1크레딧 (빠르고 저렴)
    maxResults: 5,          // 상위 5개
  });

  return response.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));
}