import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 책장 테마 저장 (StoredTheme JSON을 User.theme에 문자열로 보관)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { theme } = await req.json();

    // theme은 StoredTheme 객체 (또는 초기화용 null)
    if (theme !== null && typeof theme !== "object") {
      return NextResponse.json({ error: "잘못된 테마 형식입니다." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { theme: theme === null ? null : JSON.stringify(theme) },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("테마 저장 에러:", error);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}
