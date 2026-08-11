import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { rateLimit, resetRateLimit, getClientIp } from "@/lib/rateLimit";

// 로그인 시도 제한: IP+이메일 기준 15분 동안 10회까지
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// 이메일 단독 기준 보조 제한 (x-forwarded-for를 위조해 IP를 바꿔가며
// 한 계정을 무차별 대입하는 우회를 막는다. 한도는 조금 여유 있게)
const LOGIN_EMAIL_LIMIT = 30;
const LOGIN_EMAIL_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // 1. 입력값 검증
    if (!email || !password) {
      return NextResponse.json(
        { error: "이메일과 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    // 이메일 정규화 (대소문자/공백 차이로 인한 로그인 실패·중복계정 방지)
    const normalizedEmail = String(email).trim().toLowerCase();

    // 1-1. 무차별 대입 방어 (IP + 이메일 단위로 시도 횟수 제한)
    const ip = getClientIp(req);
    const rl = rateLimit(`login:${ip}:${normalizedEmail}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    const rlEmail = rateLimit(`login-email:${normalizedEmail}`, LOGIN_EMAIL_LIMIT, LOGIN_EMAIL_WINDOW_MS);
    if (!rl.allowed || !rlEmail.allowed) {
      const retryAfterSec = Math.max(rl.retryAfterSec, rlEmail.retryAfterSec);
      return NextResponse.json(
        { error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    // 2. 이메일로 유저 찾기
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // 3. 유저가 없으면 실패
    if (!user) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    // 4. 비밀번호 비교 (입력한 평문 vs DB의 해시)
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    // 5. 로그인 성공 → 실패 카운트 초기화 후 JWT 토큰 생성
    resetRateLimit(`login:${ip}:${normalizedEmail}`);
    resetRateLimit(`login-email:${normalizedEmail}`);
    const token = createToken({
      userId: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

    // 6. 토큰을 httpOnly 쿠키에 저장
    const cookieStore = await cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: "/",
    });

    // 7. 응답 (로그인 후 이동할 곳도 함께 알려준다)
    return NextResponse.json(
      {
        message: "로그인 성공",
        user: { id: user.id, email: user.email, name: user.name },
        redirectTo: "/bookshelf",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("로그인 에러:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}