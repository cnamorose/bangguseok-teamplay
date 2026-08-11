// 아주 단순한 인메모리 rate limiter.
//
// 한 프로세스 메모리 안에서만 카운트하므로, 서버가 여러 인스턴스로
// 뜨는 배포(서버리스/오토스케일)에서는 완벽하지 않다. 하지만 로그인
// 무차별 대입(brute force)을 크게 늦추는 1차 방어로는 충분하다.
// 트래픽이 커지면 Redis(@upstash/ratelimit 등) 기반으로 교체할 것.

type Bucket = {
  count: number;
  resetAt: number; // 이 시각(ms)이 지나면 카운트 초기화
};

const buckets = new Map<string, Bucket>();

// 만료된 버킷을 주기적으로 청소한다.
// (키를 계속 바꿔가며 요청하면 Map이 무한히 자라는 것을 방지)
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweepAt = 0;

function sweepExpired(now: number): void {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number; // 차단된 경우 몇 초 뒤 재시도 가능한지
}

/**
 * key(예: "login:1.2.3.4:test@test.com")에 대해
 * windowMs 동안 limit번까지만 허용한다.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweepExpired(now);
  const bucket = buckets.get(key);

  // 버킷이 없거나 시간창이 지났으면 새로 시작
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  // 시간창 안에서 한도 초과
  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterSec: 0,
  };
}

/**
 * rate limit에 걸렸을 때 공통으로 쓰는 429 응답.
 * (Route Handler는 NextResponse 대신 표준 Response를 반환해도 된다)
 */
export function tooManyResponse(retryAfterSec: number, message?: string): Response {
  return new Response(
    JSON.stringify({
      error: message ?? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}

/** 로그인 성공 시 해당 key의 카운트를 비워준다(정상 사용자 방해 방지). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * 요청에서 클라이언트 IP를 최대한 뽑아낸다.
 * (프록시/배포 환경에 따라 헤더가 다르므로 여러 개를 순서대로 시도)
 *
 * ⚠️ 이 헤더들은 클라이언트가 마음대로 위조할 수 있다. Vercel처럼
 * 프록시가 헤더를 덮어쓰는 환경에서만 믿을 수 있으므로, IP 기반 제한은
 * 보조 수단으로만 쓰고 핵심 제한은 위조 불가능한 키(로그인 유저 id,
 * 계정 이메일 등)로 걸어야 한다.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}
