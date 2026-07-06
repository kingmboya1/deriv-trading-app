"use client";

import { create, type StoreApi } from "zustand";

// ============================================================================
// Type Definitions
// ============================================================================

export interface ContractDetails {
  contract_id: number;
  contract_type: string;
  buy_price: string;
  payout: string;
  profit: string;
  status: string;
  is_expired: 0 | 1;
  [key: string]: unknown;
}

export interface OpenContract {
  contract_id: number;
  contract_type: string;
  buy_price: number;
  payout: number;
  profit: number;
  current_spot: number;
  is_sold: boolean;
  sell_time?: number;
  purchase_time?: number;
  [key: string]: unknown;
}

export interface TradeRecord {
  contract_id: number | string;
  contract_type: string;
  buy_price: number | string;
  payout: number | string;
  profit: number | string;
  sell_time?: number;
  purchase_time?: number;
  [key: string]: unknown;
}

type ConnectionStatus = "Connecting" | "Connected" | "Reconnecting..." | "Disconnected";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: Error) => void;
}

interface SocketAuthState {
  accessToken: string | null;
  accountId: string | null;
  currency: string | null;
}

interface DerivSocketStore {
  status: ConnectionStatus;
  balance: number | null;
  currency: string | null;
  portfolio: Record<number, OpenContract>;
  auth: SocketAuthState;
  connect: () => Promise<void>;
  send: (payload: Record<string, unknown>) => void;
  request: <T>(payload: Record<string, unknown>) => Promise<T>;
  setAuth: (auth: Partial<SocketAuthState>) => void;
}

type DerivSocketSet = StoreApi<DerivSocketStore>["setState"];

// ============================================================================
// Module-Level Variables (outside store, no re-renders triggered)
// ============================================================================

let socket: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: number | null = null;
const pendingRequests = new Map<number, PendingRequest>();
let nextReqId = 1;
const activeContractSubscriptions = new Map<number, number>();
const recentlyBoughtContracts = new Set<number>();

const getSubscriptionId = (payload: Record<string, unknown>): number | null => {
  const subscription = payload.subscription;

  if (!subscription || typeof subscription !== "object") {
    return null;
  }

  const id = (subscription as Record<string, unknown>).id;
  if (typeof id === "number") {
    return id;
  }

  if (typeof id === "string") {
    const numeric = Number(id);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
};

const forgetSubscription = (subscriptionId: number) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  console.log("[deriv-socket] forgetting subscription", subscriptionId);
  socket.send(JSON.stringify({ forget: subscriptionId }));
};

const subscribeToContract = (contractId: number) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("[deriv-socket] cannot subscribe to contract before socket is open", contractId);
    return;
  }

  if (activeContractSubscriptions.has(contractId)) {
    return;
  }

  // Log current auth/account at the moment of attempting subscription
  try {
    // `get` is available in the closure where subscribeToContract is used; if not, we still attempt to read via the exported hook
    const authAccount = typeof (useDerivSocketStore as any) === "function" && (useDerivSocketStore as any).getState
      ? (useDerivSocketStore as any).getState().auth.accountId
      : null;
    console.log("[deriv-socket] subscribing to proposal_open_contract", contractId, { authAccount });
  } catch (e) {
    console.log("[deriv-socket] subscribing to proposal_open_contract", contractId);
  }

  socket.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 }));
};

const getContractAccountId = (contractObj: Record<string, unknown>): string | null => {
  // Try common fields that might identify the account owning the contract
  const byKey = (key: string) => {
    const v = contractObj[key];
    return typeof v === "string" ? v : null;
  };

  if (byKey("account_id")) return byKey("account_id");
  if (byKey("loginid")) return byKey("loginid");
  if (byKey("account")) {
    const acct = contractObj["account"];
    if (acct && typeof acct === "object") {
      const a = acct as Record<string, unknown>;
      if (typeof a.account_id === "string") return a.account_id;
      if (typeof a.loginid === "string") return a.loginid;
    }
  }

  return null;
};

// ============================================================================
// Helper Functions
// ============================================================================

