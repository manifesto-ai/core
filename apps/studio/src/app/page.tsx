import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Calculator, ArrowRight } from "lucide-react";

export default function StudioPage() {
  return (
    <main className="min-h-screen bg-background p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Manifesto Studio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Visual IDE for Manifesto Domains - Create, edit, and validate your
            domain definitions with a block-based editor.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
              <Database className="h-5 w-5 text-neon-cyan mt-0.5" />
              <div>
                <h3 className="font-medium">Schema Blocks</h3>
                <p className="text-sm text-muted-foreground">
                  Define your data fields with types and validation
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
              <Calculator className="h-5 w-5 text-neon-emerald mt-0.5" />
              <div>
                <h3 className="font-medium">Derived Blocks</h3>
                <p className="text-sm text-muted-foreground">
                  Create computed values with Expression DSL
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link href="/editor">
              <Button>
                Open Editor
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link
              href="https://github.com/manifesto-ai/core"
              target="_blank"
              rel="noopener"
            >
              <Button variant="outline">Documentation</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
