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
  is_expired?: 0 | 1;
  status?: string;
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

export interface CandleBar {
  time: number;   // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
}

interface DerivSocketStore {
  status: ConnectionStatus;
  /** Type of the currently connected account — derived from the live WS URL. */
  activeAccountType: "real" | "demo" | "unknown";
  balance: number | null;
  portfolio: Record<number, OpenContract>;
  /** Candle history keyed by symbol — populated by ticks_history + ohlc messages */
  candles: Record<string, CandleBar[]>;
  activeSymbols: { id: string; label: string }[];
  auth: SocketAuthState;
  connect: () => Promise<void>;
  reconnect: () => Promise<void>;
  send: (payload: Record<string, unknown>) => void;
  request: <T>(payload: Record<string, unknown>) => Promise<T>;
  setAuth: (auth: Partial<SocketAuthState>) => void;
}

type DerivSocketSet = StoreApi<DerivSocketStore>["setState"];

const normalizeBooleanFlag = (value: unknown): boolean => value === true || value === 1 || value === "1";

export const isContractSettled = (contract: Partial<OpenContract> | Record<string, unknown>): boolean => {
  if (normalizeBooleanFlag((contract as Record<string, unknown>).is_sold)) {
    return true;
  }

  if (normalizeBooleanFlag((contract as Record<string, unknown>).is_expired)) {
    return true;
  }

  if (typeof (contract as Record<string, unknown>).sell_time === "number") {
    return true;
  }

  const statusValue = (contract as Record<string, unknown>).status;
  const status = typeof statusValue === "string" ? statusValue.toLowerCase() : "";

  return ["won", "lost", "sold", "expired", "settled", "closed"].includes(status);
};

export const isContractSellable = (contract: Partial<OpenContract> | Record<string, unknown>): boolean => {
  if (!isContractSettled(contract)) {
    return true;
  }

  return false;
};

// ============================================================================
// Module-Level Variables (outside store, no re-renders triggered)
// ============================================================================

let socket: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: number | null = null;
const pendingRequests = new Map<number, PendingRequest>();
let nextReqId = 1;
const activeContractSubscriptions = new Map<number, number>();
let activeAccountIdentity: string | null = null;
// Set to true by reconnect() so the close-event handler knows the disconnect
// was intentional (account switch) and should NOT reset activeAccountType.
let intentionalClose = false;

// ============================================================================
// Intentional disconnect (logout) — closes socket without triggering reconnect
// ============================================================================

export const disconnectSocket = () => {
  clearReconnectTimer();
  reconnectAttempts = 0;
  // Reuse the intentionalClose flag so the close handler doesn't start
  // the reconnect loop or reset any store state we've already cleared.
  intentionalClose = true;

  if (socket && socket.readyState !== WebSocket.CLOSED) {
    socket.close();
    socket = null;
  }
};

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

  const authAccount = useDerivSocketStore.getState().auth.accountId ?? null;
  console.log("[deriv-socket] subscribing to proposal_open_contract", contractId, { authAccount });

  socket.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 }));
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

const getCookieValue = (name: string): string | null => {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.split("=")[1] ?? "");
};

const getAccountIdentityFromWsUrl = (wsUrl: string): string => {
  const accountId = getCookieValue("deriv_account_id") ?? "unknown";
  const accountPreference = getCookieValue("deriv_account_preference");
  const accountType = wsUrl.includes("/demo") ? "demo" : "real";
  const resolvedType = accountPreference === "demo" ? "demo" : accountPreference === "real" ? "real" : accountType;

  return `${resolvedType}:${accountId}`;
};

const resetAccountScopedState = (set: DerivSocketSet) => {
  set((state: DerivSocketStore) => ({
    ...state,
    activeAccountType: "unknown",
    balance: null,
    portfolio: {},
    candles: {},
    activeSymbols: [],
    auth: {
      accessToken: null,
      accountId: null,
      currency: null,
    },
  }));
};

// ============================================================================
// Zustand Store
// ============================================================================

