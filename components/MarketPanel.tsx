"use client";

import { useState } from "react";
import { PriceChart } from "@/components/PriceChart";
import { TradePanel } from "@/components/TradePanel";

interface MarketPanelProps {
  wsUrl: string;
}

export default function MarketPanel({ wsUrl }: MarketPanelProps) {
  const [selectedSymbol, setSelectedSymbol] = useState("R_10");
  const [currentSpot, setCurrentSpot] = useState<number | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <PriceChart onSymbolChange={setSelectedSymbol} onSpotChange={setCurrentSpot} />
      <TradePanel symbol={selectedSymbol} currentSpot={currentSpot} />
    </div>
  );
}
