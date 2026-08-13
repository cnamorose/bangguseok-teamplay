import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";
import { analyzePosting } from "@/lib/agents/company/posting";
import { analyzeRole } from "@/lib/agents/company/analyze";
import { CompanyAnalysis } from "@/lib/agents/company/types";

export const maxDuration = 60;

const CREATE_LIMIT = 10;
const CREATE_WINDOW_MS = 10 * 60 * 1000;

const MAX_ROLE_LEN = 60;
const MAX_POSTING_LEN = 12000;

/**
 * 책상 목록 — 지원 건(회사 × 직무) 카드.
 * 취준생에게 제일 중요한 건 마감이라 핀 → 마감 임박순으로 정렬한다.
 * 무거운 analysis/content는 빼고, 분석 여부는 analyzedAt으로 판단한다.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const rows = await prisma.application.findMany({
      where: { userId: user.id },
      orderBy: [{ pinned: "desc" }, { deadline: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        role: true,
        deadline: true,
        status: true,
        pinned: true,
        analyzedAt: true, // 직무 분석 여부
        company: { select: { id: true, name: true, analyzedAt: true } },
        essays: { select: { id: true, charCount: true }, orderBy: { order: "asc" } },
      },
    });

    // 마감이 없는 건은 뒤로 (Prisma의 null 정렬이 DB마다 달라 여기서 한 번 더 정리)
    const applications = rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    return NextResponse.json({ applications }, { status: 200 });
  } catch (error) {
    console.error("책상 조회 에러:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

/**
 * 지원 건 만들기 = 공고 분석.
 *
 * 공고 원문이 있으면 거기서 직무·마감·자격요건을 그대로 뽑는다(검색 0회).
 * 없으면 예전처럼 검색으로 추측한다(폴백). 추측보다 원문이 언제나 정확하다.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const rl = rateLimit(`application:${user.id}`, CREATE_LIMIT, CREATE_WINDOW_MS);
    if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

    const body = await req.json();
    const companyId = String(body.companyId ?? "");
    const inputRole = String(body.role ?? "").trim().slice(0, MAX_ROLE_LEN);
    const posting = String(body.jobPosting ?? "").trim().slice(0, MAX_POSTING_LEN);

    if (!companyId || (!inputRole && !posting)) {
      return NextResponse.json(
        { error: "회사와 함께 직무명이나 채용공고 중 하나는 필요해요." },
        { status: 400 }
      );
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company || company.userId !== user.id) {
      return NextResponse.json({ error: "회사를 찾을 수 없습니다." }, { status: 404 });
    }

    const analysis = company.analysis as CompanyAnalysis | null;

    let role = inputRole;
    let deadline: Date | null = null;
    let roleAnalysis;

    if (posting) {
      // 공고가 있으면 검색하지 않는다
      const { result } = await analyzePosting(company.name, posting, inputRole || "지원 직무", analysis);
      role = result.role;
      roleAnalysis = result.analysis;
      if (result.deadline) {
        const d = new Date(result.deadline);
        if (!Number.isNaN(d.getTime())) deadline = d;
      }
    } else {
      // 공고가 아직 없는 회사 — 검색으로 대충이라도 잡아준다
      const { analysis: fromSearch } = await analyzeRole(company.name, role, analysis ?? ({} as CompanyAnalysis), {
        progress: () => {},
      });
      roleAnalysis = fromSearch;
    }

    const application = await prisma.application.upsert({
      where: { companyId_role: { companyId, role } },
      create: {
        userId: user.id,
        companyId,
        role,
        jobPosting: posting || null,
        roleAnalysis: roleAnalysis as unknown as Prisma.InputJsonValue,
        analyzedAt: new Date(),
        deadline,
      },
      update: {
        jobPosting: posting || null,
        roleAnalysis: roleAnalysis as unknown as Prisma.InputJsonValue,
        analyzedAt: new Date(),
        // 공고에서 마감을 못 읽었으면 이미 넣어 둔 값을 지우지 않는다
        ...(deadline ? { deadline } : {}),
      },
    });

    return NextResponse.json({ application }, { status: 200 });
  } catch (error) {
    console.error("지원 건 생성 에러:", error);
    return NextResponse.json({ error: "지원 건을 만들지 못했습니다." }, { status: 500 });
  }
}
