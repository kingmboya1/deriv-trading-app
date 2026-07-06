type TickMessage = {
  tick?: {
    symbol?: string;
    quote?: number;
    epoch?: number;
  };
};

interface DerivWSConnection {
  socket: WebSocket;
  setCurrentSymbol: (symbol: string) => void;
}

export function connectDerivWS(otp: string, onTick: (price: number) => void): DerivWSConnection | null {
  if (typeof WebSocket === "undefined") {
    return null;
  }

  let currentSubscribedSymbol = "R_10";

  const socket = new WebSocket(
    `wss://api.derivws.com/trading/v1/options/ws/demo?otp=${encodeURIComponent(otp)}`
  );

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ ticks: "R_10", subscribe: 1 }));
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
  };
}

export function disconnectDerivWS(socket: WebSocket | null | undefined) {
  if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
    return;
  }

  socket.close();
}
