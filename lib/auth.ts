import jwt from "jsonwebtoken";

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