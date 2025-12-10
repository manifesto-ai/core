"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SchemaViewer } from "@/components/viewers/SchemaViewer";
import { SnapshotViewer } from "@/components/viewers/SnapshotViewer";
import { DynamicForm } from "@/components/form/DynamicForm";
import { AgentPanel } from "@/components/chat/AgentPanel";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw } from "lucide-react";
import type { GeneratedSchema } from "@/lib/types/schema";
import {
  createRuntimeFromSchema,
  getDefaultValues,
  getFormDataFromRuntime,
  setRuntimeValue,
  type DomainRuntime,
} from "@/lib/manifesto/json-to-domain";

export default function StudioPage() {
  const router = useRouter();
  const [schema, setSchema] = useState<GeneratedSchema | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Runtime ref to persist across renders
  const runtimeRef = useRef<DomainRuntime<Record<string, unknown>, Record<string, unknown>> | null>(null);

  // Load schema and initialize runtime
  useEffect(() => {
    const storedSchema = sessionStorage.getItem("manifesto-schema");
    if (storedSchema) {
      try {
        const parsedSchema = JSON.parse(storedSchema) as GeneratedSchema;
        setSchema(parsedSchema);

        // Create Manifesto runtime
        const runtime = createRuntimeFromSchema(parsedSchema);
        runtimeRef.current = runtime;

        // Get initial data from runtime
        setFormData(getFormDataFromRuntime(runtime));

        // Subscribe to runtime changes
        runtime.subscribe((snapshot) => {
          setFormData(snapshot.data);
        });
      } catch {
        router.push("/");
      }
    } else {
      router.push("/");
    }
    setIsLoading(false);
  }, [router]);

  const handleDataChange = useCallback((data: Record<string, unknown>) => {
    if (!runtimeRef.current) return;

    // Update runtime with new values
    for (const [key, value] of Object.entries(data)) {
      if (formData[key] !== value) {
        setRuntimeValue(runtimeRef.current, key, value);
      }
    }
  }, [formData]);

  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    if (!runtimeRef.current) return;
    setRuntimeValue(runtimeRef.current, fieldName, value);
  }, []);

  const handleReset = useCallback(() => {
    if (schema && runtimeRef.current) {
      const defaults = getDefaultValues(schema.fields);
      for (const [key, value] of Object.entries(defaults)) {
        setRuntimeValue(runtimeRef.current, key, value);
      }
    }
  }, [schema]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!schema) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold">{schema.name}</h1>
            <p className="text-xs text-muted-foreground">{schema.description}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </header>

      {/* Main Content - 3 Column Layout + Agent Panel */}
      <main className="flex-1 container py-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-8rem)]">
          {/* Left: Schema Viewer */}
          <div className="lg:col-span-1 overflow-hidden">
            <SchemaViewer schema={schema} />
          </div>

          {/* Center: Snapshot Viewer */}
          <div className="lg:col-span-1 overflow-hidden">
            <SnapshotViewer data={formData} />
          </div>

          {/* Right: Form UI */}
          <div className="lg:col-span-1 overflow-hidden">
            <DynamicForm
              schema={schema}
              defaultValues={formData}
              onDataChange={handleDataChange}
            />
          </div>

          {/* Far Right: Agent Panel */}
          <div className="lg:col-span-1 overflow-hidden">
            <AgentPanel
              schema={schema}
              formData={formData}
              onDataChange={handleFieldChange}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
