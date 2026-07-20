import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { type AccountEntry } from "@/components/AccountSwitcher";

type DerivAccount = {
  account_type?: string;
  balance?: string | number;
};

type DerivAccountsResponse = {
  data?: DerivAccount[];
};

type DerivOtpResponse = {
  data?: { url?: string };
};

function parseBalance(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function fetchAccountBalances(token: string): Promise<{ realBalance: number; demoBalance: number }> {
  const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "";
  if (!token || !appId) return { realBalance: 0, demoBalance: 0 };

  try {
    const response = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
      headers: { Authorization: `Bearer ${token}`, "Deriv-App-ID": appId },
      cache: "no-store",
    });
    if (!response.ok) return { realBalance: 0, demoBalance: 0 };

    const apiResponse = (await response.json()) as DerivAccountsResponse;
    const accounts = apiResponse.data ?? [];
    const realBalance = parseBalance(accounts.find((a) => a.account_type === "real")?.balance) ?? 0;
    const demoBalance = parseBalance(accounts.find((a) => a.account_type === "demo")?.balance) ?? 0;
    return { realBalance, demoBalance };
  } catch {
    return { realBalance: 0, demoBalance: 0 };
  }
}

async function fetchWsUrl(token: string, accountId: string): Promise<string> {
  const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "";
  if (!token || !accountId || !appId) return "";

  try {
    const response = await fetch(
      `https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Deriv-App-ID": appId },
        cache: "no-store",
      }
    );
    if (!response.ok) return "";
    const body = JSON.parse(await response.text()) as DerivOtpResponse;
    return body.data?.url ?? "";
  } catch {
    return "";
  }
}

export default async function DashboardPage() {
  const cookieStore = cookies();
  const token     = cookieStore.get("deriv_auth_token")?.value;
  const accountId = cookieStore.get("deriv_account_id")?.value;

  if (!token) redirect("/");

  let accounts: AccountEntry[] = [];
  const accountsRaw = cookieStore.get("deriv_accounts")?.value;
  if (accountsRaw) {
    try { accounts = JSON.parse(accountsRaw) as AccountEntry[]; } catch { /* ignore */ }
  }

  const { realBalance, demoBalance } = await fetchAccountBalances(token);
  const wsUrl = await fetchWsUrl(token, accountId ?? "");

  return (
    <DashboardShell
      accountId={accountId ?? ""}
      accounts={accounts}
      realBalance={realBalance}
      demoBalance={demoBalance}
      wsUrl={wsUrl}
    />
  );
}
