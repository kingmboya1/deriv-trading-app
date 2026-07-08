type TickMessage = {
  tick?: {
    symbol?: string;
    quote?: number;
    epoch?: number;
  };
};

type ConnectionStatus = "connecting" | "connected" | "failed" | "closed";

interface DerivWSConnection {
  socket: WebSocket;
  setCurrentSymbol: (symbol: string) => void;
  getStatus: () => ConnectionStatus;
}

interface ConnectDerivWSOptions {
  wsUrl?: string;
  onStatusChange?: (status: ConnectionStatus) => void;
}

function buildWebSocketUrl(otp: string, wsUrl?: string): string {
  if (wsUrl) {
    try {
      const parsedUrl = new URL(wsUrl);
      parsedUrl.searchParams.set("otp", otp);
      return parsedUrl.toString();
    } catch {
      // Fall back to the demo endpoint when the provided URL is invalid.
    }
  }

  return `wss://api.derivws.com/trading/v1/options/ws/demo?otp=${encodeURIComponent(otp)}`;
}

export function connectDerivWS(
  otp: string,
  onTick: (price: number) => void,
  options: ConnectDerivWSOptions = {}
): DerivWSConnection | null {
  if (typeof WebSocket === "undefined") {
    return null;
  }

  let currentSubscribedSymbol = "R_10";
  let connectionStatus: ConnectionStatus = "connecting";

  const updateStatus = (status: ConnectionStatus) => {
    connectionStatus = status;
    options.onStatusChange?.(status);
  };

  const socket = new WebSocket(buildWebSocketUrl(otp, options.wsUrl));

  socket.addEventListener("open", () => {
    updateStatus("connected");
    socket.send(JSON.stringify({ ticks: "R_10", subscribe: 1 }));
  });

  socket.addEventListener("error", () => {
    updateStatus("failed");
  });

  socket.addEventListener("close", () => {
    updateStatus("closed");
  });

  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data as string) as TickMessage;
      const price = payload.tick?.quote;
      const tickSymbol = payload.tick?.symbol;

      // Only process ticks from the currently subscribed symbol
      if (typeof price === "number" && tickSymbol === currentSubscribedSymbol) {
        onTick(price);
      }
    } catch {
      // Ignore malformed messages.
    }
  });

  return {
    socket,
    setCurrentSymbol: (symbol: string) => {
      currentSubscribedSymbol = symbol;
    },
    getStatus: () => connectionStatus,
  };
}

export function disconnectDerivWS(socket: WebSocket | null | undefined) {
  if (
    !socket ||
    socket.readyState === WebSocket.CLOSED ||
    socket.readyState === WebSocket.CLOSING ||
    socket.readyState === WebSocket.CONNECTING
  ) {
    return;
  }

  socket.close();
}
