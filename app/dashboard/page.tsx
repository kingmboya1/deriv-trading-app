import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import BalanceBar from "@/components/BalanceBar";
import MarketPanel from "@/components/MarketPanel";
import Portfolio from "@/components/Portfolio";
import AccountSwitcher, { type AccountEntry } from "@/components/AccountSwitcher";

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
    const realBalance = parseBalance(realAccount?.balance) ?? 0;
    const demoBalance = parseBalance(demoAccount?.balance) ?? 0;

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
    redirect("/");
  }

  // Parse stored account list for the switcher
  let accounts: AccountEntry[] = [];
  const accountsRaw = cookieStore.get("deriv_accounts")?.value;
  if (accountsRaw) {
    try {
      accounts = JSON.parse(accountsRaw) as AccountEntry[];
    } catch {
      // Ignore — falls back to empty, switcher shows single-account badge
    }
  }

  const balances = await fetchAccountBalances(token);
  const { realBalance, demoBalance } = balances;
  const wsUrl = await fetchWsUrl(token, accountId ?? "");
  const connectedAccountType = wsUrl.includes("/demo") ? "demo" : wsUrl ? "real" : "unknown";
  console.log("[dashboard] wsUrl being passed to TradePanel", wsUrl);

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 text-primary">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface px-6 py-5">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Dashboard
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-semibold text-primary">
              Trading Platform
            </h1>
          </div>
          {/* Account switcher — replaces the static DEMO/REAL badge */}
          <AccountSwitcher
            activeAccountId={accountId ?? ""}
            accounts={accounts}
          />
        </header>

        <BalanceBar realBalance={realBalance} demoBalance={demoBalance} connectedAccountType={connectedAccountType} />

        <MarketPanel wsUrl={wsUrl} />

        <Portfolio />
      </div>
    </main>
  );
}
