import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";
import { cookies } from "next/headers";

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

    // 2. 이메일로 유저 찾기
    const user = await prisma.user.findUnique({
      where: { email },
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

    // 5. 로그인 성공
    // 5. 로그인 성공 → JWT 토큰 생성
    const token = createToken({ userId: user.id, email: user.email });

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