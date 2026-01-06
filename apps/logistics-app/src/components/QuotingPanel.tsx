import { useState } from "react";
import type { LogisticsData } from "../App";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { DollarSign, Clock, Check, X } from "lucide-react";

interface Props {
  data: LogisticsData;
  onRequestQuote: (customerId: string, origin: string, destination: string) => void;
}

interface Quote {
  carrierId: string;
  name: string;
  price: number;
  currency: string;
  transitDays: number;
  status: string;
  receivedWithinMs: number;
}

export function QuotingPanel({ data, onRequestQuote }: Props) {
  const [customerId, setCustomerId] = useState("customer-1");
  const [origin, setOrigin] = useState("KRPUS");
  const [destination, setDestination] = useState("USLAX");

  const quotes = (data.quotingQuotes ?? {}) as Record<string, Quote>;
  const credit = data.quotingCredit;
  const quoteList = Object.values(quotes);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRequestQuote(customerId, origin, destination);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-4">
        <Input
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="Customer ID"
          className="w-40"
        />
        <Input
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="Origin Port"
          className="w-32"
        />
        <Input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Destination Port"
          className="w-32"
        />
        <Button type="submit">Request Quotes</Button>
      </form>

      {credit && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Credit Available:</span>
              <Badge variant="outline" className="text-lg">
                ${credit.available.toLocaleString()}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {quoteList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Enter route details and click "Request Quotes" to get carrier rates
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {quoteList.map((quote) => (
            <Card key={quote.carrierId} className={quote.status !== "ok" ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{quote.name}</CardTitle>
                  <Badge variant={quote.status === "ok" ? "default" : "secondary"}>
                    {quote.status === "ok" ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                    {quote.status === "ok" ? "Available" : "Timeout"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-2xl font-bold">
                  <DollarSign className="h-5 w-5" />
                  {quote.price.toLocaleString()} {quote.currency}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {quote.transitDays} days transit
                </div>
                <div className="text-xs text-muted-foreground">
                  Response time: {quote.receivedWithinMs}ms
                  {quote.receivedWithinMs <= 3000 && (
                    <Badge variant="outline" className="ml-2 text-xs">Fast</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
