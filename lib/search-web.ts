import { tavily } from "@tavily/core";

// 빌드 시점(키 없음)에 터지지 않도록, 검색할 때 클라이언트를 만든다
type TavilyClient = ReturnType<typeof tavily>;
let _client: TavilyClient | null = null;
function getClient(): TavilyClient {
  if (!_client) _client = tavily({ apiKey: process.env.TAVILY_API_KEY });
  return _client;
}

// 보고서·논문 용도로는 신뢰성이 낮은 출처들 (기본 제외).
// 필요에 따라 자유롭게 추가/삭제하면 된다.
export const LOW_TRUST_DOMAINS = [
  "namu.wiki",        // 나무위키
  "tiktok.com",       // 틱톡
  "instagram.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "pinterest.com",
  "reddit.com",
  "quora.com",
  "blog.naver.com",   // 개인 블로그
  "tistory.com",
  "brunch.co.kr",
  "cafe.naver.com",
  "cafe.daum.net",
];

export interface WebSearchResult {
  title: string;
  url: string;
  content: string; // Tavily가 추출한 페이지 내용 요약
  score: number;   // 관련도 점수 (0~1)
  date: string;    // 발행일(YYYY-MM-DD). 확인 안 되면 빈 문자열
}

export interface SearchOptions {
  /** 제외할 도메인. 지정하지 않으면 LOW_TRUST_DOMAINS를 사용. */
  excludeDomains?: string[];
  /** 지정하면 이 도메인들에서만 검색 (화이트리스트 모드). */
  includeDomains?: string[];
  /** 관련도 점수가 이 값 미만인 결과는 버린다 (0~1). */
  minScore?: number;
  /**
   * "news"로 두면 뉴스 색인에서 찾고 발행일이 함께 온다.
   * 시효가 중요한 것(최근 이슈·실적)은 이걸 써야 날짜를 믿을 수 있다.
   */
  topic?: "general" | "news";
  /** topic이 "news"일 때, 최근 며칠 안의 것만 볼지 */
  days?: number;
}

/**
 * Tavily의 발행일은 "Tue, 24 Feb 2026 08:42:40 GMT" 형식으로 온다.
 * 화면·프롬프트에서 쓰기 좋게 YYYY-MM-DD로 바꾸고, 못 읽으면 빈 문자열.
 */
function toISODate(raw: string | undefined): string {
  if (!raw) return "";
  const t = Date.parse(raw);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
}

/**
 * Tavily로 실제 웹 검색을 수행하고, 결과를 정제해서 반환.
 * 기본적으로 저신뢰 도메인(LOW_TRUST_DOMAINS)은 제외한다.
 */
export async function searchWeb(
  query: string,
  opts: SearchOptions = {}
): Promise<WebSearchResult[]> {
  const response = await getClient().search(query, {
    searchDepth: "basic",   // basic = 1크레딧 (빠르고 저렴)
    maxResults: 5,          // 상위 5개
    excludeDomains: opts.excludeDomains ?? LOW_TRUST_DOMAINS,
    // includeDomains를 넘기면 해당 도메인들만 검색된다.
    ...(opts.includeDomains ? { includeDomains: opts.includeDomains } : {}),
    ...(opts.topic ? { topic: opts.topic } : {}),
    ...(opts.days ? { days: opts.days } : {}),
  });

  let results = response.results;
  if (opts.minScore != null) {
    results = results.filter((r) => r.score >= opts.minScore!);
  }

  let mapped: WebSearchResult[] = results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score,
    // 뉴스 색인에서만 안정적으로 온다. 없으면 빈 문자열로 두고,
    // 날짜가 필요한 자리(이슈·연도별 키워드)에는 쓰지 않는다.
    date: toISODate(r.publishedDate),
  }));

  // days를 줘도 그보다 오래된 게 섞여 오는 경우가 있어 한 번 더 거른다.
  // (날짜를 모르는 결과는 남긴다 — 내용은 여전히 쓸모가 있다)
  if (opts.days) {
    const cutoff = Date.now() - opts.days * 24 * 60 * 60 * 1000;
    mapped = mapped.filter((r) => !r.date || Date.parse(r.date) >= cutoff);
  }

  return mapped;
}
