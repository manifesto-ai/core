/**
 * Webpack plugin for MEL files.
 */

import { unpluginMel } from "./unplugin.js";

export type {
  MelPluginOptions,
  MelCodegenOptions,
  MelCodegenEmitter,
  MelCodegenArtifact,
} from "./unplugin.js";
export const melPlugin = unpluginMel.webpack;
export default melPlugin;
