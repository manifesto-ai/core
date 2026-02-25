# Changelog

## [0.1.4](https://github.com/manifesto-ai/core/compare/runtime-v0.1.3...runtime-v0.1.4) (2026-02-25)


### Bug Fixes

* address PR [#204](https://github.com/manifesto-ai/core/issues/204) review feedback (P1/P2 issues) ([f4b0fa6](https://github.com/manifesto-ai/core/commit/f4b0fa6d973ce32f8c4488c5ac0ac4fe0ba91b7b))
* **host-executor:** close cross-execution race on lock release timing ([333d790](https://github.com/manifesto-ai/core/commit/333d79019496012474dd0de51ba1bd310516b3d4))
* **host-executor:** detect Host fatal errors in drain loop ([02b57f5](https://github.com/manifesto-ai/core/commit/02b57f5f7e9b740581f2e06ead765b2931bf9e5c))
* **host-executor:** drain cap reports failure & setup cleanup always runs ([a339c83](https://github.com/manifesto-ai/core/commit/a339c83dc2d841b237183aa51d6237a8cf6ecc84))
* **host-executor:** drain loop premature exit & lock leak on setup throw ([a2c18c7](https://github.com/manifesto-ai/core/commit/a2c18c763ca2881e703c81cf9e12378f7be107f8))
* **host-executor:** stamp failure into terminal snapshot & harden reset guard ([97aef8a](https://github.com/manifesto-ai/core/commit/97aef8a2cfdecd5cabdd2335f06c9db94a0df7d0))
* normalize system slot names and support time.now in system lowering ([ace3788](https://github.com/manifesto-ai/core/commit/ace3788bbbacdd1c5937dcdbd9daca92014ae3af))
* normalize system slot names and support time.now in system lowering ([e5ec213](https://github.com/manifesto-ai/core/commit/e5ec21372db60d924750d06b73854f9ab62b4c71))
* **review:** hold lock until dispatch settles & harden isSnapshotLike guard ([ee4a4f2](https://github.com/manifesto-ai/core/commit/ee4a4f264fcf6366bcc555efcf6d6e3efd5b130c))
* **review:** restore missing type re-exports and guard abort during lock queue ([ec7e7a0](https://github.com/manifesto-ai/core/commit/ec7e7a076e58e096c5b706adcccebb139b955955))

## [0.1.3](https://github.com/manifesto-ai/core/compare/runtime-v0.1.2...runtime-v0.1.3) (2026-02-24)


### Bug Fixes

* **runtime:** align execution baseline and executionKey routing ([b727e10](https://github.com/manifesto-ai/core/commit/b727e10f7dd9be8110e907e2beaa89c2bea82b18))
* **runtime:** decouple intentId uniqueness from executionKey routing ([ce77026](https://github.com/manifesto-ai/core/commit/ce770266a26d90a3a06880959c6df51d449372ad))

## [0.1.2](https://github.com/manifesto-ai/core/compare/runtime-v0.1.1...runtime-v0.1.2) (2026-02-17)


### Bug Fixes

* **sdk:** stabilize bootstrap test import path for release CI ([a5c4509](https://github.com/manifesto-ai/core/commit/a5c4509d2c57833db584e9b43f8fc2e7effb3f69))
* **tests:** stabilize runtime and sdk bootstrap imports ([099da31](https://github.com/manifesto-ai/core/commit/099da317624e2c6abeb937421e6a9be4ba0fda1b))

## [0.1.1](https://github.com/manifesto-ai/core/compare/runtime-v0.1.0...runtime-v0.1.1) (2026-02-17)


### Features

* Phase2 R1 SDK-first transition (Track A) ([#159](https://github.com/manifesto-ai/core/issues/159)) ([57d7e66](https://github.com/manifesto-ai/core/commit/57d7e667fde2450c2a4608e5e0e5a76b0d0a3cee))
