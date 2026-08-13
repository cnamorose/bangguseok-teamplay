import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { guessKind } from "@/lib/agents/essay/kinds";

const MAX_PROMPT_LEN = 500;

/**
 * 자소서 작성 화면이 처음 필요로 하는 것들을 한 번에 준다.
 * - 지원 건 목록 (회사 × 직무)
 * - 내 경험 목록 (문항에 붙일 재료)
 * 경험이 하나도 없으면 화면이 경험 정리로 안내한다.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const applicationId = req.nextUrl.searchParams.get("applicationId");

    const [applications, experiences, essays] = await Promise.all([
      prisma.application.findMany({
        where: { userId: user.id },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          role: true,
          roleAnalysis: true,
          company: { select: { id: true, name: true, analysis: true } },
          _count: { select: { essays: true } },
        },
      }),
      prisma.experience.findMany({
        where: { userId: user.id },
        orderBy: [{ starred: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true, title: true, role: true, impact: true,
          message: true, tags: true, starred: true,
        },
      }),
      applicationId
        ? prisma.essay.findMany({
            where: { applicationId, application: { userId: user.id } },
            orderBy: { order: "asc" },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({ applications, experiences, essays }, { status: 200 });
  } catch (error) {
    console.error("자소서 화면 조회 에러:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

/**
 * 문항 추가 — 내용 없이 자리만 만든다.
 * 공고의 문항을 먼저 다 적어 놓고, 문항마다 쓸 경험을 골라 하나씩 뽑는 흐름이다.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await req.json();
    const applicationId = String(body.applicationId ?? "");
    const prompt = String(body.prompt ?? "").trim().slice(0, MAX_PROMPT_LEN);

    if (!applicationId || !prompt) {
      return NextResponse.json({ error: "지원 건과 문항이 필요합니다." }, { status: 400 });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { userId: true },
    });
    if (!application || application.userId !== user.id) {
      return NextResponse.json({ error: "지원 건을 찾을 수 없습니다." }, { status: 404 });
    }

    const count = await prisma.essay.count({ where: { applicationId } });
    const essay = await prisma.essay.create({
      data: {
        applicationId,
        order: count,
        prompt,
        kind: typeof body.kind === "string" && body.kind ? body.kind : guessKind(prompt),
        maxChars: Number(body.maxChars) > 0 ? Math.min(Number(body.maxChars), 5000) : null,
      },
    });

    return NextResponse.json({ essay }, { status: 200 });
  } catch (error) {
    console.error("문항 추가 에러:", error);
    return NextResponse.json({ error: "문항을 추가하지 못했습니다." }, { status: 500 });
  }
}
