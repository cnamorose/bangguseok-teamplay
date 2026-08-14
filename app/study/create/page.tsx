import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Shell from "@/app/components/Shell";
import Assemble from "./Assemble";

export default async function CreatePage() {
  const user = await getCurrentUser();

  // 로그인 안 된 상태로 들어오면 로그인 페이지로
  if (!user) redirect("/login");

  return (
    <Shell user={user}>
      <Assemble />
    </Shell>
  );
}
