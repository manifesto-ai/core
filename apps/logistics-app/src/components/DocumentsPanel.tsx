import { useState } from "react";
import type { LogisticsData } from "../App";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { FileText, AlertTriangle, CheckCircle, Package } from "lucide-react";

interface Props {
  data: LogisticsData;
  onOpenBL: (orderId: string) => void;
}

interface BlMeta {
  orderId: string;
  shipper: string;
  consignee: string;
  vessel: string;
  voyage: string;
}

interface UnipassItem {
  hsCode: string;
  containerNo: string;
  risk: string;
  description: string;
}

export function DocumentsPanel({ data, onOpenBL }: Props) {
  const [orderId, setOrderId] = useState("order-123");

  const meta = data.documentsMeta as BlMeta | null;
  const extracted = data.documentsExtracted as { containerNos?: string[]; hsCodes?: string[]; fields?: { key: string; value: string }[] } | null;
  const unipass = data.documentsUnipass as { items?: UnipassItem[] } | null;
  const isLoading = data.documentsStatus === "loading";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenBL(orderId);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex gap-4">
        <Input
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="Order ID"
          className="max-w-xs"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Processing..." : "Open Bill of Lading"}
        </Button>
      </form>

      {!meta ? (
        <div className="text-center py-12 text-muted-foreground">
          Enter an Order ID and click "Open Bill of Lading" to view document details
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                B/L Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Order ID:</span>
                <span className="font-medium">{meta.orderId}</span>
                <span className="text-muted-foreground">Shipper:</span>
                <span className="font-medium">{meta.shipper}</span>
                <span className="text-muted-foreground">Consignee:</span>
                <span className="font-medium">{meta.consignee}</span>
                <span className="text-muted-foreground">Vessel:</span>
                <span className="font-medium">{meta.vessel}</span>
                <span className="text-muted-foreground">Voyage:</span>
                <span className="font-medium">{meta.voyage}</span>
              </div>
            </CardContent>
          </Card>

          {extracted && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Extracted Fields
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">Containers:</span>
                  <div className="flex gap-2 mt-1">
                    {extracted.containerNos?.map((c) => (
                      <Badge key={c} variant="outline">{c}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">HS Codes:</span>
                  <div className="flex gap-2 mt-1">
                    {extracted.hsCodes?.map((h) => (
                      <Badge key={h} variant="secondary">{h}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {unipass?.items && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Customs Risk Check (Unipass)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {unipass.items.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        item.risk === "deny" ? "bg-destructive/10" : "bg-secondary/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.risk === "allow" ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                        )}
                        <div>
                          <div className="font-medium">{item.containerNo}</div>
                          <div className="text-sm text-muted-foreground">
                            HS: {item.hsCode} - {item.description}
                          </div>
                        </div>
                      </div>
                      <Badge variant={item.risk === "allow" ? "outline" : "destructive"}>
                        {item.risk === "allow" ? "Cleared" : "Requires License"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
