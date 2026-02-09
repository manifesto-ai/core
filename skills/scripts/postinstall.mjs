#!/usr/bin/env node

/**
 * @manifesto-ai/skills postinstall
 *
 * Provides integration instructions after installation.
 * v0.1: Simple message output only.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(__dirname, '..');

console.log(`
@manifesto-ai/skills v0.1.0 installed

Knowledge files available at:
  ${skillsRoot}/SKILL.md

Claude Code integration:
  Add to your CLAUDE.md:
    See @node_modules/@manifesto-ai/skills/SKILL.md for Manifesto development rules.
`);
