'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SchemaEditorPanel } from '@/components/editors/SchemaEditorPanel'
import { ExampleSelector } from '@/components/editors/ExampleSelector'

interface LeftSidebarProps {
  entitySchemaJson: string
  viewSchemaJson: string
  onEntitySchemaChange: (value: string) => void
  onViewSchemaChange: (value: string) => void
  onLoadExample: (exampleId: string) => void
}

export function LeftSidebar({
  entitySchemaJson,
  viewSchemaJson,
  onEntitySchemaChange,
  onViewSchemaChange,
  onLoadExample,
}: LeftSidebarProps) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-white/8 bg-background/80 p-3 shadow-[0_10px_60px_rgba(0,0,0,0.28)] backdrop-blur-lg">
      {/* Example Selector */}
      <div className="rounded-lg border border-white/8 bg-white/5 p-3">
        <ExampleSelector onSelect={onLoadExample} />
      </div>

      {/* Schema Editors */}
      <Tabs defaultValue="entity" className="flex flex-1 flex-col min-h-0 rounded-lg border border-white/8 bg-background/80 p-3 backdrop-blur">
        <div className="shrink-0">
          <TabsList className="w-full rounded-lg border border-white/10 bg-white/5 p-1 text-foreground/70">
            <TabsTrigger value="entity" className="flex-1 rounded-md text-xs data-[state=active]:bg-background data-[state=active]:text-white">
              Entity Schema
            </TabsTrigger>
            <TabsTrigger value="view" className="flex-1 rounded-md text-xs data-[state=active]:bg-background data-[state=active]:text-white">
              View Schema
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-3 min-h-0 flex-1">
          <div className="h-full overflow-hidden rounded-lg border border-white/8 bg-background/85">
            <TabsContent value="entity" className="h-full data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden">
              <SchemaEditorPanel
                value={entitySchemaJson}
                onChange={onEntitySchemaChange}
                schemaType="entity"
              />
            </TabsContent>

            <TabsContent value="view" className="h-full data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden">
              <SchemaEditorPanel
                value={viewSchemaJson}
                onChange={onViewSchemaChange}
                schemaType="view"
              />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
