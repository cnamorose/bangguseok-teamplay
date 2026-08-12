import { searchWeb, WebSearchResult } from "@/lib/search-web";

// 사람이 30분 동안 하는 조사를 쿼리로 옮긴 것.
// 회사명만 넣으면 언론 기사만 나오므로, 보려는 자료를 쿼리에 명시한다.
// (신년사를 두 연도로 나눠 검색하는 게 '흐름'을 뽑는 제일 싼 방법이다)

export interface SearchBundle {
  label: string;
  results: WebSearchResult[];
}

/**
 * 검색 결과를 프롬프트에 넣을 텍스트로.
 * 발행일을 앞에 붙여서, 모델이 이슈 날짜와 연도별 키워드를 '추측'이 아니라
 * 이 값에 근거해 채우게 한다. 날짜가 없는 자료는 표시하지 않는다.
 */
export function formatBundles(bundles: SearchBundle[]): string {
  return bundles
    .filter((b) => b.results.length > 0)
    .map((b) => {
      const items = b.results
        .map((r) => {
          const head = r.date ? `[${r.date}] ${r.title}` : `[날짜 미확인] ${r.title}`;
          return `- ${head}\n  URL: ${r.url}\n  내용: ${r.content}`;
        })
        .join("\n");
      return `[${b.label}]\n${items}`;
    })
    .join("\n\n");
}

/** 검색된 모든 출처 (중복 URL 제거) */
export function collectSources(bundles: SearchBundle[]) {
  const seen = new Set<string>();
  const out: { label: string; url: string; date: string }[] = [];
  for (const b of bundles) {
    for (const r of b.results) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      out.push({ label: r.title, url: r.url, date: r.date });
    }
  }
  return out;
}

// 한 쿼리가 실패해도 나머지는 살린다 (검색 하나 때문에 분석 전체가 죽지 않도록)
async function safeSearch(
  label: string,
  query: string,
  opts: { topic?: "general" | "news"; days?: number } = {}
): Promise<SearchBundle> {
  try {
    return { label, results: await searchWeb(query, opts) };
  } catch (error) {
    console.warn(`검색 실패 (${label}):`, error);
    return { label, results: [] };
  }
}

/** 회사 레벨 조사 — 직무와 무관하므로 회사당 한 번만 하면 된다 */
export async function searchCompany(name: string): Promise<SearchBundle[]> {
  const thisYear = new Date().getFullYear();
  const pastYear = thisYear - 2;

  return Promise.all([
    // 시효가 없는 것 — 일반 검색
    safeSearch("사업 구조·고객", `${name} 사업 구조 주요 고객 매출`),
    safeSearch(`${pastYear} 신년사`, `${name} ${pastYear} 신년사 전략 방향`),
    safeSearch("경쟁 환경", `${name} 경쟁사 비교 시장 점유율`),
    safeSearch("회사가 쓰는 말", `${name} 뉴스룸 기술블로그 인재상`),

    // 시효가 있는 것 — 뉴스 색인이라 발행일이 붙는다
    safeSearch(
      "최근 6개월 이슈",
      `${name} 실적 신사업 투자 조직개편`,
      { topic: "news", days: 180 }
    ),
    safeSearch(
      `${thisYear} 신년사·전략`,
      `${name} 신년사 전략 방향`,
      { topic: "news", days: 365 }
    ),
  ]);
}

/** 직무 레벨 조사 — 회사 분석을 재료로 쓰므로 이것만 새로 하면 된다 */
export async function searchRole(name: string, role: string): Promise<SearchBundle[]> {
  return Promise.all([
    safeSearch("채용공고", `${name} ${role} 채용 자격요건 우대사항`),
    safeSearch("직무 소개", `${name} ${role} 직무 하는 일`),
  ]);
}
