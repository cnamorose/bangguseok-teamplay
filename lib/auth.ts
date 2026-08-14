import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// 서버 시작 시점에 시크릿이 없으면 즉시 실패시킨다.
// (없는 채로 두면 토큰이 안전하지 않게 서명되거나 위조에 노출된다)
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret) {
    throw new Error("JWT_SECRET 환경변수가 설정되지 않았습니다.");
}
// 명시적 string 타입으로 고정해야 함수(클로저) 내부에서도 타입이 유지된다
const JWT_SECRET: string = rawSecret;

// 서명/검증에 사용할 알고리즘을 명시적으로 고정한다.
// (지정하지 않으면 alg:none 등 알고리즘 혼동 공격에 노출될 수 있다)
const JWT_ALGORITHM = "HS256" as const;

// 토큰에 담을 정보 타입
export interface TokenPayload {
    userId: string;
    email: string;
    // 발급 시점의 User.tokenVersion. 로그아웃하면 DB 쪽 값이 +1 되므로
    // 이전에 발급된 토큰은 전부 무효가 된다. (없으면 0으로 취급 — 구버전 토큰 호환)
    tokenVersion?: number;
}

// 토큰 생성 (로그인 성공 시 호출)
export function createToken(payload: TokenPayload): string{
    return jwt.sign(payload, JWT_SECRET, {
        algorithm: JWT_ALGORITHM,
        expiresIn: "7d", // 7일 뒤 만료
    });
}

// 토큰 검증 (요청이 올 때마다 호출)
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    }) as TokenPayload;
  } catch {
    // 토큰이 위조됐거나 만료되면 null 반환
    return null;
  }
}

/**
 * 현재 요청의 쿠키에서 로그인한 유저를 꺼낸다.
 * 로그인 안 됐으면 null 반환.
 * → me 라우트, 실행 라우트 등 "로그인 유저가 필요한" 모든 곳에서 재사용.
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, mode: true, tokenVersion: true },
  });
  if (!user) return null;

  // 로그아웃(=tokenVersion 증가) 이전에 발급된 토큰은 거부한다
  if ((payload.tokenVersion ?? 0) !== user.tokenVersion) return null;

  // tokenVersion은 검증용이므로 밖으로 내보내지 않는다
  return { id: user.id, email: user.email, name: user.name, mode: user.mode };
}