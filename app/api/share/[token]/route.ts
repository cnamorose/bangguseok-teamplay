import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * 공유된 결과물 보기.
 * 로그인하지 않아도 열릴 수 있으므로(scope=link) 스냅샷만 내보낸다 — DB를 더 뒤지지 않는다.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const share = await prisma.share.findUnique({
      where: { token },
      select: {
        id: true,
        kind: true,
        snapshot: true,
        scope: true,
        revoked: true,
        createdAt: true,
        ownerId: true,
        owner: { select: { name: true, email: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            content: true,
            createdAt: true,
            userId: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!share || share.revoked) {
      return NextResponse.json({ error: "없거나 공유가 끝난 링크예요." }, { status: 404 });
    }

    const user = await getCurrentUser();

    if (share.scope === "login" && !user) {
      return NextResponse.json(
        { error: "로그인한 사람만 볼 수 있는 글이에요.", needLogin: true },
        { status: 401 }
      );
    }

    // 이름 대신 보여줄 표시 (이메일 전체를 남에게 노출하지 않는다)
    const nick = (u: { name: string | null; email: string }) =>
      u.name || u.email.split("@")[0];

    return NextResponse.json(
      {
        share: {
          kind: share.kind,
          snapshot: share.snapshot,
          createdAt: share.createdAt,
          owner: nick(share.owner),
          isOwner: user?.id === share.ownerId,
          canComment: !!user,
          comments: share.comments.map((c) => ({
            id: c.id,
            content: c.content,
            createdAt: c.createdAt,
            author: nick(c.user),
            mine: user?.id === c.userId,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("공유 조회 에러:", error);
    return NextResponse.json({ error: "불러오지 못했습니다." }, { status: 500 });
  }
}

/** 거실에 올리기 / 내리기 (링크는 그대로 살아 있다) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { token } = await params;
    const body = await req.json();
    if (typeof body.listed !== "boolean") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const share = await prisma.share.findUnique({
      where: { token },
      select: { id: true, ownerId: true },
    });

    if (!share) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    if (share.ownerId !== user.id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    await prisma.share.update({ where: { id: share.id }, data: { listed: body.listed } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("거실 노출 변경 에러:", error);
    return NextResponse.json({ error: "바꾸지 못했습니다." }, { status: 500 });
  }
}

/** 공유 해제 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { token } = await params;
    const share = await prisma.share.findUnique({
      where: { token },
      select: { id: true, ownerId: true },
    });

    if (!share) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    if (share.ownerId !== user.id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    await prisma.share.update({ where: { id: share.id }, data: { revoked: true } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("공유 해제 에러:", error);
    return NextResponse.json({ error: "해제하지 못했습니다." }, { status: 500 });
  }
}
