/**
 * Rspack plugin for MEL files.
 */

import { unpluginMel } from "./unplugin.js";

export type { MelPluginOptions, MelCodegenOptions } from "./unplugin.js";
export const melPlugin = unpluginMel.rspack;
export default melPlugin;
