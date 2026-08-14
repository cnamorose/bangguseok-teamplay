import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import RoomShell from "@/app/components/RoomShell";
import LivingRoom from "./LivingRoom";

export default async function LivingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <RoomShell user={user} title="🛋️ 거실">
      <LivingRoom />
    </RoomShell>
  );
}
