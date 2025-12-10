"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code } from "lucide-react";
import type { GeneratedSchema } from "@/lib/types/schema";

interface SchemaViewerProps {
  schema: GeneratedSchema;
}

export function SchemaViewer({ schema }: SchemaViewerProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Code className="h-4 w-4" />
          Schema
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <pre className="text-xs bg-muted p-4 rounded-md overflow-auto h-full">
          <code>{JSON.stringify(schema, null, 2)}</code>
        </pre>
      </CardContent>
    </Card>
  );
}
