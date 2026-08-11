import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homeOf } from "@/lib/modes";

// 입구: 로그인했으면 마지막에 있던 방으로, 아니면 로그인 페이지로
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? homeOf(user.mode) : "/login");
}
