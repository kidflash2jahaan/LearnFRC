import { redirect } from "next/navigation";

// Manual join codes were removed in favor of auto-grouping by team number.
// Old invite links now redirect to the auto team page.
export default function JoinRedirect() {
  redirect("/teams");
}
