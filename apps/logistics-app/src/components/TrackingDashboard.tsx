import { useState } from "react";
import type { LogisticsData } from "../App";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { MapPin, Ship, Clock, AlertCircle } from "lucide-react";

interface Props {
  data: LogisticsData;
  onRefresh: (customerId: string) => void;
}

export function TrackingDashboard({ data, onRefresh }: Props) {
  const [customerId, setCustomerId] = useState("customer-1");

  const shipments = data.trackingShipments as Record<string, {
    id: string;
    vesselName: string;
    origin: string;
    destination: string;
    schedule: { eta: number; route: string };
  }>;

  const signals = data.trackingSignals as {
    ais?: { positionsByShipment: Record<string, { lat: number; lng: number }> };
    tos?: { portCongestionIndexByPort: Record<string, number> };
    weather?: { typhoonDelayIndexByLane: Record<string, number> };
  } | null;

  const isLoading = data.trackingStatus === "loading";
  const shipmentList = Object.values(shipments || {});

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Input
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="Customer ID"
          className="max-w-xs"
        />
        <Button onClick={() => onRefresh(customerId)} disabled={isLoading}>
          {isLoading ? "Loading..." : "Refresh Dashboard"}
        </Button>
      </div>

      {shipmentList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Click "Refresh Dashboard" to load shipment data
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shipmentList.map((shipment) => {
            const position = signals?.ais?.positionsByShipment[shipment.id];
            const congestion = signals?.tos?.portCongestionIndexByPort[shipment.destination?.split(", ")[0]] ?? 0;
            const eta = new Date(shipment.schedule.eta).toLocaleDateString();

            return (
              <Card key={shipment.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Ship className="h-4 w-4" />
                      {shipment.vesselName}
                    </CardTitle>
                    <Badge variant={congestion > 0.3 ? "destructive" : "secondary"}>
                      {congestion > 0.3 ? "Delayed" : "On Time"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{shipment.origin} → {shipment.destination}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>ETA: {eta}</span>
                  </div>
                  {position && (
                    <div className="text-xs text-muted-foreground">
                      Position: {position.lat.toFixed(2)}°N, {position.lng.toFixed(2)}°E
                    </div>
                  )}
                  {congestion > 0.3 && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      Port congestion: {(congestion * 100).toFixed(0)}%
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
