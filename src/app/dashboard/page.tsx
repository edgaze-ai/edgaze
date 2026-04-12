import { redirect } from "next/navigation";

/** Creator hub lives under `/dashboard/earnings`; this route avoids404s from generic “dashboard” links. */
export default function DashboardIndexPage() {
  redirect("/dashboard/earnings");
}
