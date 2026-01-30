/**
 * @fileoverview OpenAPI target exporter.
 */

import type { TargetExporter, ExportInput } from "@manifesto-ai/translator";
import type { OpenAPISpec } from "./types.js";

export const openApiExporter: TargetExporter<OpenAPISpec, void> = {
  id: "openapi",

  async export(_input: ExportInput): Promise<OpenAPISpec> {
    return {
      openapi: "3.0.3",
      info: {
        title: "Manifesto Translator Export",
        version: "0.1.0",
      },
      paths: {},
    };
  },
};
