"use client";

import { useState } from "react";
import { PriceChart } from "@/components/PriceChart";
import { TradePanel } from "@/components/TradePanel";

interface MarketPanelProps {
  wsUrl: string;
}

export default function MarketPanel({ wsUrl }: MarketPanelProps) {
  const [selectedSymbol, setSelectedSymbol] = useState("R_10");

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <PriceChart onSymbolChange={setSelectedSymbol} />
      <TradePanel symbol={selectedSymbol} />
    </div>
  );
}
