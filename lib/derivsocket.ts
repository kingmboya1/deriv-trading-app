"use client";

import { create, type StoreApi } from "zustand";

// ============================================================================
// Type Definitions
// ============================================================================

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

  newSocket.addEventListener("close", () => {
    console.log("[deriv-socket] connection closed");
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
      const contracts = portfolioObj.contracts as Record<string, unknown>[];
      const newPortfolio: Record<number, OpenContract> = {};

      for (const contract of contracts) {
        if (contract && typeof contract === "object") {
          const contractObj = contract as Record<string, unknown>;
          const contractId = contractObj.contract_id;

          if (typeof contractId === "number") {
            newPortfolio[contractId] = contractObj as OpenContract;
          }
        }
      }

      set({ portfolio: newPortfolio });
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
