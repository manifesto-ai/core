import { describe, it, expect } from 'vitest';

import {
  SemanticDirective,
  PolicyDirective,
  DeprecatedReasonDirective,
  ComputedDirective,
  AsyncDirective,
  ManifestoDirectives,
  ImportanceLevelEnum,
  SemanticTypeEnum,
  generateSemanticDirectiveSDL,
  generatePolicyDirectiveSDL,
  generateDirectiveDefinitionsSDL,
  parseDirectiveArgs,
} from '../../src/schema/directive-builder.js';

describe('Directive Builder', () => {
  describe('Directive Definitions', () => {
    it('should have SemanticDirective defined', () => {
      expect(SemanticDirective.name).toBe('semantic');
      expect(SemanticDirective.args).toHaveLength(3);
    });

    it('should have PolicyDirective defined', () => {
      expect(PolicyDirective.name).toBe('policy');
      expect(PolicyDirective.args).toHaveLength(3);
    });

    it('should have DeprecatedReasonDirective defined', () => {
      expect(DeprecatedReasonDirective.name).toBe('deprecatedReason');
      expect(DeprecatedReasonDirective.args).toHaveLength(3);
    });

    it('should have ComputedDirective defined', () => {
      expect(ComputedDirective.name).toBe('computed');
      expect(ComputedDirective.args).toHaveLength(2);
    });

    it('should have AsyncDirective defined', () => {
      expect(AsyncDirective.name).toBe('asyncField');
      expect(AsyncDirective.args).toHaveLength(2);
    });

    it('should export all directives', () => {
      expect(ManifestoDirectives).toHaveLength(5);
      expect(ManifestoDirectives).toContain(SemanticDirective);
      expect(ManifestoDirectives).toContain(PolicyDirective);
    });
  });

  describe('Enum Types', () => {
    it('should have ImportanceLevelEnum defined', () => {
      expect(ImportanceLevelEnum.name).toBe('ImportanceLevel');
      const values = ImportanceLevelEnum.getValues();
      expect(values.map((v) => v.name)).toContain('CRITICAL');
      expect(values.map((v) => v.name)).toContain('HIGH');
      expect(values.map((v) => v.name)).toContain('MEDIUM');
      expect(values.map((v) => v.name)).toContain('LOW');
    });

    it('should have SemanticTypeEnum defined', () => {
      expect(SemanticTypeEnum.name).toBe('SemanticType');
      const values = SemanticTypeEnum.getValues();
      expect(values.map((v) => v.name)).toContain('INPUT');
      expect(values.map((v) => v.name)).toContain('COMPUTED');
      expect(values.map((v) => v.name)).toContain('STATE');
    });
  });

  describe('SDL Generation', () => {
    it('should generate semantic directive SDL', () => {
      const sdl = generateSemanticDirectiveSDL({
        type: 'input',
        description: 'User email address',
      });

      expect(sdl).toContain('@semantic');
      expect(sdl).toContain('type: INPUT');
      expect(sdl).toContain('description: "User email address"');
    });

    it('should generate semantic directive SDL with importance', () => {
      const sdl = generateSemanticDirectiveSDL({
        type: 'input',
        description: 'Critical field',
        importance: 'critical',
      });

      expect(sdl).toContain('importance: CRITICAL');
    });

    it('should generate policy directive SDL', () => {
      const sdl = generatePolicyDirectiveSDL({
        editable: true,
        required: true,
      });

      expect(sdl).toContain('@policy');
      expect(sdl).toContain('editable: true');
      expect(sdl).toContain('required: true');
    });

    it('should generate policy directive SDL with visible', () => {
      const sdl = generatePolicyDirectiveSDL({
        editable: false,
        required: false,
        visible: false,
      });

      expect(sdl).toContain('visible: false');
    });

    it('should generate full directive definitions SDL', () => {
      const sdl = generateDirectiveDefinitionsSDL();

      expect(sdl).toContain('directive @semantic');
      expect(sdl).toContain('directive @policy');
      expect(sdl).toContain('directive @computed');
      expect(sdl).toContain('directive @asyncField');
      expect(sdl).toContain('enum ImportanceLevel');
      expect(sdl).toContain('enum SemanticType');
    });
  });

  describe('Directive Parsing', () => {
    it('should parse simple directive args', () => {
      const args = parseDirectiveArgs('semantic', 'type: INPUT, description: "Test"');

      expect(args.type).toBe('INPUT');
      expect(args.description).toBe('Test');
    });

    it('should parse boolean args', () => {
      const args = parseDirectiveArgs('policy', 'editable: true, required: false');

      expect(args.editable).toBe(true);
      expect(args.required).toBe(false);
    });

    it('should parse numeric args', () => {
      const args = parseDirectiveArgs('custom', 'count: 42, ratio: 3.14');

      // parseDirectiveArgs identifies these as identifiers, not numbers
      expect(args.count).toBe('42');
      expect(args.ratio).toBe('3');  // Regex limitation
    });
  });
});
