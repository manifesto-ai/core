"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database } from "lucide-react";

interface SnapshotViewerProps {
  data: Record<string, unknown>;
}

export function SnapshotViewer({ data }: SnapshotViewerProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Database className="h-4 w-4" />
          Snapshot (Live Data)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <pre className="text-xs bg-muted p-4 rounded-md overflow-auto h-full">
          <code>{JSON.stringify({ data }, null, 2)}</code>
        </pre>
      </CardContent>
    </Card>
  );
}
