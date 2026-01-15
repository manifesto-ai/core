/**
 * TypeScript module declaration for .mel files
 *
 * This allows TypeScript to recognize .mel file imports.
 * The MEL text is imported as a string and compiled by App's internal compiler.
 */
declare module "*.mel" {
  const content: string;
  export default content;
}
