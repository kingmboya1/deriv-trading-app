type TickMessage = {
  tick?: {
    symbol?: string;
    quote?: number;
    epoch?: number;
  };
};

export function connectDerivWS(otp: string, onTick: (price: number) => void) {
  if (typeof WebSocket === "undefined") {
    return null;
  }

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

      if (typeof price === "number") {
        onTick(price);
      }
    } catch {
      // Ignore malformed messages.
    }
  });

  return socket;
}

export function disconnectDerivWS(socket: WebSocket | null | undefined) {
  if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
    return;
  }

  socket.close();
}
