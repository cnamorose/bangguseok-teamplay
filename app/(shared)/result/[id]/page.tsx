import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import RoomShell from "@/app/components/RoomShell";
import ResultView from "./ResultView";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  // 로그인 안 된 상태로 들어오면 로그인 페이지로
  if (!user) redirect("/login");

  const { id } = await params;

  return (
    <RoomShell user={user} title="📖 펼친 책" flush>
      <ResultView id={id} />
    </RoomShell>
  );
}
