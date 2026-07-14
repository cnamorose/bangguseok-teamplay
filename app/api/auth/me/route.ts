import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 1. 쿠키에서 토큰 꺼내기
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // 2. 토큰 검증
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // 3. 토큰의 userId로 최신 유저 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true }, // password 제외
    });

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error("유저 확인 에러:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}