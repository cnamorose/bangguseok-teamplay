import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toModeId } from "@/lib/modes";

// 마지막으로 있던 방을 기억한다.
// (지금 어느 방인지는 URL이 정하고, 이 값은 "/" 진입·로그인 직후에만 쓰인다)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { mode } = await req.json();
    if (mode !== "study" && mode !== "career") {
      return NextResponse.json({ error: "알 수 없는 방입니다." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { mode: toModeId(mode) },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("방 저장 에러:", error);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}