const clearReconnectTimer = () => {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const fetchFreshWsUrl = async (): Promise<string> => {
  const response = await fetch("/api/ws-token", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to fetch fresh websocket token");
  }

  const payload = (await response.json()) as { wsUrl?: string };

  if (!payload.wsUrl) {
    throw new Error("No websocket URL returned");
  }

  return payload.wsUrl;
};

// ============================================================================
// Zustand Store
// ============================================================================

export const useDerivSocketStore = create<DerivSocketStore>((set, get) => ({
  status: "Disconnected",
  balance: null,
  currency: null,
  portfolio: {},
  auth: {
    accessToken: null,
    accountId: null,
    currency: null,
  },

  connect: async () => {
    // Guard: if already connecting or connected, return (singleton pattern)
    const currentStatus = get().status;
    if (
      currentStatus === "Connecting" ||
      currentStatus === "Connected" ||
      (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING))
    ) {
      return;
    }

    try {
      set({ status: "Connecting" });
      const wsUrl = await fetchFreshWsUrl();
      connectSocket(wsUrl, set, get);
    } catch (error) {
      set({ status: "Disconnected" });
      console.error("[deriv-socket] Failed to connect:", error);
    }
  },

  send: (payload: Record<string, unknown>) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    socket.send(JSON.stringify(payload));
  },

  request: async <T,>(payload: Record<string, unknown>): Promise<T> => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    const reqId = nextReqId++;
    const payloadWithId = { ...payload, req_id: reqId };

    return new Promise<T>((resolve, reject) => {
      pendingRequests.set(reqId, { resolve: resolve as (value: unknown) => void, reject });

      try {
        socket!.send(JSON.stringify(payloadWithId));
      } catch (error) {
        pendingRequests.delete(reqId);
        reject(error instanceof Error ? error : new Error("Failed to send request"));
      }
    });
  },

  setAuth: (auth) =>
    set((state) => ({
      auth: {
        ...state.auth,
        ...auth,
      },
    })),
}));

const markContractBought = (contractId: number) => {
  recentlyBoughtContracts.add(contractId);
  // Remove after a short grace period to avoid unbounded growth
  window.setTimeout(() => recentlyBoughtContracts.delete(contractId), 60_000);
};

export { subscribeToContract, markContractBought };

// ============================================================================
// Socket Connection & Message Handling
// ============================================================================

const connectSocket = (
  wsUrl: string,
  set: DerivSocketSet,
  get: () => DerivSocketStore
) => {
  clearReconnectTimer();

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    socket.close();
  }

  console.log("[deriv-socket] opening websocket");
  const newSocket = new WebSocket(wsUrl);
  socket = newSocket;

  newSocket.addEventListener("open", () => {
    console.log("[deriv-socket] connection opened");
    reconnectAttempts = 0;
    set({ status: "Connected" });

    // Send three fire-and-forget subscription requests
    try {
      newSocket.send(JSON.stringify({ balance: 1, subscribe: 1 }));
      newSocket.send(JSON.stringify({ portfolio: 1 }));
      newSocket.send(JSON.stringify({ transaction: 1, subscribe: 1 }));
    } catch (error) {
      console.error("[deriv-socket] Failed to send subscriptions:", error);
    }
  });

  newSocket.addEventListener("close", (event: CloseEvent) => {
    console.log("[deriv-socket] connection closed", { code: event.code, reason: event.reason });
    socket = null;

    if (reconnectAttempts >= 5) {
      set({ status: "Disconnected" });
      console.log("[deriv-socket] max reconnection attempts reached");
      return;
    }

    reconnectAttempts += 1;
    set({ status: "Reconnecting..." });

    reconnectTimer = window.setTimeout(() => {
      void reconnectAfterDelay(set, get);
    }, 2000);
  });

  newSocket.addEventListener("error", (event) => {
    console.error("[deriv-socket] websocket error:", event);
    if (socket === newSocket) {
      set({ status: "Reconnecting..." });
    }
  });

  newSocket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data as string) as Record<string, unknown>;
      handleMessage(payload, set, get);
    } catch (error) {
      console.error("[deriv-socket] failed to parse message:", error);
    }
  });
};

const reconnectAfterDelay = async (set: DerivSocketSet, get: () => DerivSocketStore) => {
  try {
    const wsUrl = await fetchFreshWsUrl();
    connectSocket(wsUrl, set, get);
  } catch (error) {
    console.error("[deriv-socket] failed to fetch fresh ws url:", error);

    if (reconnectAttempts >= 5) {
      set({ status: "Disconnected" });
      return;
    }

    reconnectAttempts += 1;
    set({ status: "Reconnecting..." });

    reconnectTimer = window.setTimeout(() => {
      void reconnectAfterDelay(set, get);
    }, 2000);
  }
};

