import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Shell from "@/app/components/Shell";
import LivingRoom from "./LivingRoom";

export default async function LivingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <Shell user={user}>
      <LivingRoom />
    </Shell>
  );
}
