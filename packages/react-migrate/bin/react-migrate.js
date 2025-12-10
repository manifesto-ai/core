#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];

// Direct path execution: react-migrate ./src
const isPath = command && !command.startsWith('-') && command !== 'run' && command !== 'interactive';

if (command === 'run' || isPath) {
  // One-shot mode: react-migrate run ./src or react-migrate ./src
  if (isPath) {
    // Insert 'run' into args for the run.js to parse
    process.argv.splice(2, 0, 'run');
  }
  await import('../dist/cli/run.js');
} else if (command === 'interactive' || command === 'i') {
  // Interactive mode (ink-based UI)
  await import('../dist/cli/cli.js');
} else if (!command || command === '--help' || command === '-h') {
  console.log(`
@manifesto-ai/react-migrate

Usage:
  react-migrate <sourceDir> [options]     Run migration (one-shot mode)
  react-migrate run <sourceDir> [options] Same as above
  react-migrate interactive               Launch interactive UI (ink)
  react-migrate --help                    Show this help

One-shot Options:
  -o, --output <dir>     Output directory (default: ./manifesto)
  --no-llm               Skip LLM enrichment
  --provider <name>      LLM provider: openai, anthropic, ollama
  --dry-run              Don't write files
  -v, --verbose          Verbose output

Interactive Options:
  --root, -r <dir>       Root directory to analyze
  --output, -o <dir>     Output directory
  --resume               Resume previous session
  --auto                 Auto mode (minimize interaction)

Examples:
  react-migrate ./src
  react-migrate ./src -o ./manifesto --verbose
  react-migrate ./src --no-llm --dry-run
  react-migrate interactive --root ./src

Environment Variables:
  OPENAI_API_KEY         OpenAI API key
  ANTHROPIC_API_KEY      Anthropic API key
`);
  process.exit(0);
} else {
  console.error(`Unknown command: ${command}`);
  console.error('Run "react-migrate --help" for usage information.');
  process.exit(1);
}
