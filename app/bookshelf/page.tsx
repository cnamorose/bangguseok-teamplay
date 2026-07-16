import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import RoomShell from "@/app/components/RoomShell";
import Shelf from "./Shelf";

export default async function BookshelfPage() {
  const user = await getCurrentUser();

  // 로그인 안 된 상태로 들어오면 로그인 페이지로
  if (!user) redirect("/login");

  return (
    <RoomShell
      user={user}
      actions={
        <Link href="/create" className="tp-btn-sm">
          + 새 팀플
        </Link>
      }
    >
      <Shelf />
    </RoomShell>
  );
}
