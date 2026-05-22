import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCookieName, verifyToken } from "@/lib/auth";

export default async function Home() {
  const token = cookies().get(getCookieName())?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    await verifyToken(token);
    redirect("/dashboard/review");
  } catch {
    redirect("/login");
  }
}
