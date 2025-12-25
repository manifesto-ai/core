"use client";

import { useEffect, useState } from "react";
import { EditorLayout } from "@/components/layout/EditorLayout";
import { ManifestoEditor, useEditor } from "@/components/editor/ManifestoEditor";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { IssuesPanel } from "@/components/issues/IssuesPanel";
import { useStudioValidation } from "@/runtime";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { SchemaBlockExtension } from "@/components/editor/extensions/SchemaBlockExtension";
import { DerivedBlockExtension } from "@/components/editor/extensions/DerivedBlockExtension";
import { ActionBlockExtension } from "@/components/editor/extensions/ActionBlockExtension";
import { PolicyBlockExtension } from "@/components/editor/extensions/PolicyBlockExtension";
import { EditorContent } from "@tiptap/react";

function EditorWithToolbar() {
  const [mounted, setMounted] = useState(false);

  // Automatic validation via Manifesto runtime
  useStudioValidation();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder:
          "Press the buttons above to add blocks, or use keyboard shortcuts...",
      }),
      SchemaBlockExtension,
      DerivedBlockExtension,
      ActionBlockExtension,
      PolicyBlockExtension,
    ],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[500px]",
      },
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading editor...</div>
      </div>
    );
  }

  return (
    <EditorLayout
      toolbar={<EditorToolbar editor={editor} />}
      editor={
        <div className="manifesto-editor">
          <EditorContent editor={editor} />
          <style jsx global>{`
            .manifesto-editor .ProseMirror {
              min-height: 500px;
            }

            .manifesto-editor .ProseMirror p.is-editor-empty:first-child::before {
              color: hsl(var(--muted-foreground));
              content: attr(data-placeholder);
              float: left;
              height: 0;
              pointer-events: none;
            }

            .manifesto-editor .ProseMirror:focus {
              outline: none;
            }

            .manifesto-editor .schema-block,
            .manifesto-editor .derived-block,
            .manifesto-editor .action-block,
            .manifesto-editor .policy-block {
              margin: 8px 0;
            }
          `}</style>
        </div>
      }
      issues={<IssuesPanel />}
    />
  );
}

export default function EditorPage() {
  return <EditorWithToolbar />;
}
