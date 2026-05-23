import { redirect } from "next/navigation";

export default function AnalyticsRootPage() {
  redirect("/dashboard/analytics/operations");
}
