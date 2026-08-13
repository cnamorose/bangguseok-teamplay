import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// 비울 수 있는 텍스트 칸들 (title은 비울 수 없어서 따로 다룬다)
const NULLABLE_FIELDS = [
  "period",
  "role",
  "situation",
  "action",
  "impact",
  "learning",
  "message",
  "raw",
] as const;

async function assertOwner(id: string, userId: string) {
  const row = await prisma.experience.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!row) return { error: "경험을 찾을 수 없습니다.", status: 404 as const };
  if (row.userId !== userId) return { error: "접근 권한이 없습니다.", status: 403 as const };
  return null;
}

/** 수정. 보낸 칸만 바꾼다 (질문에 답해서 한 칸만 채우는 흐름을 지원) */
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

    const body = await req.json();
    const data: Prisma.ExperienceUpdateInput = {};

    // 제목은 비울 수 없다 (목록에서 식별이 안 되므로)
    if (typeof body.title === "string" && body.title.trim()) {
      data.title = body.title.slice(0, 100);
    }

    for (const field of NULLABLE_FIELDS) {
      if (typeof body[field] === "string") {
        const value = body[field].slice(0, field === "raw" ? 5000 : 1000);
        data[field] = value || null;
      }
    }

    if (Array.isArray(body.tags)) {
      data.tags = body.tags.slice(0, 6).map(String);
    }
    if (typeof body.starred === "boolean") {
      data.starred = body.starred;
    }
    if (body.gaps !== undefined) {
      data.gaps = body.gaps ?? Prisma.DbNull;
      data.organizedAt = new Date();
    }

    const experience = await prisma.experience.update({ where: { id }, data });
    return NextResponse.json({ experience }, { status: 200 });
  } catch (error) {
    console.error("경험 수정 에러:", error);
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

    await prisma.experience.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("경험 삭제 에러:", error);
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }
}
