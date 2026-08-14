import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { extractArticleText } from "@/lib/result-text";

// 공유본에 무엇이 담기는지는 **오직 이 파일이 정한다.**
//
// 원본을 라이브로 읽지 않고 여기서 만든 스냅샷만 내보내므로,
// 나중에 Essay나 Result에 필드가 늘어도 이 파일을 고치지 않는 한 새지 않는다.
// 공유 화면은 스냅샷만 읽는다. DB를 다시 뒤지지 않는다.

export type ShareKind = "result" | "essay";

/** 공부방 책 */
export interface ResultSnapshot {
  kind: "result";
  topic: string;
  teamName: string;
  /** 최종 결과물 본문 (중간 과정·에이전트 로그는 담지 않는다) */
  body: string;
  createdAt: string;
}

/** 자소서 문항 하나 */
export interface EssaySnapshot {
  kind: "essay";
  companyName: string;
  role: string;
  prompt: string;
  kindLabel: string;
  maxChars: number | null;
  charCount: number;
  content: string;
}

export type Snapshot = ResultSnapshot | EssaySnapshot;

export interface SnapshotFail {
  error: string;
  status: 400 | 403 | 404;
}

/**
 * 공유할 결과물의 스냅샷을 만든다. 소유자가 아니면 만들지 않는다.
 *
 * 자소서에서 일부러 뺀 것:
 *   같은 지원 건의 다른 문항 · 등록한 경험 · 회사 분석과 메모 ·
 *   마감일과 지원 상태 · 첨삭 점수 · 이전 버전(history)
 * 회사·직무·문항까지는 담는다. 그게 없으면 읽는 사람이 판단을 못 한다.
 */
export async function buildSnapshot(
  kind: ShareKind,
  targetId: string,
  userId: string
): Promise<{ snapshot: Snapshot } | SnapshotFail> {
  if (kind === "result") {
    const result = await prisma.result.findUnique({
      where: { id: targetId },
      include: { assembly: { select: { name: true } } },
    });
    if (!result) return { error: "결과물을 찾을 수 없습니다.", status: 404 };
    if (result.userId !== userId) return { error: "내 결과물만 공유할 수 있어요.", status: 403 };

    const body = extractArticleText(result.resultData);
    if (!body.trim()) return { error: "아직 내용이 없는 결과물이에요.", status: 400 };

    return {
      snapshot: {
        kind: "result",
        topic: result.topic,
        teamName: result.assembly?.name ?? "",
        body,
        createdAt: result.createdAt.toISOString(),
      },
    };
  }

  const essay = await prisma.essay.findUnique({
    where: { id: targetId },
    include: {
      application: {
        select: { userId: true, role: true, company: { select: { name: true } } },
      },
    },
  });
  if (!essay) return { error: "문항을 찾을 수 없습니다.", status: 404 };
  if (essay.application.userId !== userId) {
    return { error: "내 자소서만 공유할 수 있어요.", status: 403 };
  }
  if (!essay.content.trim()) return { error: "아직 작성된 내용이 없어요.", status: 400 };

  const { KINDS } = await import("@/lib/agents/essay/kinds");

  return {
    snapshot: {
      kind: "essay",
      companyName: essay.application.company.name,
      role: essay.application.role,
      prompt: essay.prompt,
      kindLabel: KINDS.find((k) => k.id === essay.kind)?.label ?? "",
      maxChars: essay.maxChars,
      charCount: essay.charCount,
      content: essay.content,
    },
  };
}

/**
 * 주소에 쓸 짧은 키.
 *
 * "링크 아는 사람 누구나"로 공유하면 이 토큰이 사실상 비밀번호 역할을 한다.
 * 그래서 Math.random()이 아니라 암호학용 난수를 쓴다 —
 * Math.random()은 예측 가능한 생성기라 여러 값을 관찰하면 다음이 추론될 수 있다.
 */
export function makeToken(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789"; // 헷갈리는 글자(l,o,0,1) 제외
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    // 32글자라 바이트를 32로 나눈 나머지를 써도 치우침이 없다 (256 = 32 × 8)
    out += chars[bytes[i] % chars.length];
  }
  return out;
}
