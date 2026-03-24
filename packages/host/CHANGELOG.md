# Changelog

## [2.3.5](https://github.com/manifesto-ai/core/compare/host-v2.3.4...host-v2.3.5) (2026-03-24)


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
