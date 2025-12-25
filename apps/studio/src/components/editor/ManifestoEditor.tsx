"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { SchemaBlockExtension } from "./extensions/SchemaBlockExtension";
import { DerivedBlockExtension } from "./extensions/DerivedBlockExtension";

export function ManifestoEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable features we don't need
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: "Press / to add a block, or start typing...",
      }),
      SchemaBlockExtension,
      DerivedBlockExtension,
    ],
    content: "",
    immediatelyRender: false, // SSR-safe for Next.js
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none focus:outline-none min-h-[500px]",
      },
    },
  });

  return (
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

        /* Block node styles */
        .manifesto-editor .schema-block,
        .manifesto-editor .derived-block {
          margin: 8px 0;
        }
      `}</style>
    </div>
  );
}

export { useEditor };
