import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";

/**
 * Root page — server component.
 *
 * If the user already has a valid session token, redirect straight to the
 * dashboard. Otherwise render the full landing page (splash → hero → features).
 */
export default function Home() {
  const cookieStore = cookies();
  const token = cookieStore.get("deriv_auth_token")?.value;

  if (token) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