export const useDerivSocketStore = create<DerivSocketStore>((set, get) => ({
  status: "Disconnected",
  activeAccountType: "unknown",
  balance: null,
  portfolio: {},
  candles: {},
  activeSymbols: [],
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

  // Force-reconnect — closes any existing socket and opens a fresh one.
  // Used by the account switcher after updating deriv_account_id.
  reconnect: async () => {
    clearReconnectTimer();
    reconnectAttempts = 0;

    // Mark that this close is intentional so the close-event handler does
    // NOT reset activeAccountType back to "unknown" (which would cause a
    // visible flash of the wrong badge in TradePanel / BalanceBar).
    intentionalClose = true;

    // Close existing socket cleanly; connectSocket will open a new one
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
      socket = null;
    }

    // Eagerly clear account-scoped data so no stale balance / portfolio
    // from the previous account is displayed while the new socket connects.
    resetAccountScopedState(set);

    try {
      set({ status: "Connecting" });
      const wsUrl = await fetchFreshWsUrl();
      connectSocket(wsUrl, set, get);
    } catch (error) {
      set({ status: "Disconnected" });
      console.error("[deriv-socket] Failed to reconnect:", error);
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

const requestWithTimeout = async <T,>(
  socketInstance: WebSocket,
  payload: Record<string, unknown>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  const reqId = nextReqId++;
  const payloadWithId = { ...payload, req_id: reqId };

  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pendingRequests.delete(reqId);
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    pendingRequests.set(reqId, {
      resolve: resolve as (value: unknown) => void,
      reject: (reason?: Error) => {
        window.clearTimeout(timeoutId);
        reject(reason);
      },
    });

    try {
      socketInstance.send(JSON.stringify(payloadWithId));
    } catch (error) {
      pendingRequests.delete(reqId);
      window.clearTimeout(timeoutId);
      reject(error instanceof Error ? error : new Error("Failed to send request"));
    }
  });
};

interface SellContractResult {
  success: boolean;
  error?: string;
  errorType?: "price_mismatch" | "contract_not_found" | "unknown";
  profit?: number;
  sellTime?: number;
}

const sellContract = async (contractId: number): Promise<SellContractResult> => {
  const getState = useDerivSocketStore.getState;
  const request = getState().request;
  const portfolio = getState().portfolio;

  // Get the current contract from portfolio
  const contract = portfolio[contractId];

  if (!contract) {
    return {
      success: false,
      error: "Contract not found in portfolio",
      errorType: "contract_not_found",
    };
  }

  // Get bid price from contract (should be available from proposal_open_contract updates)
  // For binary options, bid_price is typically the current sell price
  const bidPrice = (contract as Record<string, unknown>).bid_price as number | undefined;

  if (!bidPrice) {
    return {
      success: false,
      error: "Current bid price not available. Please try again.",
      errorType: "unknown",
    };
  }

  try {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return {
        success: false,
        error: "WebSocket is not connected",
        errorType: "unknown",
      };
    }

    const sellResponse = await requestWithTimeout<{ sell?: { status?: string; profit?: number; sell_time?: number }; error?: Record<string, unknown> }>(
      socket,
      {
        sell: contractId,
        price: bidPrice,
      },
      15_000,
      "Sell request timed out — please try again"
    );

    // Check for API errors
    if (sellResponse.error) {
      const errorObj = sellResponse.error as Record<string, unknown>;
      const errorMessage = String(errorObj.message ?? "Sell request failed");

      // Detect price mismatch errors (market moved)
      if (
        errorMessage.includes("price") ||
        errorMessage.includes("bid") ||
        errorMessage.includes("ask") ||
        errorMessage.includes("mismatch")
      ) {
        return {
          success: false,
          error: "Price changed — please try again to get the current bid.",
          errorType: "price_mismatch",
        };
      }

      return {
        success: false,
        error: errorMessage,
        errorType: "unknown",
      };
    }

    // Success case
    const sell = sellResponse.sell as Record<string, unknown> | undefined;
    return {
      success: true,
      profit: typeof sell?.profit === "number" ? sell.profit : undefined,
      sellTime: typeof sell?.sell_time === "number" ? sell.sell_time : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("price")) {
      return {
        success: false,
        error: "Price changed — please try again to get the current bid.",
        errorType: "price_mismatch",
      };
    }

    return {
      success: false,
      error: errorMessage,
      errorType: "unknown",
    };
  }
};

export { subscribeToContract, sellContract };

// ============================================================================
// Socket Connection & Message Handling
// ============================================================================

const connectSocket = (
  wsUrl: string,
  set: DerivSocketSet,
  get: () => DerivSocketStore
) => {
  clearReconnectTimer();

  const nextAccountIdentity = getAccountIdentityFromWsUrl(wsUrl);
  if (activeAccountIdentity !== null && activeAccountIdentity !== nextAccountIdentity) {
    resetAccountScopedState(set);
  }
  activeAccountIdentity = nextAccountIdentity;

  // Derive account type from the WS URL immediately — this is the single
  // source of truth that all UI badges (TradePanel, BalanceBar) read from.
  const accountTypeFromUrl: "real" | "demo" = wsUrl.includes("/demo") ? "demo" : "real";
  set({ activeAccountType: accountTypeFromUrl });

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    // Null handlers before closing so the close event doesn't spawn another reconnect
    socket.onopen    = null;
    socket.onclose   = null;
    socket.onerror   = null;
    socket.onmessage = null;
    socket.close();
  }

  console.log("[deriv-socket] opening websocket");
  const newSocket = new WebSocket(wsUrl);
  socket = newSocket;

  // Property assignment guarantees one handler per event slot — no stacking
  // across reconnect cycles (eliminates MaxListenersExceededWarning).

  newSocket.onopen = () => {
    if (socket !== newSocket) return; // superseded socket — ignore
    console.log("[deriv-socket] connection opened");
    reconnectAttempts = 0;
    set({ status: "Connected" });

    // Step 1: Authorize first — private subscriptions (balance, portfolio,
    // transaction) must only be sent AFTER a successful authorize response.
    // We read the token from the cookie; it was set by the OAuth callback.
    const token = getCookieValue("deriv_auth_token");

    try {
      if (token) {
        // Send authorize — private subscriptions are dispatched in handleMessage
        // under msg_type === "authorize" once the server confirms auth.
        newSocket.send(JSON.stringify({ authorize: token }));
      }

      // Public market data — safe to send immediately without auth.
      // Subscribe to default symbol candles so the chart has data on first load.
      newSocket.send(JSON.stringify({
        ticks_history: "R_10",
        style: "candles",
        granularity: 60,
        count: 100,
        end: "latest",
        subscribe: 1,
      }));
    } catch (error) {
      console.error("[deriv-socket] Failed to send on open:", error);
    }
  };

  newSocket.onclose = (event: CloseEvent) => {
    console.log("[deriv-socket] connection closed", { code: event.code, reason: event.reason });
    if (socket === newSocket) socket = null;

    if (intentionalClose) {
      intentionalClose = false;
      return;
    }

    // If a new socket is already connecting, skip scheduling another reconnect
    if (socket && socket.readyState === WebSocket.CONNECTING) return;

    if (reconnectAttempts >= 5) {
      set({ status: "Disconnected", activeAccountType: "unknown" });
      console.log("[deriv-socket] max reconnection attempts reached");
      return;
    }

    reconnectAttempts += 1;
    set({ status: "Reconnecting...", activeAccountType: "unknown" });

    reconnectTimer = window.setTimeout(() => {
      void reconnectAfterDelay(set, get);
    }, 2000);
  };

  newSocket.onerror = (event) => {
    console.error("[deriv-socket] websocket error:", event);
    if (socket === newSocket) set({ status: "Reconnecting..." });
  };

  newSocket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data as string) as Record<string, unknown>;
      handleMessage(payload, set, get);
    } catch (error) {
      console.error("[deriv-socket] failed to parse message:", error);
    }
  };
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

  // ── Handle authorize response — fire private subscriptions post-auth ──────
  if (payload.msg_type === "authorize" && !payload.error) {
    // Auth confirmed — now safe to send private account subscriptions
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        socket.send(JSON.stringify({ portfolio: 1 }));
        socket.send(JSON.stringify({ transaction: 1, subscribe: 1 }));
      } catch (err) {
        console.error("[deriv-socket] Failed to send post-auth subscriptions:", err);
      }
    }
    // Auth data itself is handled by updateAuthFromPayload above — fall through
    // to let pending requests resolve if this was a request-based authorize.
  }

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

  // Handle active_symbols response
  if (Array.isArray(payload.active_symbols)) {
    const symbols = (payload.active_symbols as Record<string, unknown>[])
      .filter((s) => s.is_trading_suspended === 0 || s.is_trading_suspended === false)
      .map((s) => ({
        id: String(s.symbol ?? ""),
        label: String(s.display_name ?? s.symbol ?? ""),
      }))
      .filter((s) => s.id !== "");
    if (symbols.length > 0) set({ activeSymbols: symbols });
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
        set({ balance: parsedBalance });
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
            subscribeToContract(contractId);
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
          is_sold: normalizeBooleanFlag(contractObj.is_sold),
          is_expired: normalizeBooleanFlag(contractObj.is_expired) ? 1 : 0,
          status: typeof contractObj.status === "string" ? contractObj.status : existing.status,
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
      const updatedPortfolio = { ...currentPortfolio };
      const existing = updatedPortfolio[contractId] || {};

      if (action === "sell" || isSold === true || isSold === 1) {
        // Remove sold contracts from the active portfolio view.
        delete updatedPortfolio[contractId];
        set({ portfolio: updatedPortfolio });
      } else {
        const normalizedTransaction = {
          ...existing,
          ...transaction,
          is_sold: normalizeBooleanFlag(transaction.is_sold),
          is_expired: normalizeBooleanFlag(transaction.is_expired) ? 1 : 0,
          status: typeof transaction.status === "string" ? transaction.status : existing.status,
        } as OpenContract;

        updatedPortfolio[contractId] = normalizedTransaction;
        set({ portfolio: updatedPortfolio });
      }
    }

    return;
  }

  // ── Handle candles (initial batch from ticks_history) ────────────────────
  if (payload.msg_type === "candles" && Array.isArray(payload.candles)) {
    // Extract the requested symbol from echo_req
    const echoReq = (payload as Record<string, unknown>).echo_req;
    const symbol =
      echoReq && typeof echoReq === "object"
        ? (echoReq as Record<string, unknown>).ticks_history
        : null;

    if (typeof symbol === "string" && symbol) {
      const bars = (payload.candles as Record<string, unknown>[])
        .map((c) => ({
          time:  Number(c.epoch),
          open:  Number(c.open),
          high:  Number(c.high),
          low:   Number(c.low),
          close: Number(c.close),
        }))
        .filter((c) => Number.isFinite(c.time) && c.time > 0);

      set((state) => ({
        candles: { ...state.candles, [symbol]: bars },
      }));
    }
    return;
  }

  // ── Handle ohlc (live 1-minute candle update) ─────────────────────────────
  if (payload.msg_type === "ohlc" && payload.ohlc && typeof payload.ohlc === "object") {
    const ohlc = payload.ohlc as Record<string, unknown>;
    const symbol = typeof ohlc.symbol === "string" ? ohlc.symbol : null;
    if (!symbol) return;

    const bar = {
      time:  Number(ohlc.open_time),
      open:  Number(ohlc.open),
      high:  Number(ohlc.high),
      low:   Number(ohlc.low),
      close: Number(ohlc.close),
    };

    if (!Number.isFinite(bar.time) || bar.time <= 0) return;

    set((state) => {
      const existing = state.candles[symbol] ?? [];
      const last = existing[existing.length - 1];
      // Same minute → update the last bar in-place; new minute → append
      const updated =
        last && last.time === bar.time
          ? [...existing.slice(0, -1), bar]
          : [...existing, bar];
      return { candles: { ...state.candles, [symbol]: updated } };
    });
    return;
  }
};
