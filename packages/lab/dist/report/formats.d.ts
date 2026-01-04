/**
 * Report Formats
 *
 * Output format generators for Lab reports.
 * Added in v1.1.
 */
import type { LabReport, EnhancedLabReport, ReportJSON } from "../types.js";
/**
 * Enhance a LabReport with output format methods.
 *
 * @param report - The base lab report
 * @returns Enhanced report with format methods
 */
export declare function enhanceReport(report: LabReport): EnhancedLabReport;
/**
 * Convert report to Markdown string.
 */
export declare function toMarkdown(report: LabReport): string;
/**
 * Save Markdown to file.
 */
export declare function toMarkdownFile(report: LabReport, path: string): Promise<void>;
/**
 * Convert report to HTML string.
 */
export declare function toHTML(report: LabReport): string;
/**
 * Save HTML to file.
 */
export declare function toHTMLFile(report: LabReport, path: string): Promise<void>;
/**
 * Convert report to structured JSON format.
 */
export declare function toReportJSON(report: LabReport): ReportJSON;
//# sourceMappingURL=formats.d.ts.map