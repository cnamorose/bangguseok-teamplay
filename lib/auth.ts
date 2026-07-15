import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET!;

// 토큰에 담을 정보 타입
export interface TokenPayload {
    userId: string;
    email: string;
}

// 토큰 생성 (로그인 성공 시 호출)
export function createToken(payload: TokenPayload): string{
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: "7d", // 7일 뒤 만료
    });
}

// 토큰 검증 (요청이 올 때마다 호출)
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
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
    select: { id: true, email: true, name: true },
  });

  return user; // 있으면 유저 객체, 없으면 null
}