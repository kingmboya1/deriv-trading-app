import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SignInClient from "./SignInClient";

/**
 * Root page — server component.
 *
 * If the user already has a valid session token, skip straight to the
 * dashboard.  Otherwise render the sign-in screen.
 */
export default function Home() {
  const cookieStore = cookies();
  const token = cookieStore.get("deriv_auth_token")?.value;

  if (token) {
    redirect("/dashboard");
  }

  return <SignInClient />;
}
