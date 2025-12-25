"use client";

import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDomainName, useDomainId, useDomainDescription, useSetValue, useDomainExport, useDomainImport } from "@/runtime";
import { Database, Calculator, Zap, Shield, Download, Upload, FileCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { todoAppExample } from "@/domain/examples";

type EditorToolbarProps = {
  editor: Editor | null;
};

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const { value: domainId } = useDomainId();
  const { value: domainName } = useDomainName();
  const { value: domainDescription } = useDomainDescription();
  const { setValue } = useSetValue();
  const { downloadDomain } = useDomainExport();
  const { importFromFile } = useDomainImport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Set default domain meta on first load
  useEffect(() => {
    if (!domainId) {
      setValue("data.domain.id", "my-domain");
      setValue("data.domain.name", "My Domain");
      setValue("data.domain.description", "A new Manifesto domain");
    }
  }, [domainId, setValue]);

  const handleInsertSchema = () => {
    if (editor) {
      editor.chain().focus().insertSchemaBlock().run();
    }
  };

  const handleInsertDerived = () => {
    if (editor) {
      editor.chain().focus().insertDerivedBlock().run();
    }
  };

  const handleInsertAction = () => {
    if (editor) {
      editor.chain().focus().insertActionBlock().run();
    }
  };

  const handleInsertPolicy = () => {
    if (editor) {
      editor.chain().focus().insertPolicyBlock().run();
    }
  };

  const handleNameChange = (name: string) => {
    setValue("data.domain.name", name);
  };

  const handleExport = () => {
    downloadDomain();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const result = await importFromFile(file);
    if (!result.success) {
      setImportError(result.error.message);
      setTimeout(() => setImportError(null), 3000);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleLoadExample = () => {
    // Load Todo app example
    setValue("data.domain", todoAppExample.domain);
    setValue("data.sources", todoAppExample.sources);
    setValue("data.derived", todoAppExample.derived);
    setValue("data.actions", todoAppExample.actions);
    setValue("data.policies", todoAppExample.policies);
    setValue("data.scenarios", todoAppExample.scenarios ?? {});
  };

  return (
    <div className="flex items-center gap-4 w-full">
      {/* Domain name */}
      <div className="flex items-center gap-2">
        <Input
          value={domainName ?? ""}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Domain name"
          className="h-8 w-40 text-sm font-medium"
        />
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Block insertion buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleInsertSchema}
          className="h-8 gap-1"
        >
          <Database className="h-4 w-4 text-neon-cyan" />
          <span className="hidden sm:inline">Schema</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleInsertDerived}
          className="h-8 gap-1"
        >
          <Calculator className="h-4 w-4 text-neon-emerald" />
          <span className="hidden sm:inline">Derived</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleInsertAction}
          className="h-8 gap-1"
        >
          <Zap className="h-4 w-4 text-neon-rose" />
          <span className="hidden sm:inline">Action</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleInsertPolicy}
          className="h-8 gap-1"
        >
          <Shield className="h-4 w-4 text-neon-violet" />
          <span className="hidden sm:inline">Policy</span>
        </Button>
      </div>

      <div className="flex-1" />

      {/* Import error message */}
      {importError && (
        <div className="text-destructive text-sm">{importError}</div>
      )}

      {/* Example / Export / Import buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadExample}
          className="h-8 gap-1"
          title="Load Todo App example"
        >
          <FileCode className="h-4 w-4 text-amber-500" />
          <span className="hidden sm:inline">Example</span>
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.manifesto.json"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleImportClick}
          className="h-8 gap-1"
          title="Import domain from JSON"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Import</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          className="h-8 gap-1"
          title="Export domain to JSON"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>
    </div>
  );
}
