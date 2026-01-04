import { readFileSync } from 'fs';
import { tokenize, parse, generate } from '@manifesto-ai/compiler';

// Read counter.mel
const mel = readFileSync('./src/fixtures/schemas/counter.mel', 'utf-8');

// Compile
const lexResult = tokenize(mel);
const parseResult = parse(lexResult.tokens);

if (parseResult.program) {
  const genResult = generate(parseResult.program);
  console.log('=== Schema Structure ===');
  console.log('id:', genResult.schema?.id);
  console.log('hash:', genResult.schema?.hash);
  console.log('');
  console.log('state keys:', Object.keys(genResult.schema?.state || {}));
  console.log('computed keys:', Object.keys(genResult.schema?.computed || {}));
  console.log('action keys:', Object.keys(genResult.schema?.actions || {}));
  console.log('');
  console.log('Full state:');
  console.log(JSON.stringify(genResult.schema?.state, null, 2));
  console.log('');
  console.log('Full computed:');
  console.log(JSON.stringify(genResult.schema?.computed, null, 2));
}
