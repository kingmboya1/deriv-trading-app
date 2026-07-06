"use client";

function base64UrlEncode(value: Uint8Array | ArrayBuffer): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function createPkcePair() {
  const randomValues = new Uint8Array(64);
  crypto.getRandomValues(randomValues);

  const codeVerifier = base64UrlEncode(randomValues);
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
  const codeChallenge = base64UrlEncode(digest);

  return { codeVerifier, codeChallenge };
}

function setCookie(name: string, value: string, maxAge = 60 * 60 * 24 * 7) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export default function LoginPage() {
  const handleLogin = async () => {
    const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "";
    const redirectUri =
      process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI ??
      "http://localhost:3000/api/auth/callback";

    if (!appId) {
      window.alert("Missing NEXT_PUBLIC_DERIV_APP_ID");
      return;
    }

    const { codeVerifier, codeChallenge } = await createPkcePair();
    const state = crypto.randomUUID();

    const selectedAccountType = document.querySelector(
      'input[name="accountType"]:checked'
    ) as HTMLInputElement | null;
    const preference = selectedAccountType?.value ?? "real";
    setCookie("deriv_account_preference", preference, 60 * 60 * 24);

    setCookie("pkce_verifier", codeVerifier);
    setCookie("oauth_state", state);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: appId,
      redirect_uri: redirectUri,
      scope: "trade account_manage",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    window.location.assign(`https://auth.deriv.com/oauth2/auth?${params.toString()}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="mb-3 text-sm uppercase tracking-[0.3em] text-sky-400">
          Deriv OAuth
        </p>
        <h1 className="mb-4 text-3xl font-semibold">Connect your Deriv account</h1>
        <p className="mb-8 text-sm text-slate-300">
          This starter flow authenticates a user and prepares the dashboard for
          the next trading UI steps.
        </p>
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <p className="mb-3 text-sm font-medium text-slate-200">Choose account type</p>
          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="radio"
              name="accountType"
              value="real"
              defaultChecked
              className="h-4 w-4 text-sky-500"
            />
            Real account
          </label>
          <label className="mt-2 flex items-center gap-3 text-sm text-slate-300">
            <input
              type="radio"
              name="accountType"
              value="demo"
              className="h-4 w-4 text-sky-500"
            />
            Demo account
          </label>
        </div>
        <button
          type="button"
          onClick={handleLogin}
          className="w-full rounded-full bg-sky-500 px-4 py-3 font-medium text-white transition hover:bg-sky-400"
        >
          Login with Deriv
        </button>
      </div>
    </main>
  );
}
