# ADR-APP-002: createApp Public API = (MEL | Schema) + Effects Only

> **Status:** Proposed
> **Version:** 0.1.0
> **Date:** 2026-02-05
> **Deciders:** Manifesto Architecture Team
> **Scope:** `@manifesto-ai/app` public API (`createApp`)
> **Depends On:** ARCHITECTURE v2.x (Layer Separation), World SPEC v2.x (HostExecutor injection), Host SPEC v2.x (Effect Handler Contract)

---

## 1. Context

`createApp()` is intended to be the **DX entrypoint** (Vue-level simplicity):
users should be able to provide **MEL (or Schema)** and an **Effect set**, and get a working app without learning internal layers (Host/Compiler/Adapter/etc.).

However, the current App contract requires users to inject a `host: Host` and `worldStore: WorldStore`, and (for MEL) often also a `compiler`. This creates three problems:

1) **Concept leakage**: users must learn internal concepts ("Host", "HostAdapter", etc.) to do the simplest thing.
2) **Redundant injection & confusion**: when MEL is provided, the compiler exists "inside the app", yet API forces external wiring; similarly "host exists to bind MEL <-> effects", but API pushes host into user-land.
3) **Philosophy conflict**: App-level philosophy says internal Host/World instances should not be exposed, but the public API effectively exposes Host as a required dependency.

We want to keep the **layer boundary** intact (World does not know Host details) while making the **public API minimal**.

---

## 2. Decision

### 2.1 `createApp` becomes "Effects-first" and hides Host/Compiler

`createApp` MUST be callable with only:

- `schema` (DomainSchema) **or** `mel` (string)
- `effects` (Effect handlers map / pack)

Everything else is optional.

**Host is not user-facing.**
`createApp` MUST internally create the execution runtime that binds **(MEL/Schema) <-> Effects** into the World's execution interface.

**Compiler is not user-facing.**
If MEL is provided, `createApp` MUST compile it using the built-in compiler pipeline.

### 2.2 Flat public configuration (no builders, no runtime DSL)

Public API stays flat to keep mental overhead minimal.

### 2.3 World boundary stays unchanged

World still MUST receive execution only via an injected executor interface (as per World boundary rules).
The injection point remains inside App as composition root—**not the end-user**.

---

## 3. Public API (Normative)

### 3.1 Types

```ts
type EffectHandler = (input: unknown, ctx: unknown) => Promise<Patch[]>;

type Effects = Record<string, EffectHandler>; // key = effect id / effect name

type CreateAppConfig =
  | {
      mel: string;
      schema?: never;
      effects: Effects;

      initialData?: unknown;
      worldStore?: WorldStore;
      policyService?: PolicyService;
      actorPolicy?: ActorPolicy;
      validation?: {
        effects?: "strict" | "warn" | "off";
      };
    }
  | {
      schema: DomainSchema;
      mel?: never;
      effects: Effects;

      initialData?: unknown;
      worldStore?: WorldStore;
      policyService?: PolicyService;
      actorPolicy?: ActorPolicy;
      validation?: {
        effects?: "strict" | "warn" | "off";
      };
    };
```

### 3.2 Requirements

**APP-API-1 (MUST):** `createApp(config)` MUST require `effects`.

**APP-API-2 (MUST):** If `config.mel` is provided, `createApp` MUST compile MEL internally.

**APP-API-3 (MUST):** `createApp` MUST construct the internal execution runtime that connects compiled intent/schema to effects.

**APP-API-4 (MUST NOT):** `createApp` MUST NOT require users to provide or understand Host/Compiler/Adapters.

**APP-API-5 (MUST):** `effects` MUST follow Host Effect Handler Contract (return `Patch[]`, no-throw; failures expressed as patches).

**APP-API-6 (SHOULD):** By default, `createApp` SHOULD validate that effects cover all effect ids referenced by schema (configurable via `validation.effects`).

**APP-API-7 (MAY):** `worldStore`, `policyService`, `actorPolicy` MAY be overridden; otherwise App may choose sane defaults (e.g., in-memory world store).

---

## 4. Spec Changes (What we will patch)

### 4.1 AppConfig changes

- Remove `host: Host` from the public `CreateAppConfig`.
- Replace/rename `services?: ServiceMap` with required `effects: Effects`.
- Remove the rule "compiler required if schema is string" from public contract (compiler becomes internal).

### 4.2 Boundary rule update

Replace the current injection rule:

- **OLD:** App MUST receive Host and WorldStore via injection
- **NEW:** App MUST receive Effects via injection; App MUST compose its internal execution runtime. WorldStore MAY be injected; public API MUST NOT require Host injection.

---

## 5. Consequences

### 5.1 Pros

- End-user DX becomes "Vue-level": MEL + effects and it runs.
- Internal architecture boundaries remain intact (World still does not know Host details).
- Removes conceptual clutter: Host/Compiler becomes implementation detail.

### 5.2 Cons / Risks

- Breaking change: existing apps passing `host`/`services` must migrate.
- Requires clear rules for "effect key naming" and schema effect id mapping.
- App package now owns internal runtime composition; requires strong tests to keep determinism and validation consistent.

---

## 6. Migration Plan (High-level)

1. `services` -> `effects` (required).
2. `host` no longer accepted in public config (internalized).
3. MEL users no longer pass `compiler`; compilation is internal.
4. Existing internal `createAppCore(...)` may remain as private/internal, but not documented as public.

---

## 7. Alternatives Considered

### 7.1 Keep current API and add `createTaskFlowApp()` presets

**Rejected:** creates two-tier API surface; main entrypoint remains "hard".

### 7.2 Runtime builder / plugin DSL

**Rejected:** violates "flat config" requirement; introduces extra concepts.

### 7.3 Auto-detect browser/server and provide default effects

**Rejected:** out of scope; effects are environment-specific and must be provided by the user.
