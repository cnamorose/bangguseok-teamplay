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

    // 정상적인 StoredTheme은 1KB 미만 → 그 이상은 DB 부풀리기 방지 차원에서 거부
    const serialized = theme === null ? null : JSON.stringify(theme);
    if (serialized !== null && serialized.length > 10_000) {
      return NextResponse.json({ error: "테마 데이터가 너무 큽니다." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { theme: serialized },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("테마 저장 에러:", error);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}
