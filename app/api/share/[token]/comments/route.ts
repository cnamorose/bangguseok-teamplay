import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";

const COMMENT_LIMIT = 30;
const COMMENT_WINDOW_MS = 10 * 60 * 1000;
const MAX_LEN = 1000;

/** 댓글 달기 — 로그인한 사람만 (익명은 신고·차단 문제를 키운다) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "댓글은 로그인해야 쓸 수 있어요." }, { status: 401 });
    }

    const rl = rateLimit(`comment:${user.id}`, COMMENT_LIMIT, COMMENT_WINDOW_MS);
    if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

    const { token } = await params;
    const share = await prisma.share.findUnique({
      where: { token },
      select: { id: true, revoked: true },
    });

    if (!share || share.revoked) {
      return NextResponse.json({ error: "없거나 공유가 끝난 링크예요." }, { status: 404 });
    }

    const { content } = await req.json();
    const text = String(content ?? "").trim().slice(0, MAX_LEN);
    if (!text) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }

    const comment = await prisma.comment.create({
      data: { shareId: share.id, userId: user.id, content: text },
      select: { id: true, content: true, createdAt: true },
    });

    return NextResponse.json(
      {
        comment: {
          ...comment,
          author: user.name || user.email.split("@")[0],
          mine: true,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("댓글 작성 에러:", error);
    return NextResponse.json({ error: "댓글을 남기지 못했습니다." }, { status: 500 });
  }
}

/** 내 댓글 지우기 (공유한 사람도 지울 수 있다) */
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
    const commentId = req.nextUrl.searchParams.get("id");
    if (!commentId) {
      return NextResponse.json({ error: "댓글을 지정해주세요." }, { status: 400 });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, share: { select: { ownerId: true, token: true } } },
    });

    if (!comment || comment.share.token !== token) {
      return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    }
    if (comment.userId !== user.id && comment.share.ownerId !== user.id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    await prisma.comment.delete({ where: { id: commentId } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("댓글 삭제 에러:", error);
    return NextResponse.json({ error: "삭제하지 못했습니다." }, { status: 500 });
  }
}
