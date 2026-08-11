import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import RoomShell from "@/app/components/RoomShell";

// 취업방 공통 껍데기.
// 공부방은 화면마다 RoomShell을 직접 감싸지만, 취업방은 화면이 많아 레이아웃에서 한 번만 감싼다.
export default async function CareerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // 로그인 안 된 상태로 들어오면 로그인 페이지로
  if (!user) redirect("/login");

  return <RoomShell user={user}>{children}</RoomShell>;
}
