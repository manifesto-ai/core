# Changelog

## [2.5.0](https://github.com/manifesto-ai/core/compare/core-v2.4.0...core-v2.5.0) (2026-02-20)


### Features

* **core:** add type-safe defineOps&lt;T&gt;() for typed PatchOps creation ([f4dc2cf](https://github.com/manifesto-ai/core/commit/f4dc2cfc024a2695c5c215a82c32ea008e160c0e))

## [2.4.0](https://github.com/manifesto-ai/core/compare/core-v2.3.0...core-v2.4.0) (2026-02-10)


### Features

* **app:** add Snapshot DX aliases (App SPEC v2.3.2) ([#142](https://github.com/manifesto-ai/core/issues/142)) ([9bde2eb](https://github.com/manifesto-ai/core/commit/9bde2eb008d151574ac48e440d2fa6c93bac2e7b))


### Bug Fixes

* add field IR kind for static property access and fix at() record lookup ([#135](https://github.com/manifesto-ai/core/issues/135)) ([#140](https://github.com/manifesto-ai/core/issues/140)) ([2f88a17](https://github.com/manifesto-ai/core/commit/2f88a17ed6d2541ab00102d134bb77324b51b023))
* **core:** skip availability check on re-entry to prevent self-invalidation ([#134](https://github.com/manifesto-ai/core/issues/134)) ([#137](https://github.com/manifesto-ai/core/issues/137)) ([591edae](https://github.com/manifesto-ai/core/commit/591edaea6e8d2b61c31a225256b8c38e0bec2314))

## [2.3.0](https://github.com/manifesto-ai/core/compare/core-v2.2.0...core-v2.3.0) (2026-02-09)


### Features

* **core,builder,host:** implement MEL SPEC v0.3.1 expressions ([47d02bb](https://github.com/manifesto-ai/core/commit/47d02bbb915e6c853e6613ed7aa2fb16981d17ea))
* **core:** add inline array operations and computed values on genesis ([2f4958c](https://github.com/manifesto-ai/core/commit/2f4958c5dac20b4c95a24b224bb4b35e59c1b8e6))
* **core:** enhance validation, hashing, and HostContext support ([1dcae03](https://github.com/manifesto-ai/core/commit/1dcae0369a483f701a61a1d4ee57b6419c87f8cd))
* **core:** include intentId in input for once() guards ([5b84f30](https://github.com/manifesto-ai/core/commit/5b84f30fe79755ecc6ca3c0b9fb6ff9670e47cec))
* **integration-tests:** add full-stack integration test suite (L1-L6) ([66a704b](https://github.com/manifesto-ai/core/commit/66a704b93756d19e01a1d453d0ba1c17c5a7494c))
* **intent-ir:** implement Chomskyan LF-based Intent IR package (v0.1.0) ([000f1ba](https://github.com/manifesto-ai/core/commit/000f1ba64a09817e43ec746aeef030763dd734d9))
* **mel-compiler:** implement MEL SPEC v0.3.2 with array aggregation ([2674810](https://github.com/manifesto-ai/core/commit/2674810c2411e7fa9572d2c4074df0c7a4b760f0))
* **platform:** add  namespace and semantic schema hashing ([b7038a5](https://github.com/manifesto-ai/core/commit/b7038a57c4f4989ebda80589af57f08ec50c7fc7))
* sync updates from mind-protocol experimental branch ([85bf298](https://github.com/manifesto-ai/core/commit/85bf29860d5c35d5b7df442d75709fe09b544080))


### Bug Fixes

* **core,app:** ensure deterministic trace timestamps and prevent memory leak ([#86](https://github.com/manifesto-ai/core/issues/86)) ([64d20a2](https://github.com/manifesto-ai/core/commit/64d20a2def88eb2aae981ba696d6b9dc685f2607))

## [2.0.0] (2026-01-18)

### Features

* **core:** add computeSync for run-to-completion job handlers
* **core:** add sync requirementId generation and sync flow evaluation path

### Documentation

* **core:** document computeSync and sync requirementId path in SPEC

## [1.2.0](https://github.com/manifesto-ai/core/compare/core-v1.1.0...core-v1.2.0) (2026-01-03)


### Features

* **core,builder,host:** implement MEL SPEC v0.3.1 expressions ([47d02bb](https://github.com/manifesto-ai/core/commit/47d02bbb915e6c853e6613ed7aa2fb16981d17ea))
* **core:** enhance validation, hashing, and HostContext support ([1dcae03](https://github.com/manifesto-ai/core/commit/1dcae0369a483f701a61a1d4ee57b6419c87f8cd))
* **core:** include intentId in input for once() guards ([5b84f30](https://github.com/manifesto-ai/core/commit/5b84f30fe79755ecc6ca3c0b9fb6ff9670e47cec))
* **mel-compiler:** implement MEL SPEC v0.3.2 with array aggregation ([2674810](https://github.com/manifesto-ai/core/commit/2674810c2411e7fa9572d2c4074df0c7a4b760f0))
