import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// 입구: 로그인했으면 내 방으로, 아니면 로그인 페이지로
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/bookshelf" : "/login");
}
