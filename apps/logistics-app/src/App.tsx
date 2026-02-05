import { useEffect, useState, useCallback, useMemo } from "react";
import { createApp } from "@manifesto-ai/app";
import type { AppState } from "@manifesto-ai/app";
import { compileMelDomain } from "@manifesto-ai/compiler";
import type { DomainSchema } from "@manifesto-ai/core";
import ShipmentMel from "./domain/shipment.mel";
import { logisticsEffects } from "./domain/effects";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { TrackingDashboard } from "./components/TrackingDashboard";
import { QuotingPanel } from "./components/QuotingPanel";
import { DocumentsPanel } from "./components/DocumentsPanel";
import { DisruptionPanel } from "./components/DisruptionPanel";
import { Ship, FileText, DollarSign, AlertTriangle } from "lucide-react";

// =============================================================================
// Types
// =============================================================================

export interface LogisticsData {
  // Tracking
  trackingCustomerId: string | null;
  trackingShipments: Record<string, unknown>;
  trackingSignals: Record<string, unknown> | null;
  trackingEffective: Record<string, unknown>;
  trackingStatus: string;
  // Quoting
  quotingActiveId: string | null;
  quotingCredit: { limit: number; used: number; available: number } | null;
  quotingQuotes: Record<string, unknown> | null;
  quotingStatus: string;
  // Documents
  documentsOrderId: string | null;
  documentsMeta: Record<string, unknown> | null;
  documentsExtracted: Record<string, unknown> | null;
  documentsUnipass: Record<string, unknown> | null;
  documentsRiskyItems: unknown[] | null;
  documentsStatus: string;
  // Disruption
  disruptionEventId: string | null;
  disruptionImpactedOrders: Record<string, unknown> | null;
  disruptionAlternatives: Record<string, unknown> | null;
  disruptionBeforeAfter: Record<string, unknown> | null;
  disruptionNotification: { sent: number; timestamp: number } | null;
  disruptionStatus: string;
}

// =============================================================================
// Schema & Host Setup
// =============================================================================

function compileLogisticsSchema(): DomainSchema {
  const result = compileMelDomain(ShipmentMel, { mode: "domain" });
  if (result.errors.length > 0) {
    throw new Error(`MEL compilation failed: ${result.errors.map(e => e.message).join(", ")}`);
  }
  if (!result.schema) {
    throw new Error("MEL compilation produced no schema");
  }
  return result.schema as DomainSchema;
}

const logisticsSchema = compileLogisticsSchema();

// =============================================================================
// App Instance (v2.3.0 Effects-first API)
// =============================================================================

const logisticsApp = createApp({
  schema: logisticsSchema,
  effects: logisticsEffects,
});

export { logisticsApp };

// =============================================================================
// Component
// =============================================================================

export function App() {
  const [state, setState] = useState<AppState<LogisticsData> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState("tracking");

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      await logisticsApp.ready();
      setIsReady(true);
      setState(logisticsApp.getState<LogisticsData>());

      unsubscribe = logisticsApp.subscribe(
        (s) => s,
        (s) => setState(s as AppState<LogisticsData>),
        { batchMode: "immediate" }
      );
    };

    init().catch(console.error);
    return () => unsubscribe?.();
  }, []);

  // Actions
  const refreshDashboard = useCallback(
    (customerId: string) => logisticsApp.act("refreshDashboard", { customerId }).done(),
    []
  );

  const requestQuote = useCallback(
    (customerId: string, origin: string, destination: string) =>
      logisticsApp.act("requestQuote", { customerId, origin, destination }).done(),
    []
  );

  const openBillOfLading = useCallback(
    (orderId: string) => logisticsApp.act("openBillOfLading", { orderId }).done(),
    []
  );

  const processDisruption = useCallback(
    (eventId: string, portCode: string, kind: string) =>
      logisticsApp.act("processDisruption", { eventId, portCode, kind }).done(),
    []
  );

  const data = useMemo(() => state?.data ?? ({} as LogisticsData), [state]);

  if (!isReady || !state) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading Global Ocean Logistics...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <Card className="max-w-6xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Ship className="h-6 w-6" />
                Global Ocean Logistics
              </CardTitle>
              <CardDescription>Powered by MEL + @manifesto-ai/app</CardDescription>
            </div>
            <Badge variant="outline">v{state.meta.version}</Badge>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="tracking" className="flex items-center gap-2">
                <Ship className="h-4 w-4" />
                Tracking
              </TabsTrigger>
              <TabsTrigger value="quotes" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Quotes
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="disruptions" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Disruptions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tracking" className="mt-6">
              <TrackingDashboard
                data={data}
                onRefresh={refreshDashboard}
              />
            </TabsContent>

            <TabsContent value="quotes" className="mt-6">
              <QuotingPanel
                data={data}
                onRequestQuote={requestQuote}
              />
            </TabsContent>

            <TabsContent value="documents" className="mt-6">
              <DocumentsPanel
                data={data}
                onOpenBL={openBillOfLading}
              />
            </TabsContent>

            <TabsContent value="disruptions" className="mt-6">
              <DisruptionPanel
                data={data}
                onProcess={processDisruption}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
