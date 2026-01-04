import { readFileSync } from 'fs';
import { tokenize, parse, generate } from '@manifesto-ai/compiler';

// Read counter.mel
const mel = readFileSync('./src/fixtures/schemas/counter.mel', 'utf-8');
console.log('=== MEL Source ===');
console.log(mel);
console.log('');

// Tokenize
const lexResult = tokenize(mel);
console.log('=== Lex Diagnostics ===');
console.log(JSON.stringify(lexResult.diagnostics, null, 2));

// Parse
const parseResult = parse(lexResult.tokens);
console.log('\n=== Parse Result ===');
console.log('program exists:', !!parseResult.program);
console.log('diagnostics count:', parseResult.diagnostics.length);

if (parseResult.diagnostics.length > 0) {
  console.log('\n=== First 5 Parse Diagnostics ===');
  parseResult.diagnostics.slice(0, 5).forEach((d, i) => {
    console.log((i+1) + ':', d.message);
  });
}

if (parseResult.program) {
  console.log('\nDomain name:', parseResult.program.domain.name);
}
