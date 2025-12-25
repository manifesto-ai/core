import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { PolicyBlockComponent } from "../blocks/PolicyBlockComponent";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    policyBlock: {
      insertPolicyBlock: (attrs?: {
        path?: string;
        targetPath?: string;
        condition?: unknown;
        policyType?: string;
        description?: string;
      }) => ReturnType;
    };
  }
}

export const PolicyBlockExtension = Node.create({
  name: "policyBlock",
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
      targetPath: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-target-path"),
        renderHTML: (attributes) => ({
          "data-target-path": attributes.targetPath,
        }),
      },
      condition: {
        default: null,
        parseHTML: (element) => {
          const condition = element.getAttribute("data-condition");
          return condition ? JSON.parse(condition) : null;
        },
        renderHTML: (attributes) => ({
          "data-condition": attributes.condition
            ? JSON.stringify(attributes.condition)
            : null,
        }),
      },
      policyType: {
        default: "allow",
        parseHTML: (element) => element.getAttribute("data-policy-type"),
        renderHTML: (attributes) => ({
          "data-policy-type": attributes.policyType,
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
    return [{ tag: 'div[data-type="policy-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "policy-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PolicyBlockComponent);
  },

  addCommands() {
    return {
      insertPolicyBlock:
        (attrs = {}) =>
        ({ chain }) => {
          const id = Math.random().toString(36).substring(2, 9);
          return chain()
            .insertContent({
              type: this.name,
              attrs: { id, policyType: "allow", ...attrs },
            })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-p": () => this.editor.commands.insertPolicyBlock(),
    };
  },
});
