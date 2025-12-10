"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, FileText } from "lucide-react";
import { insuranceFormSchema, eventRegistrationSchema } from "@/lib/samples";
import type { GeneratedSchema } from "@/lib/types/schema";

const SAMPLE_SCHEMAS = [
  { name: "Insurance Application", schema: insuranceFormSchema },
  { name: "Event Registration", schema: eventRegistrationSchema },
];

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error("Schema generation failed");
      }

      const { schema } = await response.json();

      // Store schema in sessionStorage for the studio page
      sessionStorage.setItem("manifesto-schema", JSON.stringify(schema));

      router.push("/studio");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate schema. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = (schema: GeneratedSchema) => {
    sessionStorage.setItem("manifesto-schema", JSON.stringify(schema));
    router.push("/studio");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-background to-muted">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">
              Manifesto Form Studio
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Describe your form in natural language, and AI will generate a fully
            semantic, policy-driven form for you.
          </p>
        </div>

        {/* Input Area */}
        <div className="space-y-4">
          <Textarea
            placeholder="e.g., Create an insurance application form with personal info, employment details, and coverage options..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[150px] text-lg resize-none"
            disabled={isLoading}
          />

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isLoading}
            className="w-full h-12 text-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Synthesizing form semantics...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate Form
              </>
            )}
          </Button>
        </div>

        {/* Examples */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Try these examples:
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              "Insurance application form",
              "Event registration form",
              "Job application form",
              "Customer feedback survey",
            ].map((example) => (
              <button
                key={example}
                onClick={() => setPrompt(example)}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded-full transition-colors disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Sample Schemas */}
        <div className="border-t pt-8 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Or try a pre-built sample (no API key required):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SAMPLE_SCHEMAS.map((sample) => (
              <Button
                key={sample.name}
                variant="outline"
                onClick={() => handleLoadSample(sample.schema)}
                disabled={isLoading}
                className="h-auto py-4 flex flex-col items-start gap-1"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">{sample.name}</span>
                </div>
                <span className="text-xs text-muted-foreground text-left">
                  {sample.schema.description}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
