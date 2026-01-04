/**
 * Script to compile counter.mel and save as JSON
 */
import { readFileSync, writeFileSync } from 'fs';
import { tokenize, parse, generate } from '@manifesto-ai/compiler';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read counter.mel
const counterMel = readFileSync(
  join(__dirname, '../src/fixtures/schemas/counter.mel'),
  'utf-8'
);

// Compile
const lexResult = tokenize(counterMel);
const parseResult = parse(lexResult.tokens);

if (parseResult.diagnostics.length > 0) {
  console.error('Parse errors:', parseResult.diagnostics);
  process.exit(1);
}

const genResult = generate(parseResult.program);

if (genResult.diagnostics.length > 0) {
  console.error('Generate errors:', genResult.diagnostics);
  process.exit(1);
}

// Save as JSON
writeFileSync(
  join(__dirname, '../src/fixtures/schemas/counter-compiled.json'),
  JSON.stringify(genResult.schema, null, 2)
);

console.log('Compiled counter.mel to counter-compiled.json');
console.log('Schema ID:', genResult.schema.id);
console.log('Schema Hash:', genResult.schema.hash);
