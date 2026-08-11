import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  // tokenVersion을 올려서 지금까지 발급된 모든 JWT를 서버 쪽에서 무효화한다.
  // (쿠키만 지우면 토큰 자체는 만료 전까지 계속 유효해서, 탈취된 토큰을 막을 수 없다)
  // 모든 기기에서 동시에 로그아웃되는 효과가 있다.
  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  const cookieStore = await cookies();
  cookieStore.delete("token");

  return NextResponse.json({ message: "로그아웃 성공" }, { status: 200 });
}
