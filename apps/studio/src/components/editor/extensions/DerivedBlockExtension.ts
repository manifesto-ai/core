import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { DerivedBlockComponent } from "../blocks/DerivedBlockComponent";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    derivedBlock: {
      insertDerivedBlock: (attrs?: {
        path?: string;
        deps?: string[];
        expr?: unknown;
        description?: string;
      }) => ReturnType;
    };
  }
}

export const DerivedBlockExtension = Node.create({
  name: "derivedBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-id"),
        renderHTML: (attributes) => ({ "data-id": attributes.id }),
      },
      path: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-path"),
        renderHTML: (attributes) => ({ "data-path": attributes.path }),
      },
      deps: {
        default: [],
        parseHTML: (element) => {
          const deps = element.getAttribute("data-deps");
          return deps ? JSON.parse(deps) : [];
        },
        renderHTML: (attributes) => ({
          "data-deps": JSON.stringify(attributes.deps || []),
        }),
      },
      expr: {
        default: null,
        parseHTML: (element) => {
          const expr = element.getAttribute("data-expr");
          return expr ? JSON.parse(expr) : null;
        },
        renderHTML: (attributes) => ({
          "data-expr": attributes.expr ? JSON.stringify(attributes.expr) : null,
        }),
      },
      description: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-description"),
        renderHTML: (attributes) => ({
          "data-description": attributes.description,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="derived-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "derived-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DerivedBlockComponent);
  },

  addCommands() {
    return {
      insertDerivedBlock:
        (attrs = {}) =>
        ({ chain }) => {
          const id = Math.random().toString(36).substring(2, 9);
          return chain()
            .insertContent({
              type: this.name,
              attrs: { id, deps: [], ...attrs },
            })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-d": () => this.editor.commands.insertDerivedBlock(),
    };
  },
});
