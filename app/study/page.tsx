import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Shell from "@/app/components/Shell";
import StudyHome from "./StudyHome";

export default async function StudyHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <Shell user={user}>
      <StudyHome userName={user.name || user.email.split("@")[0]} />
    </Shell>
  );
}
