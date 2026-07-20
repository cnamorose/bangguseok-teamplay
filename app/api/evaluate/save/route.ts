import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// 평가 결과를 "클립보드(평가단자료)"로 저장.
// - id 없으면: 새로 생성 (평가 완료 시 자동 저장)
// - id 있으면: 기존 레코드 갱신 (논의로 수정본이 나오면 그 레코드에 덧붙임)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id, topic, text, results, revised } = await req.json();
    const revisedValue = typeof revised === "string" && revised.trim() ? revised : null;

    // 갱신: 소유 확인 후 수정본(및 결과) 업데이트
    if (id) {
      const existing = await prisma.evaluation.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
      }
      if (existing.userId !== user.id) {
        return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
      }

      const updated = await prisma.evaluation.update({
        where: { id },
        data: {
          revised: revisedValue,
          // 결과가 함께 오면 최신으로 갱신 (없으면 기존 유지)
          ...(Array.isArray(results) && results.length > 0
            ? { results: results as unknown as Prisma.InputJsonValue }
            : {}),
        },
        select: { id: true },
      });

      return NextResponse.json({ id: updated.id }, { status: 200 });
    }

    // 생성
    if (!topic || !text || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json({ error: "저장할 평가 내용이 부족합니다." }, { status: 400 });
    }

    const evaluation = await prisma.evaluation.create({
      data: {
        userId: user.id,
        topic,
        text,
        results: results as unknown as Prisma.InputJsonValue,
        revised: revisedValue,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: evaluation.id }, { status: 200 });
  } catch (error) {
    console.error("평가 저장 에러:", error);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}
