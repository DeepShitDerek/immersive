"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoldingsPanel } from "./holdings-panel";
import { PricesPanel } from "./prices-panel";
import { RoomPanel } from "./room-panel";
import { TradesPanel } from "./trades-panel";
import { useUrlTab } from "@/hooks/use-url-tab";

const TABS = ["holdings", "trades", "prices", "room"] as const;

/** Investing: holdings, trades, securities and prices, and contribution room. */
export function InvestArea() {
  // In the URL (?tab=), so Back and a reload return to it.
  const [tab, setTab] = useUrlTab("holdings", TABS);
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-5">
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList>
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="trades">Trades</TabsTrigger>
          <TabsTrigger value="prices">Securities &amp; prices</TabsTrigger>
          <TabsTrigger value="room">Contribution room</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="holdings">
        <HoldingsPanel />
      </TabsContent>
      <TabsContent value="trades">
        <TradesPanel />
      </TabsContent>
      <TabsContent value="prices">
        <PricesPanel />
      </TabsContent>
      <TabsContent value="room">
        <RoomPanel />
      </TabsContent>
    </Tabs>
  );
}
