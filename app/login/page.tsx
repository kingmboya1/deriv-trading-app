/**
 * /login is no longer the entry point — the sign-in UI lives at /.
 * Redirect any direct hits to the root sign-in page.
 *
 * The OAuth callback route (api/auth/callback) still redirects here on
 * error; this ensures those error cases land back at the sign-in screen
 * rather than a dead page.
 */
import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect("/");
}
