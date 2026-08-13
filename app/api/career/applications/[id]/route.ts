import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STATUSES = ["preparing", "submitted", "doc_pass", "interview", "closed"];

async function assertOwner(id: string, userId: string) {
  const row = await prisma.application.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!row) return { error: "지원 건을 찾을 수 없습니다.", status: 404 as const };
  if (row.userId !== userId) return { error: "접근 권한이 없습니다.", status: 403 as const };
  return null;
}

/** 지원 건 상세 — 회사 분석 · 직무 분석 · 자소서 문항 전부 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        company: true,
        essays: { orderBy: { order: "asc" } },
      },
    });

    if (!application) {
      return NextResponse.json({ error: "지원 건을 찾을 수 없습니다." }, { status: 404 });
    }
    if (application.userId !== user.id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    return NextResponse.json({ application }, { status: 200 });
  } catch (error) {
    console.error("지원 건 조회 에러:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

/** 마감·상태·핀 수정 */
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
    const data: { deadline?: Date | null; status?: string; pinned?: boolean } = {};

    if ("deadline" in body) {
      const raw = String(body.deadline ?? "").trim();
      const parsed = raw ? new Date(raw) : null;
      data.deadline = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
    if (typeof body.status === "string" && STATUSES.includes(body.status)) {
      data.status = body.status;
    }
    if (typeof body.pinned === "boolean") {
      data.pinned = body.pinned;
    }

    const application = await prisma.application.update({ where: { id }, data });
    return NextResponse.json({ application }, { status: 200 });
  } catch (error) {
    console.error("지원 건 수정 에러:", error);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}
