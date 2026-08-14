import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Shell from "@/app/components/Shell";
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
    <Shell user={user}>
      <ClipboardView id={id} />
    </Shell>
  );
}
