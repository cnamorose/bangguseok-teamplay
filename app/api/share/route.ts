import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";
import { buildSnapshot, makeToken, ShareKind } from "@/lib/share/snapshot";

const SHARE_LIMIT = 30;
const SHARE_WINDOW_MS = 10 * 60 * 1000;

/** 거실 피드에 한 번에 내려보내는 개수 */
const FEED_SIZE = 60;

/**
 * ?feed=1  → 거실에 올라온 것 (모두의 것)
 * 그 외    → 내가 내놓은 것 (관리용)
 *
 * 피드에는 listed를 켠 것만 나간다. scope로 거르지 않는 이유는
 * "링크를 아는 사람은 봐도 된다"가 "목록에 올려도 된다"는 뜻은 아니기 때문이다.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (req.nextUrl.searchParams.get("feed") === "1") {
    const rows = await prisma.share.findMany({
      where: { listed: true, revoked: false },
      orderBy: { createdAt: "desc" },
      take: FEED_SIZE,
      select: {
        id: true,
        token: true,
        kind: true,
        snapshot: true,
        createdAt: true,
        ownerId: true,
        owner: { select: { name: true, email: true } },
        _count: { select: { comments: true } },
      },
    });

    // 남의 목록이므로 관리용 필드(scope·targetId·revoked)는 내보내지 않는다.
    // 이메일 전체도 노출하지 않는다.
    const shares = rows.map((s) => ({
      id: s.id,
      token: s.token,
      kind: s.kind,
      snapshot: s.snapshot,
      createdAt: s.createdAt,
      author: s.owner.name || s.owner.email.split("@")[0],
      mine: s.ownerId === user.id,
      comments: s._count.comments,
    }));

    return NextResponse.json({ shares }, { status: 200 });
  }

  const shares = await prisma.share.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      kind: true,
      targetId: true,
      snapshot: true,
      scope: true,
      listed: true,
      revoked: true,
      createdAt: true,
      _count: { select: { comments: true } },
    },
  });

  return NextResponse.json({ shares }, { status: 200 });
}

/** 공유 만들기 (같은 결과물을 다시 공유하면 스냅샷만 새로 뜬다) */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const rl = rateLimit(`share:${user.id}`, SHARE_LIMIT, SHARE_WINDOW_MS);
    if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

    const body = await req.json();
    const kind = body.kind as ShareKind;
    const targetId = String(body.targetId ?? "");

    if ((kind !== "result" && kind !== "essay") || !targetId) {
      return NextResponse.json({ error: "공유할 결과물이 필요합니다." }, { status: 400 });
    }

    const built = await buildSnapshot(kind, targetId, user.id);
    if ("error" in built) {
      return NextResponse.json({ error: built.error }, { status: built.status });
    }

    // 자소서엔 지원 사실과 개인 경험이 묻어 있으므로 기본을 좁게 잡는다
    const scope =
      body.scope === "link" || body.scope === "login"
        ? body.scope
        : kind === "essay"
          ? "login"
          : "link";

    // 거실 노출은 명시적으로 켠 경우에만. 기본은 끔
    const listed = body.listed === true;

    // 살아 있는 공유가 있으면 그 링크를 유지한 채 내용만 새로 뜬다.
    // 해제한 공유는 되살리지 않는다 — 끊었다고 생각한 링크가 다시 열리면 사고다.
    const existing = await prisma.share.findFirst({
      where: { ownerId: user.id, kind, targetId, revoked: false },
    });

    const share = existing
      ? await prisma.share.update({
          where: { id: existing.id },
          data: {
            snapshot: built.snapshot as unknown as Prisma.InputJsonValue,
            scope,
            listed,
          },
        })
      : await prisma.share.create({
          data: {
            token: makeToken(),
            ownerId: user.id,
            kind,
            targetId,
            snapshot: built.snapshot as unknown as Prisma.InputJsonValue,
            scope,
            listed,
          },
        });

    return NextResponse.json({ share }, { status: 200 });
  } catch (error) {
    console.error("공유 생성 에러:", error);
    return NextResponse.json({ error: "공유하지 못했습니다." }, { status: 500 });
  }
}
