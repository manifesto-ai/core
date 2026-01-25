/**
 * Report Module
 *
 * Lab report generation.
 */

export { generateReport } from "./generator.js";

// v1.1: Enhanced report formats
export {
  enhanceReport,
  toMarkdown,
  toMarkdownFile,
  toHTML,
  toHTMLFile,
  toReportJSON,
} from "./formats.js";
