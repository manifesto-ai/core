import { useState } from "react";
import type { LogisticsData } from "../App";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { AlertTriangle, ArrowRight, Bell, Clock, Ship } from "lucide-react";

interface Props {
  data: LogisticsData;
  onProcess: (eventId: string, portCode: string, kind: string) => void;
}

interface ImpactedOrder {
  id: string;
  vesselName: string;
  customer: string;
  schedule: { eta: number; route: string };
}

interface Alternative {
  eta: number;
  route: string;
  deltaHours: number;
}

export function DisruptionPanel({ data, onProcess }: Props) {
  const [eventId, setEventId] = useState("typhoon-2024-01");
  const [portCode, setPortCode] = useState("USLAX");
  const [kind, setKind] = useState("typhoon");

  const impacted = data.disruptionImpactedOrders as Record<string, ImpactedOrder> | null;
  const alternatives = data.disruptionAlternatives as Record<string, Alternative> | null;
  const notification = data.disruptionNotification as { sent: number; timestamp: number } | null;
  const isLoading = data.disruptionStatus === "loading";

  const impactedList = Object.values(impacted ?? {});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onProcess(eventId, portCode, kind);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-4">
        <Input
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          placeholder="Event ID"
          className="w-48"
        />
        <Input
          value={portCode}
          onChange={(e) => setPortCode(e.target.value)}
          placeholder="Port Code"
          className="w-32"
        />
        <Input
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          placeholder="Event Type"
          className="w-32"
        />
        <Button type="submit" variant="destructive" disabled={isLoading}>
          {isLoading ? "Processing..." : "Process Disruption"}
        </Button>
      </form>

      {notification && (
        <Card className="border-primary">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <span className="font-medium">Notifications sent: {notification.sent}</span>
              <Badge variant="outline">
                {new Date(notification.timestamp).toLocaleTimeString()}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {impactedList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Enter disruption details and click "Process Disruption" to analyze impact
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Impacted Orders ({impactedList.length})
          </h3>

          <div className="grid gap-4">
            {impactedList.map((order) => {
              const alt = alternatives?.[order.id];
              const originalEta = new Date(order.schedule.eta).toLocaleDateString();
              const newEta = alt ? new Date(alt.eta).toLocaleDateString() : null;

              return (
                <Card key={order.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Ship className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{order.vesselName}</div>
                          <div className="text-sm text-muted-foreground">
                            {order.customer} • Order: {order.id}
                          </div>
                        </div>
                      </div>

                      {alt && (
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Original</div>
                            <div className="font-medium">{originalEta}</div>
                            <div className="text-xs text-muted-foreground">{order.schedule.route}</div>
                          </div>

                          <ArrowRight className="h-5 w-5 text-muted-foreground" />

                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Alternative</div>
                            <div className="font-medium text-primary">{newEta}</div>
                            <div className="text-xs text-muted-foreground">{alt.route}</div>
                          </div>

                          <Badge variant="destructive" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            +{alt.deltaHours}h
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
