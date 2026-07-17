import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDocument } from "@/lib/documents";
import type { VisualizeOutput } from "@/lib/pipeline-types";

// 문서 생성이 조금 걸릴 수 있으니 여유를 준다
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.result.findUnique({ where: { id } });

  if (!result) {
    return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
  }
  if (result.userId !== user.id) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }

  // 시각화 결과를 꺼내 파일을 즉석에서 만든다 (서버리스는 디스크에 못 저장하므로)
  const data = result.resultData as { visualize?: VisualizeOutput } | null;
  const visualize = data?.visualize;
  if (!visualize) {
    return NextResponse.json({ error: "결과물이 아직 없습니다." }, { status: 404 });
  }

  const { buffer, ext } = await createDocument(visualize);
  const filename = `${result.topic}.${ext}`;

  const contentType =
    ext === "pptx"
      ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      // 한글 파일명도 깨지지 않게 UTF-8 인코딩
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
