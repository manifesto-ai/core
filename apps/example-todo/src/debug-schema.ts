import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compile } from "@manifesto-ai/compiler";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const melPath = join(__dirname, "todo.mel");
const melSource = readFileSync(melPath, "utf-8");
const result = compile(melSource);

if (result.success) {
  console.log("Actions:");
  for (const [name, action] of Object.entries(result.schema.actions)) {
    console.log(`\n=== ${name} ===`);
    console.log(JSON.stringify(action.flow, null, 2));
  }
}