const handleMessage = (payload: Record<string, unknown>, set: DerivSocketSet, get: () => DerivSocketStore) => {
  const updateAuthFromPayload = (response: Record<string, unknown>) => {
    const authorizePayload = response.authorize;

    if (!authorizePayload || typeof authorizePayload !== "object") {
      return;
    }

    const authorizeData = authorizePayload as Record<string, unknown>;
    const currency = typeof authorizeData.currency === "string" ? authorizeData.currency : null;
    const accountId = typeof authorizeData.loginid === "string" ? authorizeData.loginid : null;
    const accessToken = typeof authorizeData.token === "string" ? authorizeData.token : null;

    if (currency || accountId || accessToken) {
      set((state: DerivSocketStore) => ({
        auth: {
          ...state.auth,
          accountId: accountId ?? state.auth?.accountId ?? null,
          accessToken: accessToken ?? state.auth?.accessToken ?? null,
          currency: currency ?? state.auth?.currency ?? null,
        },
      }));
    }
  };

  updateAuthFromPayload(payload);

  // Handle pending request resolution/rejection by req_id
  if (typeof payload.req_id === "number" && pendingRequests.has(payload.req_id)) {
    const pending = pendingRequests.get(payload.req_id)!;
    pendingRequests.delete(payload.req_id);

    if (payload.error && typeof payload.error === "object") {
      const errorObj = payload.error as Record<string, unknown>;
      const errorMessage = errorObj.message ?? "Unknown error";
      pending.reject(new Error(String(errorMessage)));
    } else {
      pending.resolve(payload);
    }

    return;
  }

  // Handle balance subscription
  if (payload.balance && typeof payload.balance === "object") {
    const balanceObj = payload.balance as Record<string, unknown>;
    const balanceValue = balanceObj.balance;
    const currency = balanceObj.currency;

    if ((typeof balanceValue === "number" || typeof balanceValue === "string") && typeof currency === "string") {
      const parsedBalance = Number.parseFloat(String(balanceValue));
      if (Number.isFinite(parsedBalance)) {
        set({ balance: parsedBalance, currency });
        set((state: DerivSocketStore) => ({
          auth: {
            ...state.auth,
            currency,
          },
        }));
      }
    }

    return;
  }

  // Handle portfolio subscription
  if (payload.portfolio && typeof payload.portfolio === "object") {
    const portfolioObj = payload.portfolio as Record<string, unknown>;

    if (Array.isArray(portfolioObj.contracts)) {
      console.log("PORTFOLIO_DEBUG:", portfolioObj.contracts);
      const contracts = portfolioObj.contracts as Record<string, unknown>[];
      const newPortfolio: Record<number, OpenContract> = {};

      for (const contract of contracts) {
        if (contract && typeof contract === "object") {
          const contractObj = contract as Record<string, unknown>;
          const contractId = contractObj.contract_id;

          if (typeof contractId === "number") {
            newPortfolio[contractId] = contractObj as OpenContract;

            // Only subscribe to contracts that belong to the currently authorized account
            const contractOwner = getContractAccountId(contractObj);
            const currentAccount = get().auth.accountId;

            if (contractOwner === null) {
              // If this contract was just bought in this session, allow subscription even without account metadata
              if (recentlyBoughtContracts.has(contractId)) {
                console.log('[deriv-socket] subscribing to recently-bought contract without account metadata', contractId);
                subscribeToContract(contractId);
              } else {
                console.warn("[deriv-socket] contract has no account info; skipping subscribe", contractId, contractObj);
              }
            } else if (currentAccount && contractOwner !== currentAccount) {
              console.log(
                "[deriv-socket] skipping subscribe for contract from different account",
                contractId,
                { contractOwner, currentAccount }
              );
            } else {
              subscribeToContract(contractId);
            }
          }
        }
      }

      set({ portfolio: newPortfolio });
    }

    return;
  }

  // Handle live proposal_open_contract updates
  if (payload.proposal_open_contract && typeof payload.proposal_open_contract === "object") {
    if (payload.error) {
      console.error("[deriv-socket] proposal_open_contract subscription error:", payload.error);
      return;
    }

    try {
      const contractObj = payload.proposal_open_contract as Record<string, unknown>;
      const contractId = contractObj.contract_id;

      // ===== RAW RESPONSE LOGGING =====
      console.log("[deriv-socket] RAW proposal_open_contract response:", {
        contractId,
        fullPayload: payload,
        contractObjKeys: Object.keys(contractObj),
        contractObj,
        hasContractType: "contract_type" in contractObj,
        contractTypeValue: contractObj.contract_type,
        hasBuyPrice: "buy_price" in contractObj,
        buyPriceValue: contractObj.buy_price,
        hasProfit: "profit" in contractObj,
        profitValue: contractObj.profit,
        hasPayout: "payout" in contractObj,
        payoutValue: contractObj.payout,
        status: contractObj.status,
        isExpired: contractObj.is_expired,
      });
      // ===== END RAW RESPONSE LOGGING =====
      const status = typeof contractObj.status === "string" ? contractObj.status : "";
      const isExpired =
        contractObj.is_expired === 1 || contractObj.is_expired === "1"
          ? 1
          : 0;
      const subscriptionId = getSubscriptionId(payload);

      if (typeof contractId === "number") {
        const currentPortfolio = get().portfolio;
        const existing = currentPortfolio[contractId] || {};
        const buyPriceValue = contractObj.buy_price ?? existing.buy_price ?? "0";
        const payoutValue = contractObj.payout ?? existing.payout ?? "0";
        const profitValue = contractObj.profit ?? existing.profit ?? "0";
        const buyPrice = typeof buyPriceValue === "string" ? buyPriceValue : String(buyPriceValue);
        const payout = typeof payoutValue === "string" ? payoutValue : String(payoutValue);
        const profit = typeof profitValue === "string" ? profitValue : String(profitValue);
        const contractType = typeof contractObj.contract_type === "string" ? contractObj.contract_type : existing.contract_type ?? "";

        const nextContract: OpenContract = {
          ...existing,
          ...contractObj,
          contract_id: contractId,
          contract_type: contractType,
          buy_price: typeof buyPrice === "string" ? parseFloat(buyPrice) : buyPrice,
          payout: typeof payout === "string" ? parseFloat(payout) : payout,
          profit: typeof profit === "string" ? parseFloat(profit) : profit,
          current_spot: typeof contractObj.current_spot === "number" ? contractObj.current_spot : existing.current_spot ?? 0,
          is_sold: contractObj.is_sold === true || contractObj.is_sold === 1,
        } as OpenContract;

        set((state: DerivSocketStore) => ({
          portfolio: {
            ...state.portfolio,
            [contractId]: nextContract,
          },
        }));

        if (subscriptionId !== null) {
          activeContractSubscriptions.set(contractId, subscriptionId);
        }

        if (isExpired || status === "won" || status === "lost") {
          if (subscriptionId !== null) {
            forgetSubscription(subscriptionId);
          } else {
            const activeId = activeContractSubscriptions.get(contractId);
            if (typeof activeId === "number") {
              forgetSubscription(activeId);
              activeContractSubscriptions.delete(contractId);
            }
          }
        }
      }
    } catch (err) {
      console.error('[deriv-socket] proposal_open_contract handler error', err, payload);
    }

    return;
  }

  // Handle transaction (updates to individual contracts)
  if (payload.transaction && typeof payload.transaction === "object") {
    const transaction = payload.transaction as Record<string, unknown>;
    const contractId = transaction.contract_id;
    const action = transaction.action;
    const isSold = transaction.is_sold;

    if (typeof contractId === "number") {
      const currentPortfolio = get().portfolio;

      if (action === "sell" || isSold === true || isSold === 1) {
        // Delete the contract from portfolio
        const updatedPortfolio = { ...currentPortfolio };
        delete updatedPortfolio[contractId];
        set({ portfolio: updatedPortfolio });
      } else {
        // Merge transaction fields into existing entry or create new one
        const updatedPortfolio = { ...currentPortfolio };
        const existing = updatedPortfolio[contractId] || {};
        updatedPortfolio[contractId] = { ...existing, ...transaction } as OpenContract;
        set({ portfolio: updatedPortfolio });
      }
    }

    return;
  }
};
