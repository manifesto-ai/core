/**
 * Vite plugin for MEL files.
 */

import type { Plugin } from "vite";
import { compileMelToModuleCode } from "./mel-module.js";

export type MelPluginOptions = {
  /**
   * Optional include matcher for file paths.
   * Defaults to `/\\.mel$/`.
   */
  readonly include?: RegExp;
};

function normalizeId(id: string): string {
  const [withoutQuery] = id.split("?", 1);
  return withoutQuery;
}

function testRegex(regex: RegExp, value: string): boolean {
  regex.lastIndex = 0;
  return regex.test(value);
}

/**
 * Compile `.mel` files into ESM modules that export compiled DomainSchema.
 */
export function melPlugin(options: MelPluginOptions = {}): Plugin {
  const include = options.include ?? /\.mel$/;

  return {
    name: "manifesto:mel",
    enforce: "pre",
    transform(source: string, id: string) {
      const sourceId = normalizeId(id);
      if (!testRegex(include, sourceId)) {
        return null;
      }

      return {
        code: compileMelToModuleCode(source, sourceId),
        map: null,
      };
    },
  };
}

export default melPlugin;
