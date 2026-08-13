import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countChars } from "@/lib/agents/length";

async function assertOwner(id: string, userId: string) {
  const row = await prisma.essay.findUnique({
    where: { id },
    select: { application: { select: { userId: true } } },
  });
  if (!row) return { error: "문항을 찾을 수 없습니다.", status: 404 as const };
  if (row.application.userId !== userId) {
    return { error: "접근 권한이 없습니다.", status: 403 as const };
  }
  return null;
}

/** 손으로 고친 내용 저장 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const denied = await assertOwner(id, user.id);
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    const { content } = await req.json();
    if (typeof content !== "string") {
      return NextResponse.json({ error: "내용이 필요합니다." }, { status: 400 });
    }

    const text = content.slice(0, 20000);
    const essay = await prisma.essay.update({
      where: { id },
      data: { content: text, charCount: countChars(text) },
    });

    return NextResponse.json({ essay }, { status: 200 });
  } catch (error) {
    console.error("자소서 저장 에러:", error);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const denied = await assertOwner(id, user.id);
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

    await prisma.essay.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("자소서 삭제 에러:", error);
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }
}
