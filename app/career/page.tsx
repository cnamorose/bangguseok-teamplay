import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import CareerHome from "./CareerHome";

// 껍데기는 app/career/layout.tsx가 씌운다
export default async function CareerHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <CareerHome userName={user.name || user.email.split("@")[0]} />;
}
