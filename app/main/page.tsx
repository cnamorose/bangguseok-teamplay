import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import RoomShell from "@/app/components/RoomShell";

export default async function MainPage() {
  const user = await getCurrentUser();

  // 로그인 안 된 상태로 들어오면 로그인 페이지로
  if (!user) redirect("/login");

  return (
    <RoomShell user={user}>
      <div className="tp-panel">
        <h2>어서 오세요, {user.name || user.email}님</h2>
        <p>왼쪽 메뉴에서 책장을 열거나 새 팀플을 시작해 보세요.</p>
      </div>
    </RoomShell>
  );
}
