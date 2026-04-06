# Changelog

## [2.10.0](https://github.com/manifesto-ai/core/compare/core-v2.9.0...core-v2.10.0) (2026-04-06)


### Features

* **runtime:** add schema graph introspection and align docs ([79fce9c](https://github.com/manifesto-ai/core/commit/79fce9ceec6885a1925e6017f1e3b97e8a9208f1))
* **runtime:** add schema graph introspection and sync docs ([b00c053](https://github.com/manifesto-ai/core/commit/b00c05337f929785763479fd0b3161309849a326))

## [2.9.0](https://github.com/manifesto-ai/core/compare/core-v2.8.0...core-v2.9.0) (2026-04-03)


### Features

* **sdk:** implement adr-018 public snapshot boundary ([47d05ad](https://github.com/manifesto-ai/core/commit/47d05ad702282f44331db4aa322697b3debeeaa4))

## [2.8.0](https://github.com/manifesto-ai/core/compare/core-v2.7.1...core-v2.8.0) (2026-03-30)


### Features

* land core v4 cleanup and action availability queries ([#331](https://github.com/manifesto-ai/core/issues/331)) ([30ec2b4](https://github.com/manifesto-ai/core/commit/30ec2b481cebbf2a2640fe21fd7909d6b033a1b4))

## [2.7.1](https://github.com/manifesto-ai/core/compare/core-v2.7.0...core-v2.7.1) (2026-03-25)


### Bug Fixes

* **core,sdk:** pin local vitest runtime dependencies ([f67885d](https://github.com/manifesto-ai/core/commit/f67885d44699281c816367ae71451c8bfdd708f1))

## [2.7.0](https://github.com/manifesto-ai/core/compare/core-v2.6.1...core-v2.7.0) (2026-03-25)


### Features

* **app:** add Snapshot DX aliases (App SPEC v2.3.2) ([#142](https://github.com/manifesto-ai/core/issues/142)) ([9bde2eb](https://github.com/manifesto-ai/core/commit/9bde2eb008d151574ac48e440d2fa6c93bac2e7b))
* **compiler:** implement SPEC v0.7.0 compiler baseline ([#289](https://github.com/manifesto-ai/core/issues/289)) ([35f1f00](https://github.com/manifesto-ai/core/commit/35f1f00550af700dfafe0283d777f71f68aa0dc5))
* **core:** add type-safe defineOps&lt;T&gt;() for typed PatchOps creation ([f4dc2cf](https://github.com/manifesto-ai/core/commit/f4dc2cfc024a2695c5c215a82c32ea008e160c0e))
* implement 27 new expression kinds in Core evaluator ([b67f96b](https://github.com/manifesto-ai/core/commit/b67f96b54f099dbc999eb6830ad1e64b2aa90515))


### Bug Fixes

* add field IR kind for static property access and fix at() record lookup ([#135](https://github.com/manifesto-ai/core/issues/135)) ([#140](https://github.com/manifesto-ai/core/issues/140)) ([2f88a17](https://github.com/manifesto-ai/core/commit/2f88a17ed6d2541ab00102d134bb77324b51b023))
* address PR [#193](https://github.com/manifesto-ai/core/issues/193) review — path collection for new ExprNode kinds and split edge case ([2cb0808](https://github.com/manifesto-ai/core/commit/2cb08084074dfeb2e4f7a168efce8e1cc4a5b276))
* **compiler,core:** add literal type validation for MEL state initializers and patches ([#282](https://github.com/manifesto-ai/core/issues/282)) ([fc4d2da](https://github.com/manifesto-ai/core/commit/fc4d2dad734bd02d5388b95cd0de1755bd992478))
* **core:** skip availability check on re-entry to prevent self-invalidation ([#134](https://github.com/manifesto-ai/core/issues/134)) ([#137](https://github.com/manifesto-ai/core/issues/137)) ([591edae](https://github.com/manifesto-ai/core/commit/591edaea6e8d2b61c31a225256b8c38e0bec2314))
* preserve empty segments when computing parent path ([aaed5be](https://github.com/manifesto-ai/core/commit/aaed5bef3d81aa80b7555e352d6d412c2820a1b5))

## [2.6.0](https://github.com/manifesto-ai/core/compare/core-v2.5.0...core-v2.6.0) (2026-02-24)


### Features

* implement 27 new expression kinds in Core evaluator ([b67f96b](https://github.com/manifesto-ai/core/commit/b67f96b54f099dbc999eb6830ad1e64b2aa90515))


### Bug Fixes

* address PR [#193](https://github.com/manifesto-ai/core/issues/193) review — path collection for new ExprNode kinds and split edge case ([2cb0808](https://github.com/manifesto-ai/core/commit/2cb08084074dfeb2e4f7a168efce8e1cc4a5b276))
* preserve empty segments when computing parent path ([aaed5be](https://github.com/manifesto-ai/core/commit/aaed5bef3d81aa80b7555e352d6d412c2820a1b5))

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
