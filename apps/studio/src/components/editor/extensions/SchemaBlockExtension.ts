import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { SchemaBlockComponent } from "../blocks/SchemaBlockComponent";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    schemaBlock: {
      insertSchemaBlock: (attrs?: {
        path?: string;
        schemaType?: string;
        description?: string;
        defaultValue?: unknown;
      }) => ReturnType;
    };
  }
}

export const SchemaBlockExtension = Node.create({
  name: "schemaBlock",
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
      schemaType: {
        default: "string",
        parseHTML: (element) => element.getAttribute("data-schema-type"),
        renderHTML: (attributes) => ({
          "data-schema-type": attributes.schemaType,
        }),
      },
      description: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-description"),
        renderHTML: (attributes) => ({
          "data-description": attributes.description,
        }),
      },
      defaultValue: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute("data-default-value");
          return value ? JSON.parse(value) : null;
        },
        renderHTML: (attributes) => ({
          "data-default-value": attributes.defaultValue
            ? JSON.stringify(attributes.defaultValue)
            : null,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="schema-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "schema-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SchemaBlockComponent);
  },

  addCommands() {
    return {
      insertSchemaBlock:
        (attrs = {}) =>
        ({ chain }) => {
          const id = Math.random().toString(36).substring(2, 9);
          return chain()
            .insertContent({
              type: this.name,
              attrs: { id, ...attrs },
            })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-s": () => this.editor.commands.insertSchemaBlock(),
    };
  },
});
