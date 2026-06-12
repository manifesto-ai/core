import { describe, expect, it } from "vitest";
import {
  createTypeNameAliasMap,
  isBindingIdentifier,
  isIdentifierName,
  isTypeDeclarationName,
  renderPropertyKey,
  sanitizeIdentifier,
  sanitizeParameterNames,
} from "../identifier-safety.js";

describe("identifier-safety", () => {
  describe("isIdentifierName", () => {
    it("accepts plain, dollar, underscore, and Unicode identifiers", () => {
      expect(isIdentifierName("count")).toBe(true);
      expect(isIdentifierName("$mel")).toBe(true);
      expect(isIdentifierName("_private")).toBe(true);
      expect(isIdentifierName("café")).toBe(true);
      expect(isIdentifierName("名前")).toBe(true);
    });

    it("accepts reserved words (valid in property-key position)", () => {
      expect(isIdentifierName("class")).toBe(true);
      expect(isIdentifierName("while")).toBe(true);
    });

    it("rejects hyphens, spaces, dots, leading digits, and empty keys", () => {
      expect(isIdentifierName("my-key")).toBe(false);
      expect(isIdentifierName("has space")).toBe(false);
      expect(isIdentifierName("a.b")).toBe(false);
      expect(isIdentifierName("2nd")).toBe(false);
      expect(isIdentifierName("")).toBe(false);
    });
  });

  describe("isBindingIdentifier / isTypeDeclarationName", () => {
    it("rejects reserved words in binding position", () => {
      expect(isBindingIdentifier("class")).toBe(false);
      expect(isBindingIdentifier("await")).toBe(false);
      expect(isBindingIdentifier("name")).toBe(true);
    });

    it("rejects predefined type names in type declaration position", () => {
      expect(isTypeDeclarationName("string")).toBe(false);
      expect(isTypeDeclarationName("unknown")).toBe(false);
      expect(isTypeDeclarationName("Todo")).toBe(true);
    });
  });

  describe("renderPropertyKey", () => {
    it("keeps valid identifier names unquoted", () => {
      expect(renderPropertyKey("count")).toBe("count");
      expect(renderPropertyKey("while")).toBe("while");
      expect(renderPropertyKey("名前")).toBe("名前");
    });

    it("quotes keys that are not valid identifier names", () => {
      expect(renderPropertyKey("my-key")).toBe('"my-key"');
      expect(renderPropertyKey("has space")).toBe('"has space"');
      expect(renderPropertyKey("2nd")).toBe('"2nd"');
      expect(renderPropertyKey("")).toBe('""');
    });
  });

  describe("sanitizeIdentifier", () => {
    it("replaces invalid characters and prefixes invalid starts", () => {
      expect(sanitizeIdentifier("my-key")).toBe("my_key");
      expect(sanitizeIdentifier("has space")).toBe("has_space");
      expect(sanitizeIdentifier("2nd")).toBe("_2nd");
      expect(sanitizeIdentifier("")).toBe("_");
    });

    it("prefixes reserved words", () => {
      expect(sanitizeIdentifier("class")).toBe("_class");
    });

    it("is deterministic", () => {
      expect(sanitizeIdentifier("a-b c")).toBe(sanitizeIdentifier("a-b c"));
    });
  });

  describe("createTypeNameAliasMap", () => {
    it("maps valid names to themselves", () => {
      const aliases = createTypeNameAliasMap(["Todo", "User"]);
      expect(aliases.get("Todo")).toBe("Todo");
      expect(aliases.get("User")).toBe("User");
    });

    it("sanitizes invalid names without colliding with valid names", () => {
      const aliases = createTypeNameAliasMap(["My-Type", "My_Type"]);
      expect(aliases.get("My_Type")).toBe("My_Type");
      expect(aliases.get("My-Type")).toBe("My_Type_2");
    });

    it("resolves collisions between sanitized aliases deterministically", () => {
      const aliases = createTypeNameAliasMap(["a-b", "a b", "a.b"]);
      expect(new Set(aliases.values()).size).toBe(3);
      const again = createTypeNameAliasMap(["a.b", "a-b", "a b"]);
      expect(again).toEqual(aliases);
    });

    it("avoids reserved names", () => {
      const aliases = createTypeNameAliasMap(["My-Type"], ["My_Type"]);
      expect(aliases.get("My-Type")).toBe("My_Type_2");
    });
  });

  describe("sanitizeParameterNames", () => {
    it("keeps valid names and sanitizes invalid ones", () => {
      expect(sanitizeParameterNames(["title", "new-value"])).toEqual(["title", "new_value"]);
    });

    it("avoids collisions with valid names regardless of order", () => {
      expect(sanitizeParameterNames(["a-b", "a_b"])).toEqual(["a_b_2", "a_b"]);
    });

    it("sanitizes reserved words", () => {
      expect(sanitizeParameterNames(["class"])).toEqual(["_class"]);
    });
  });
});
