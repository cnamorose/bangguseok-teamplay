import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import RoomShell from "@/app/components/RoomShell";
import ClipboardView from "./ClipboardView";

export default async function ClipboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  return (
    <RoomShell user={user} title="📋 평가단자료">
      <ClipboardView id={id} />
    </RoomShell>
  );
}
