import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import BalanceBar from "@/components/BalanceBar";
import MarketPanel from "@/components/MarketPanel";
import Portfolio from "@/components/Portfolio";

type DerivAccount = {
  account_type?: string;
  balance?: string | number;
  account?: {
    balance?: string | number;
  };
};

type DerivAccountsResponse = {
  data?: DerivAccount[];
  balance?: string | number;
  accounts?: DerivAccount[];
};

type DerivOtpResponse = {
  data?: {
    url?: string;
  };
};

function parseBalance(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function fetchAccountBalances(token: string): Promise<{ realBalance: number; demoBalance: number }> {
  const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "";

  if (!token || !appId) {
    return { realBalance: 0, demoBalance: 0 };
  }

  try {
    const response = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Deriv-App-ID": appId,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return { realBalance: 0, demoBalance: 0 };
    }

    const apiResponse = (await response.json()) as DerivAccountsResponse;
    const accounts = apiResponse.data ?? [];
    const realAccount = accounts.find((account) => account.account_type === "real");
    const demoAccount = accounts.find((account) => account.account_type === "demo");
    const realBalance = Number.parseFloat(realAccount?.balance?.toString() ?? "0");
    const demoBalance = Number.parseFloat(demoAccount?.balance?.toString() ?? "0");

    return { realBalance, demoBalance };
  } catch {
    return { realBalance: 0, demoBalance: 0 };
  }
}

async function fetchWsUrl(token: string, accountId: string): Promise<string> {
  const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "";

  if (!token || !accountId || !appId) {
    return "";
  }

  try {
    const otpUrl = `https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`;
    const response = await fetch(otpUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Deriv-App-ID": appId,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return "";
    }

    const responseText = await response.text();
    const responseBody = JSON.parse(responseText) as DerivOtpResponse;
    return responseBody.data?.url ?? "";
  } catch {
    return "";
  }
}

export default async function DashboardPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("deriv_auth_token")?.value;
  const accountId = cookieStore.get("deriv_account_id")?.value;

  if (!token) {
    redirect("/login");
  }

  const balances = await fetchAccountBalances(token);
  const { realBalance, demoBalance } = balances;
  const wsUrl = await fetchWsUrl(token, accountId ?? "");
  console.log("[dashboard] wsUrl being passed to TradePanel", wsUrl);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-400">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Welcome, you are logged in</h1>
          <p className="mt-3 text-sm text-slate-300">
            Authentication is now wired end to end. Trading UI components will
            be added next.
          </p>
        </header>

        <BalanceBar realBalance={realBalance} demoBalance={demoBalance} wsUrl={wsUrl} />

        <MarketPanel wsUrl={wsUrl} />

        <Portfolio wsUrl={wsUrl} />
      </div>
    </main>
  );
}
