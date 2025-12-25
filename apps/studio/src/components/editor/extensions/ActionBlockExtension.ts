import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ActionBlockComponent } from "../blocks/ActionBlockComponent";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    actionBlock: {
      insertActionBlock: (attrs?: {
        path?: string;
        preconditions?: unknown;
        effectType?: string;
        effectConfig?: unknown;
        description?: string;
      }) => ReturnType;
    };
  }
}

export const ActionBlockExtension = Node.create({
  name: "actionBlock",
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
      preconditions: {
        default: null,
        parseHTML: (element) => {
          const preconditions = element.getAttribute("data-preconditions");
          return preconditions ? JSON.parse(preconditions) : null;
        },
        renderHTML: (attributes) => ({
          "data-preconditions": attributes.preconditions
            ? JSON.stringify(attributes.preconditions)
            : null,
        }),
      },
      effectType: {
        default: "setState",
        parseHTML: (element) => element.getAttribute("data-effect-type"),
        renderHTML: (attributes) => ({
          "data-effect-type": attributes.effectType,
        }),
      },
      effectConfig: {
        default: null,
        parseHTML: (element) => {
          const config = element.getAttribute("data-effect-config");
          return config ? JSON.parse(config) : null;
        },
        renderHTML: (attributes) => ({
          "data-effect-config": attributes.effectConfig
            ? JSON.stringify(attributes.effectConfig)
            : null,
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
    return [{ tag: 'div[data-type="action-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "action-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ActionBlockComponent);
  },

  addCommands() {
    return {
      insertActionBlock:
        (attrs = {}) =>
        ({ chain }) => {
          const id = Math.random().toString(36).substring(2, 9);
          return chain()
            .insertContent({
              type: this.name,
              attrs: { id, effectType: "setState", ...attrs },
            })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-a": () => this.editor.commands.insertActionBlock(),
    };
  },
});
