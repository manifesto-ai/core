# SPEC/FDR Versioning Convention

> **Status:** Normative
> **Applies to:** All SPEC and FDR documents in `/packages/*/docs/`
> **Version:** 1.0.0

---

## 1. File Naming Convention

### 1.1 Format

```
{TYPE}-v{MAJOR}.{MINOR}.{PATCH}[-patch].md
```

| Component | Description | Example |
|-----------|-------------|---------|
| `TYPE` | Document type | `SPEC`, `FDR` |
| `MAJOR.MINOR.PATCH` | Semantic version (always 3 parts) | `1.2.0`, `0.4.10` |
| `-patch` | Optional suffix for incremental documents | `-patch` |

### 1.2 Examples

| Filename | Description |
|----------|-------------|
| `SPEC-v1.2.0.md` | Full specification version 1.2.0 |
| `SPEC-v0.4.0-patch.md` | Patch document for version 0.4.0 (requires base) |
| `FDR-v1.2.0.md` | Full FDR version 1.2.0 |
| `FDR-v0.4.0-patch.md` | Patch FDR for version 0.4.0 |

---

## 2. Document Types

### 2.1 Full Document

A **full document** is self-contained and complete. It does NOT require any previous version to understand.

**Indicators:**
- No `-patch` suffix in filename
- Header contains `Supersedes:` field (if not first version)
- Contains complete Table of Contents

**Header format:**
```markdown
# {Package} Specification v{VERSION}

> **Version:** {MAJOR}.{MINOR}.{PATCH}
> **Status:** {Draft|Final|Deprecated}
> **Type:** Full
> **Date:** {YYYY-MM-DD}
> **Supersedes:** v{PREV_VERSION} (if applicable)
```

### 2.2 Patch Document

A **patch document** contains only changes from a base version. It MUST be read together with its base document.

**Indicators:**
- `-patch` suffix in filename
- Header contains `Base:` field specifying required version
- Contains only changed sections

**Header format:**
```markdown
# {Package} Specification v{VERSION} (Patch)

> **Version:** {MAJOR}.{MINOR}.{PATCH}
> **Status:** {Draft|Final|Deprecated}
> **Type:** Patch
> **Date:** {YYYY-MM-DD}
> **Base:** v{BASE_VERSION} (REQUIRED)
```

**Usage note:** To understand a patch document, you MUST first read the base document specified in the `Base:` field.

---

## 3. Version Index

Each package's `docs/` folder SHOULD contain a `VERSION-INDEX.md` file listing all available versions.

**Format:**
```markdown
# {Package} Documentation Index

## Latest Version
- **SPEC:** [v{VERSION}](SPEC-v{VERSION}.md) (Full)
- **FDR:** [v{VERSION}](FDR-v{VERSION}.md) (Full)

## All Versions

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
| v1.2.0 | [SPEC](SPEC-v1.2.0.md) | [FDR](FDR-v1.2.0.md) | Full | Final |
| v1.1.0 | [SPEC](SPEC-v1.1.0.md) | [FDR](FDR-v1.1.0.md) | Full | Superseded |
| v0.4.0 | [SPEC](SPEC-v0.4.0-patch.md) | [FDR](FDR-v0.4.0-patch.md) | Patch (Base: v0.3.3) | Final |
```

---

## 4. Semantic Versioning Rules

Follow [SemVer 2.0.0](https://semver.org/):

| Change Type | Version Increment | Example |
|-------------|-------------------|---------|
| Breaking API/semantic change | MAJOR | `1.0.0` → `2.0.0` |
| New feature, backward compatible | MINOR | `1.0.0` → `1.1.0` |
| Bug fix, clarification | PATCH | `1.0.0` → `1.0.1` |

---

## 5. Status Values

| Status | Meaning |
|--------|---------|
| `Draft` | Under development, not yet approved |
| `Final` | Approved and normative |
| `Deprecated` | No longer recommended, superseded by newer version |
| `Superseded` | Replaced by newer full version |

---

## 6. Migration Guide

### 6.1 Old Format → New Format

| Old Filename | New Filename |
|--------------|--------------|
| `SPEC.md` | Rename to `SPEC-v{VERSION}.md` using header version |
| `SPEC-0.3v.md` | `SPEC-v0.3.0.md` |
| `SPEC-0.3.1v.md` | `SPEC-v0.3.1.md` |
| `SPEC-1.1.0v.md` | `SPEC-v1.1.0.md` |
| `FDR-1.2.md` | `FDR-v1.2.0.md` |

### 6.2 Identifying Patch Documents

A document is a **patch** if:
1. Header contains "Patch Target:", "Patch Document", or "Base:"
2. Does NOT contain a complete Table of Contents
3. Contains only delta/change sections

---

## 7. Directory Structure

```
packages/{package}/docs/
├── VERSION-INDEX.md          # Version listing and navigation
├── SPEC-v1.2.0.md            # Latest full SPEC
├── SPEC-v1.1.0.md            # Previous full SPEC
├── SPEC-v1.0.0-patch.md      # Patch document (requires base)
├── FDR-v1.2.0.md             # Latest full FDR
├── FDR-v1.1.0.md             # Previous full FDR
└── FDR-v1.0.0-patch.md       # Patch document (requires base)
```

---

*End of VERSION-CONVENTION.md*
