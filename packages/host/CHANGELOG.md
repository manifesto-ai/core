# Changelog

## [2.8.0](https://github.com/manifesto-ai/core/compare/host-v2.7.0...host-v2.8.0) (2026-04-08)


### Features

* roll up ADR-020 dispatchability and schema typing ([e85ec08](https://github.com/manifesto-ai/core/commit/e85ec082f61c117ee1b22707739f7528979b15fd))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @manifesto-ai/core bumped to 2.11.0
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.10.0 to ^2.11.0

## [2.7.0](https://github.com/manifesto-ai/core/compare/host-v2.6.0...host-v2.7.0) (2026-04-06)


### Features

* **runtime:** add schema graph introspection and align docs ([79fce9c](https://github.com/manifesto-ai/core/commit/79fce9ceec6885a1925e6017f1e3b97e8a9208f1))
* **runtime:** add schema graph introspection and sync docs ([b00c053](https://github.com/manifesto-ai/core/commit/b00c05337f929785763479fd0b3161309849a326))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @manifesto-ai/core bumped to 2.10.0
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.9.0 to ^2.10.0

## [2.6.0](https://github.com/manifesto-ai/core/compare/host-v2.5.0...host-v2.6.0) (2026-04-03)


### Features

* **sdk:** implement adr-018 public snapshot boundary ([47d05ad](https://github.com/manifesto-ai/core/commit/47d05ad702282f44331db4aa322697b3debeeaa4))


### Bug Fixes

* **runtime:** handle literal expr payloads and typed arrays ([3e2ec34](https://github.com/manifesto-ai/core/commit/3e2ec34bc2b737ad3e71659879523691431b2de7))
* **runtime:** harden snapshot projection against cycles ([6a1b8e4](https://github.com/manifesto-ai/core/commit/6a1b8e477b6948c1638c231353bacbb568a038dd))
* **runtime:** isolate typed array snapshot reads ([e1487ad](https://github.com/manifesto-ai/core/commit/e1487ad9243e5c49a0c6f5642413e5f852e398a9))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @manifesto-ai/core bumped to 2.9.0
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.0.0 to ^2.9.0

## [2.5.0](https://github.com/manifesto-ai/core/compare/host-v2.4.0...host-v2.5.0) (2026-03-30)


### Features

* land core v4 cleanup and action availability queries ([#331](https://github.com/manifesto-ai/core/issues/331)) ([30ec2b4](https://github.com/manifesto-ai/core/commit/30ec2b481cebbf2a2640fe21fd7909d6b033a1b4))

## [2.4.0](https://github.com/manifesto-ai/core/compare/host-v2.3.5...host-v2.4.0) (2026-03-29)


### Features

* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))

## [2.3.5](https://github.com/manifesto-ai/core/compare/host-v2.3.4...host-v2.3.5) (2026-03-25)


### Bug Fixes

* address PR [#204](https://github.com/manifesto-ai/core/issues/204) review feedback (P1/P2 issues) ([f4b0fa6](https://github.com/manifesto-ai/core/commit/f4b0fa6d973ce32f8c4488c5ac0ac4fe0ba91b7b))
* **core:** skip availability check on re-entry to prevent self-invalidation ([#134](https://github.com/manifesto-ai/core/issues/134)) ([#137](https://github.com/manifesto-ai/core/issues/137)) ([591edae](https://github.com/manifesto-ai/core/commit/591edaea6e8d2b61c31a225256b8c38e0bec2314))
* **host-executor:** detect Host fatal errors in drain loop ([02b57f5](https://github.com/manifesto-ai/core/commit/02b57f5f7e9b740581f2e06ead765b2931bf9e5c))
* **host-executor:** drain loop premature exit & lock leak on setup throw ([a2c18c7](https://github.com/manifesto-ai/core/commit/a2c18c763ca2881e703c81cf9e12378f7be107f8))
* **host-executor:** stamp failure into terminal snapshot & harden reset guard ([97aef8a](https://github.com/manifesto-ai/core/commit/97aef8a2cfdecd5cabdd2335f06c9db94a0df7d0))
* normalize system slot names and support time.now in system lowering ([ace3788](https://github.com/manifesto-ai/core/commit/ace3788bbbacdd1c5937dcdbd9daca92014ae3af))
* normalize system slot names and support time.now in system lowering ([e5ec213](https://github.com/manifesto-ai/core/commit/e5ec21372db60d924750d06b73854f9ab62b4c71))
* **review:** hold lock until dispatch settles & harden isSnapshotLike guard ([ee4a4f2](https://github.com/manifesto-ai/core/commit/ee4a4f264fcf6366bcc555efcf6d6e3efd5b130c))
* **runtime:** decouple intentId uniqueness from executionKey routing ([ce77026](https://github.com/manifesto-ai/core/commit/ce770266a26d90a3a06880959c6df51d449372ad))
* **test:** pin local vite runtimes for package vitest ([2da24f8](https://github.com/manifesto-ai/core/commit/2da24f89da7f618da3bd58f13a5c3d565b29251c))

## [2.3.3](https://github.com/manifesto-ai/core/compare/host-v2.3.2...host-v2.3.3) (2026-02-25)


### Bug Fixes

* address PR [#204](https://github.com/manifesto-ai/core/issues/204) review feedback (P1/P2 issues) ([f4b0fa6](https://github.com/manifesto-ai/core/commit/f4b0fa6d973ce32f8c4488c5ac0ac4fe0ba91b7b))
* **host-executor:** detect Host fatal errors in drain loop ([02b57f5](https://github.com/manifesto-ai/core/commit/02b57f5f7e9b740581f2e06ead765b2931bf9e5c))
* **host-executor:** drain loop premature exit & lock leak on setup throw ([a2c18c7](https://github.com/manifesto-ai/core/commit/a2c18c763ca2881e703c81cf9e12378f7be107f8))
* **host-executor:** stamp failure into terminal snapshot & harden reset guard ([97aef8a](https://github.com/manifesto-ai/core/commit/97aef8a2cfdecd5cabdd2335f06c9db94a0df7d0))
* normalize system slot names and support time.now in system lowering ([ace3788](https://github.com/manifesto-ai/core/commit/ace3788bbbacdd1c5937dcdbd9daca92014ae3af))
* normalize system slot names and support time.now in system lowering ([e5ec213](https://github.com/manifesto-ai/core/commit/e5ec21372db60d924750d06b73854f9ab62b4c71))
* **review:** hold lock until dispatch settles & harden isSnapshotLike guard ([ee4a4f2](https://github.com/manifesto-ai/core/commit/ee4a4f264fcf6366bcc555efcf6d6e3efd5b130c))

## [2.3.2](https://github.com/manifesto-ai/core/compare/host-v2.3.1...host-v2.3.2) (2026-02-24)


### Bug Fixes

* **runtime:** decouple intentId uniqueness from executionKey routing ([ce77026](https://github.com/manifesto-ai/core/commit/ce770266a26d90a3a06880959c6df51d449372ad))

## [2.3.1](https://github.com/manifesto-ai/core/compare/host-v2.3.0...host-v2.3.1) (2026-02-10)


### Bug Fixes

* **core:** skip availability check on re-entry to prevent self-invalidation ([#134](https://github.com/manifesto-ai/core/issues/134)) ([#137](https://github.com/manifesto-ai/core/issues/137)) ([591edae](https://github.com/manifesto-ai/core/commit/591edaea6e8d2b61c31a225256b8c38e0bec2314))

## [2.3.0](https://github.com/manifesto-ai/core/compare/host-v2.2.0...host-v2.3.0) (2026-02-09)


### Features

* **core,builder,host:** implement MEL SPEC v0.3.1 expressions ([47d02bb](https://github.com/manifesto-ai/core/commit/47d02bbb915e6c853e6613ed7aa2fb16981d17ea))
* **core:** add inline array operations and computed values on genesis ([2f4958c](https://github.com/manifesto-ai/core/commit/2f4958c5dac20b4c95a24b224bb4b35e59c1b8e6))
* **host:** add HostContext and improve compute loop ([70858f8](https://github.com/manifesto-ai/core/commit/70858f8547924cd4e50c50f9823df9bb4a093ab5))
* **host:** add v1.1 Compiler integration for Translator support ([2327bf0](https://github.com/manifesto-ai/core/commit/2327bf08bf138781806fd29a6920d9f4f4c12aa6))
* **integration-tests:** add full-stack integration test suite (L1-L6) ([66a704b](https://github.com/manifesto-ai/core/commit/66a704b93756d19e01a1d453d0ba1c17c5a7494c))

## [1.2.0](https://github.com/manifesto-ai/core/compare/host-v1.1.0...host-v1.2.0) (2026-01-03)


### Features

* **core,builder,host:** implement MEL SPEC v0.3.1 expressions ([47d02bb](https://github.com/manifesto-ai/core/commit/47d02bbb915e6c853e6613ed7aa2fb16981d17ea))
* **host:** add HostContext and improve compute loop ([70858f8](https://github.com/manifesto-ai/core/commit/70858f8547924cd4e50c50f9823df9bb4a093ab5))
