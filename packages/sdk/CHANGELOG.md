# Changelog

## [3.15.1](https://github.com/manifesto-ai/core/compare/sdk-v3.15.0...sdk-v3.15.1) (2026-04-17)


### Bug Fixes

* **sdk:** move base runtime helper to provider seam ([#435](https://github.com/manifesto-ai/core/issues/435)) ([f33a1c7](https://github.com/manifesto-ai/core/commit/f33a1c77390e5a8c383460e588d295fb98c49a8f))

## [3.15.0](https://github.com/manifesto-ai/core/compare/sdk-v3.14.0...sdk-v3.15.0) (2026-04-16)


### Features

* **compiler:** add source map sidecar contract ([#433](https://github.com/manifesto-ai/core/issues/433)) ([deb5d59](https://github.com/manifesto-ai/core/commit/deb5d59b8e0943a0dbef68f45d519329f53932f4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/compiler bumped to 3.7.0

## [3.14.0](https://github.com/manifesto-ai/core/compare/sdk-v3.13.1...sdk-v3.14.0) (2026-04-15)


### Features

* **compiler:** add [@meta](https://github.com/meta) structural annotation support ([#430](https://github.com/manifesto-ai/core/issues/430)) ([41b6ac3](https://github.com/manifesto-ai/core/commit/41b6ac3cc049687a12898b299021a7cba56913b3))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/compiler bumped to 3.6.0

## [3.13.1](https://github.com/manifesto-ai/core/compare/sdk-v3.13.0...sdk-v3.13.1) (2026-04-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/compiler bumped to 3.5.0

## [3.13.0](https://github.com/manifesto-ai/core/compare/sdk-v3.12.1...sdk-v3.13.0) (2026-04-13)


### Features

* **runtime:** add family reports and narrow provider seams ([693d669](https://github.com/manifesto-ai/core/commit/693d66946530f7986631d9665c703b1b61418f96))
* **runtime:** add family reports and narrow provider seams ([27277ec](https://github.com/manifesto-ai/core/commit/27277ec190b365abd8248b7e74b84f7995618db4))


### Bug Fixes

* **sdk:** recheck dispose inside queued dispatch callbacks ([9066297](https://github.com/manifesto-ai/core/commit/90662976fd66bf715baaf168d26ef5948598d072))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/compiler bumped to 3.4.0
    * @manifesto-ai/core bumped to 2.12.0
    * @manifesto-ai/host bumped to 2.9.0

## [3.12.1](https://github.com/manifesto-ai/core/compare/sdk-v3.12.0...sdk-v3.12.1) (2026-04-12)


### Bug Fixes

* **docs:** align clean urls and favicon links ([0db1df5](https://github.com/manifesto-ai/core/commit/0db1df54599619026f41bb14317a27ca21498644))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/compiler bumped to 3.3.1
    * @manifesto-ai/core bumped to 2.11.1
    * @manifesto-ai/host bumped to 2.8.1

## [3.12.0](https://github.com/manifesto-ai/core/compare/sdk-v3.11.0...sdk-v3.12.0) (2026-04-12)


### Features

* add sdk intent explanation reads and hard-cut docs flow ([6a0b528](https://github.com/manifesto-ai/core/commit/6a0b5280081b7bfc0af5be2720468663a0944fa0))
* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))
* **governance:** add waitForProposal observer ([94be2f1](https://github.com/manifesto-ai/core/commit/94be2f1e24c8228b4542393048090cd7dbd15929))
* **governance:** add waitForProposal observer ([26ccdf8](https://github.com/manifesto-ai/core/commit/26ccdf8842679f059b083584a7635edc14011d00))
* implement ADR-020 dispatchability ([606fe7b](https://github.com/manifesto-ai/core/commit/606fe7b3b5e1679e918f5b24fb1e0233f8c24660))
* land core v4 cleanup and action availability queries ([#331](https://github.com/manifesto-ai/core/issues/331)) ([30ec2b4](https://github.com/manifesto-ai/core/commit/30ec2b481cebbf2a2640fe21fd7909d6b033a1b4))
* Phase2 R1 SDK-first transition (Track A) ([#159](https://github.com/manifesto-ai/core/issues/159)) ([57d7e66](https://github.com/manifesto-ai/core/commit/57d7e667fde2450c2a4608e5e0e5a76b0d0a3cee))
* **r2:** retire @manifesto-ai/app and lock no-app import guard ([1834515](https://github.com/manifesto-ai/core/commit/18345151bb0a9a29f4199fbc7d64ba291d40183e))
* **r2:** retire app package and enforce sdk-only guard ([53c9c3b](https://github.com/manifesto-ai/core/commit/53c9c3b9ef596341e3afc1295a9b7ecb3b26a92e))
* roll up ADR-020 dispatchability and schema typing ([e85ec08](https://github.com/manifesto-ai/core/commit/e85ec082f61c117ee1b22707739f7528979b15fd))
* **runtime:** add schema graph introspection and align docs ([79fce9c](https://github.com/manifesto-ai/core/commit/79fce9ceec6885a1925e6017f1e3b97e8a9208f1))
* **runtime:** add schema graph introspection and sync docs ([b00c053](https://github.com/manifesto-ai/core/commit/b00c05337f929785763479fd0b3161309849a326))
* **schema:** support record and nullable schema positions ([59a0cfa](https://github.com/manifesto-ai/core/commit/59a0cfaf5b0117e6a7f143ce90e67964f8d37618))
* **sdk,docs,release:** execute phase2 r1 sdk-first transition ([01bf29e](https://github.com/manifesto-ai/core/commit/01bf29e03c4b079838bacca35c9e948d4af06590))
* **sdk:** add defineEffects patch builder ([4aa15c8](https://github.com/manifesto-ai/core/commit/4aa15c8b975423745fc26973688d317a2e217de7))
* **sdk:** add defineEffects patch builder ([57b60ce](https://github.com/manifesto-ai/core/commit/57b60ce645b102c4eb9dfa695d59a1e5e417406a))
* **sdk:** add dispatchAsync utility ([#238](https://github.com/manifesto-ai/core/issues/238)) ([e34fcfa](https://github.com/manifesto-ai/core/commit/e34fcfafd1109da6eeefab9ab167c54c9f54a689))
* **sdk:** add intent explanation reads ([efbb11b](https://github.com/manifesto-ai/core/commit/efbb11b3709436fca511b34e607c50a9b98e23dc))
* **sdk:** add planner runtime kernel seam ([040af7a](https://github.com/manifesto-ai/core/commit/040af7a13cc3fc84ba114ccb7b2a3d68416b391e))
* **sdk:** allow object binding for single-param intents ([afd6207](https://github.com/manifesto-ai/core/commit/afd6207a1454c287ab140d83e5335517cb6fd875))
* **sdk:** implement adr-018 public snapshot boundary ([47d05ad](https://github.com/manifesto-ai/core/commit/47d05ad702282f44331db4aa322697b3debeeaa4))
* **sdk:** propagate Snapshot&lt;T&gt; generics and typed event map ([#239](https://github.com/manifesto-ai/core/issues/239), [#246](https://github.com/manifesto-ai/core/issues/246)) ([8a5b40a](https://github.com/manifesto-ai/core/commit/8a5b40acb8f1cf44187a09a407dd30c988b4c46d))
* super hard cut world facade ([a5d33f9](https://github.com/manifesto-ai/core/commit/a5d33f98cfcfea914e445900fc2410766e0f1358))


### Bug Fixes

* address ADR-020 review feedback ([029a3b6](https://github.com/manifesto-ai/core/commit/029a3b6832aae04f23309dfe428e2cb22bb1fdcc))
* address escaped path and ref input review feedback ([2541a6e](https://github.com/manifesto-ai/core/commit/2541a6e649502d09e0ab5ef360ed000c01b21c3b))
* address follow-up ADR-020 review feedback ([c0e6244](https://github.com/manifesto-ai/core/commit/c0e6244063ba666b459c1fd049c4d00a5c6f2a86))
* address typing seam and input validation feedback ([aa0903a](https://github.com/manifesto-ai/core/commit/aa0903ab8c705c3774d710f45f4e838547804154))
* align input preflight and governance rejection events ([8fcca8e](https://github.com/manifesto-ai/core/commit/8fcca8e37a9c85b6e006f1911650f90af4742030))
* normalize system slot names and support time.now in system lowering ([ace3788](https://github.com/manifesto-ai/core/commit/ace3788bbbacdd1c5937dcdbd9daca92014ae3af))
* normalize system slot names and support time.now in system lowering ([e5ec213](https://github.com/manifesto-ai/core/commit/e5ec21372db60d924750d06b73854f9ab62b4c71))
* preserve governed seal outcomes and execution keys ([dc40be6](https://github.com/manifesto-ai/core/commit/dc40be6ebd1a5ed2dfdd194693e3efd240f54019))
* relax action shape upper bound ([c7204ea](https://github.com/manifesto-ai/core/commit/c7204eaa4a65e37d72ac70472d0c7a43e264a890))
* **runtime:** handle literal expr payloads and typed arrays ([3e2ec34](https://github.com/manifesto-ai/core/commit/3e2ec34bc2b737ad3e71659879523691431b2de7))
* **runtime:** harden snapshot projection against cycles ([6a1b8e4](https://github.com/manifesto-ai/core/commit/6a1b8e477b6948c1638c231353bacbb568a038dd))
* **runtime:** isolate typed array snapshot reads ([e1487ad](https://github.com/manifesto-ai/core/commit/e1487ad9243e5c49a0c6f5642413e5f852e398a9))
* **sdk,compiler:** expose MEL compile diagnostics with source locations ([#187](https://github.com/manifesto-ai/core/issues/187)) ([c4e08b5](https://github.com/manifesto-ai/core/commit/c4e08b56a63687dc4adc74c4adfa1e4d9da0156a))
* **sdk:** address PR review — exclude undefined from set(), enrich error() metadata ([705d9f8](https://github.com/manifesto-ai/core/commit/705d9f89790ddf5c7c9e0e7068140950e6ea0ecc))
* **sdk:** compare sparse projected arrays precisely ([d03bb4f](https://github.com/manifesto-ai/core/commit/d03bb4f9acb37892c2f7b5151f21ca884760347e))
* **sdk:** correct depth limit off-by-one and add usage pattern tests ([03389b6](https://github.com/manifesto-ai/core/commit/03389b6d0d8e6127b57ec3a053c4f31ded154660))
* **sdk:** derive projection visibility from expr reads ([32647b5](https://github.com/manifesto-ai/core/commit/32647b5a4297967788c37e02de58888e66cd0441))
* **sdk:** exclude reserved snapshot roots from typed paths ([0a3c663](https://github.com/manifesto-ai/core/commit/0a3c6633cd799655401f1d665a3b3c55ac907db0))
* **sdk:** freeze simulation session intents ([a109088](https://github.com/manifesto-ai/core/commit/a10908863f5baa6b75005b7773d1186ac36141c7))
* **sdk:** guard snapshot freezing against cycles ([677b4c9](https://github.com/manifesto-ai/core/commit/677b4c907d80209aadad3195304b8e9d25b1c165))
* **sdk:** mirror host intent slots in simulate ([e4870aa](https://github.com/manifesto-ai/core/commit/e4870aa6dbe038787a16f1815ca72feb0a463fde))
* **sdk:** normalize slash platform projection ([5815e25](https://github.com/manifesto-ai/core/commit/5815e259b84942ab8b06d0f4a03d7840e55245c7))
* **sdk:** pin local vitest runtime dependencies ([44e3fa6](https://github.com/manifesto-ai/core/commit/44e3fa616190928a3af84a0d0d8b7784b066d94f))
* **sdk:** populate genesis snapshot from schema defaults ([#240](https://github.com/manifesto-ai/core/issues/240)) ([35f83f5](https://github.com/manifesto-ai/core/commit/35f83f50fcade1780d2250d930c9229a1eae7cd1))
* **sdk:** restore direct action availability check ([39a26c0](https://github.com/manifesto-ai/core/commit/39a26c02c37e84c94df3fc6be97ef89a5e4e9a0d))
* **sdk:** stabilize bootstrap bootstrap test imports ([7902afa](https://github.com/manifesto-ai/core/commit/7902afab68215a23ec7bfe56d618955d44b0d35a))
* **sdk:** stabilize bootstrap test import path for release CI ([a5c4509](https://github.com/manifesto-ai/core/commit/a5c4509d2c57833db584e9b43f8fc2e7effb3f69))
* **sdk:** stop DataPaths recursion into Record fields, exclude undefined from merge ([d6c1f42](https://github.com/manifesto-ai/core/commit/d6c1f428810cb83dbb1b92d6ea3971af4223ed20))
* **sdk:** tighten defineEffects value inference ([eca806a](https://github.com/manifesto-ai/core/commit/eca806a25a66c87c1398241fdf05a022dc789c24))

## [3.11.0](https://github.com/manifesto-ai/core/compare/sdk-v3.10.0...sdk-v3.11.0) (2026-04-12)


### Features

* add sdk intent explanation reads and hard-cut docs flow ([6a0b528](https://github.com/manifesto-ai/core/commit/6a0b5280081b7bfc0af5be2720468663a0944fa0))
* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))
* **governance:** add waitForProposal observer ([94be2f1](https://github.com/manifesto-ai/core/commit/94be2f1e24c8228b4542393048090cd7dbd15929))
* **governance:** add waitForProposal observer ([26ccdf8](https://github.com/manifesto-ai/core/commit/26ccdf8842679f059b083584a7635edc14011d00))
* implement ADR-020 dispatchability ([606fe7b](https://github.com/manifesto-ai/core/commit/606fe7b3b5e1679e918f5b24fb1e0233f8c24660))
* land core v4 cleanup and action availability queries ([#331](https://github.com/manifesto-ai/core/issues/331)) ([30ec2b4](https://github.com/manifesto-ai/core/commit/30ec2b481cebbf2a2640fe21fd7909d6b033a1b4))
* Phase2 R1 SDK-first transition (Track A) ([#159](https://github.com/manifesto-ai/core/issues/159)) ([57d7e66](https://github.com/manifesto-ai/core/commit/57d7e667fde2450c2a4608e5e0e5a76b0d0a3cee))
* **r2:** retire @manifesto-ai/app and lock no-app import guard ([1834515](https://github.com/manifesto-ai/core/commit/18345151bb0a9a29f4199fbc7d64ba291d40183e))
* **r2:** retire app package and enforce sdk-only guard ([53c9c3b](https://github.com/manifesto-ai/core/commit/53c9c3b9ef596341e3afc1295a9b7ecb3b26a92e))
* roll up ADR-020 dispatchability and schema typing ([e85ec08](https://github.com/manifesto-ai/core/commit/e85ec082f61c117ee1b22707739f7528979b15fd))
* **runtime:** add schema graph introspection and align docs ([79fce9c](https://github.com/manifesto-ai/core/commit/79fce9ceec6885a1925e6017f1e3b97e8a9208f1))
* **runtime:** add schema graph introspection and sync docs ([b00c053](https://github.com/manifesto-ai/core/commit/b00c05337f929785763479fd0b3161309849a326))
* **schema:** support record and nullable schema positions ([59a0cfa](https://github.com/manifesto-ai/core/commit/59a0cfaf5b0117e6a7f143ce90e67964f8d37618))
* **sdk,docs,release:** execute phase2 r1 sdk-first transition ([01bf29e](https://github.com/manifesto-ai/core/commit/01bf29e03c4b079838bacca35c9e948d4af06590))
* **sdk:** add defineEffects patch builder ([4aa15c8](https://github.com/manifesto-ai/core/commit/4aa15c8b975423745fc26973688d317a2e217de7))
* **sdk:** add defineEffects patch builder ([57b60ce](https://github.com/manifesto-ai/core/commit/57b60ce645b102c4eb9dfa695d59a1e5e417406a))
* **sdk:** add dispatchAsync utility ([#238](https://github.com/manifesto-ai/core/issues/238)) ([e34fcfa](https://github.com/manifesto-ai/core/commit/e34fcfafd1109da6eeefab9ab167c54c9f54a689))
* **sdk:** add intent explanation reads ([efbb11b](https://github.com/manifesto-ai/core/commit/efbb11b3709436fca511b34e607c50a9b98e23dc))
* **sdk:** add planner runtime kernel seam ([040af7a](https://github.com/manifesto-ai/core/commit/040af7a13cc3fc84ba114ccb7b2a3d68416b391e))
* **sdk:** allow object binding for single-param intents ([afd6207](https://github.com/manifesto-ai/core/commit/afd6207a1454c287ab140d83e5335517cb6fd875))
* **sdk:** implement adr-018 public snapshot boundary ([47d05ad](https://github.com/manifesto-ai/core/commit/47d05ad702282f44331db4aa322697b3debeeaa4))
* **sdk:** propagate Snapshot&lt;T&gt; generics and typed event map ([#239](https://github.com/manifesto-ai/core/issues/239), [#246](https://github.com/manifesto-ai/core/issues/246)) ([8a5b40a](https://github.com/manifesto-ai/core/commit/8a5b40acb8f1cf44187a09a407dd30c988b4c46d))
* super hard cut world facade ([a5d33f9](https://github.com/manifesto-ai/core/commit/a5d33f98cfcfea914e445900fc2410766e0f1358))


### Bug Fixes

* address ADR-020 review feedback ([029a3b6](https://github.com/manifesto-ai/core/commit/029a3b6832aae04f23309dfe428e2cb22bb1fdcc))
* address escaped path and ref input review feedback ([2541a6e](https://github.com/manifesto-ai/core/commit/2541a6e649502d09e0ab5ef360ed000c01b21c3b))
* address follow-up ADR-020 review feedback ([c0e6244](https://github.com/manifesto-ai/core/commit/c0e6244063ba666b459c1fd049c4d00a5c6f2a86))
* address typing seam and input validation feedback ([aa0903a](https://github.com/manifesto-ai/core/commit/aa0903ab8c705c3774d710f45f4e838547804154))
* align input preflight and governance rejection events ([8fcca8e](https://github.com/manifesto-ai/core/commit/8fcca8e37a9c85b6e006f1911650f90af4742030))
* normalize system slot names and support time.now in system lowering ([ace3788](https://github.com/manifesto-ai/core/commit/ace3788bbbacdd1c5937dcdbd9daca92014ae3af))
* normalize system slot names and support time.now in system lowering ([e5ec213](https://github.com/manifesto-ai/core/commit/e5ec21372db60d924750d06b73854f9ab62b4c71))
* preserve governed seal outcomes and execution keys ([dc40be6](https://github.com/manifesto-ai/core/commit/dc40be6ebd1a5ed2dfdd194693e3efd240f54019))
* relax action shape upper bound ([c7204ea](https://github.com/manifesto-ai/core/commit/c7204eaa4a65e37d72ac70472d0c7a43e264a890))
* **runtime:** handle literal expr payloads and typed arrays ([3e2ec34](https://github.com/manifesto-ai/core/commit/3e2ec34bc2b737ad3e71659879523691431b2de7))
* **runtime:** harden snapshot projection against cycles ([6a1b8e4](https://github.com/manifesto-ai/core/commit/6a1b8e477b6948c1638c231353bacbb568a038dd))
* **runtime:** isolate typed array snapshot reads ([e1487ad](https://github.com/manifesto-ai/core/commit/e1487ad9243e5c49a0c6f5642413e5f852e398a9))
* **sdk,compiler:** expose MEL compile diagnostics with source locations ([#187](https://github.com/manifesto-ai/core/issues/187)) ([c4e08b5](https://github.com/manifesto-ai/core/commit/c4e08b56a63687dc4adc74c4adfa1e4d9da0156a))
* **sdk:** address PR review — exclude undefined from set(), enrich error() metadata ([705d9f8](https://github.com/manifesto-ai/core/commit/705d9f89790ddf5c7c9e0e7068140950e6ea0ecc))
* **sdk:** compare sparse projected arrays precisely ([d03bb4f](https://github.com/manifesto-ai/core/commit/d03bb4f9acb37892c2f7b5151f21ca884760347e))
* **sdk:** correct depth limit off-by-one and add usage pattern tests ([03389b6](https://github.com/manifesto-ai/core/commit/03389b6d0d8e6127b57ec3a053c4f31ded154660))
* **sdk:** derive projection visibility from expr reads ([32647b5](https://github.com/manifesto-ai/core/commit/32647b5a4297967788c37e02de58888e66cd0441))
* **sdk:** exclude reserved snapshot roots from typed paths ([0a3c663](https://github.com/manifesto-ai/core/commit/0a3c6633cd799655401f1d665a3b3c55ac907db0))
* **sdk:** freeze simulation session intents ([a109088](https://github.com/manifesto-ai/core/commit/a10908863f5baa6b75005b7773d1186ac36141c7))
* **sdk:** guard snapshot freezing against cycles ([677b4c9](https://github.com/manifesto-ai/core/commit/677b4c907d80209aadad3195304b8e9d25b1c165))
* **sdk:** mirror host intent slots in simulate ([e4870aa](https://github.com/manifesto-ai/core/commit/e4870aa6dbe038787a16f1815ca72feb0a463fde))
* **sdk:** normalize slash platform projection ([5815e25](https://github.com/manifesto-ai/core/commit/5815e259b84942ab8b06d0f4a03d7840e55245c7))
* **sdk:** pin local vitest runtime dependencies ([44e3fa6](https://github.com/manifesto-ai/core/commit/44e3fa616190928a3af84a0d0d8b7784b066d94f))
* **sdk:** populate genesis snapshot from schema defaults ([#240](https://github.com/manifesto-ai/core/issues/240)) ([35f83f5](https://github.com/manifesto-ai/core/commit/35f83f50fcade1780d2250d930c9229a1eae7cd1))
* **sdk:** restore direct action availability check ([39a26c0](https://github.com/manifesto-ai/core/commit/39a26c02c37e84c94df3fc6be97ef89a5e4e9a0d))
* **sdk:** stabilize bootstrap bootstrap test imports ([7902afa](https://github.com/manifesto-ai/core/commit/7902afab68215a23ec7bfe56d618955d44b0d35a))
* **sdk:** stabilize bootstrap test import path for release CI ([a5c4509](https://github.com/manifesto-ai/core/commit/a5c4509d2c57833db584e9b43f8fc2e7effb3f69))
* **sdk:** stop DataPaths recursion into Record fields, exclude undefined from merge ([d6c1f42](https://github.com/manifesto-ai/core/commit/d6c1f428810cb83dbb1b92d6ea3971af4223ed20))
* **sdk:** tighten defineEffects value inference ([eca806a](https://github.com/manifesto-ai/core/commit/eca806a25a66c87c1398241fdf05a022dc789c24))

## [3.10.0](https://github.com/manifesto-ai/core/compare/sdk-v3.9.0...sdk-v3.10.0) (2026-04-12)


### Features

* **sdk:** add defineEffects patch builder ([4aa15c8](https://github.com/manifesto-ai/core/commit/4aa15c8b975423745fc26973688d317a2e217de7))
* **sdk:** add defineEffects patch builder ([57b60ce](https://github.com/manifesto-ai/core/commit/57b60ce645b102c4eb9dfa695d59a1e5e417406a))


### Bug Fixes

* **sdk:** tighten defineEffects value inference ([eca806a](https://github.com/manifesto-ai/core/commit/eca806a25a66c87c1398241fdf05a022dc789c24))

## [3.9.0](https://github.com/manifesto-ai/core/compare/sdk-v3.8.0...sdk-v3.9.0) (2026-04-12)


### Features

* **governance:** add waitForProposal observer ([94be2f1](https://github.com/manifesto-ai/core/commit/94be2f1e24c8228b4542393048090cd7dbd15929))
* **governance:** add waitForProposal observer ([26ccdf8](https://github.com/manifesto-ai/core/commit/26ccdf8842679f059b083584a7635edc14011d00))

## [3.8.0](https://github.com/manifesto-ai/core/compare/sdk-v3.7.0...sdk-v3.8.0) (2026-04-09)


### Features

* add sdk intent explanation reads and hard-cut docs flow ([6a0b528](https://github.com/manifesto-ai/core/commit/6a0b5280081b7bfc0af5be2720468663a0944fa0))
* **sdk:** add intent explanation reads ([efbb11b](https://github.com/manifesto-ai/core/commit/efbb11b3709436fca511b34e607c50a9b98e23dc))

## [3.7.0](https://github.com/manifesto-ai/core/compare/sdk-v3.6.0...sdk-v3.7.0) (2026-04-08)


### Features

* implement ADR-020 dispatchability ([606fe7b](https://github.com/manifesto-ai/core/commit/606fe7b3b5e1679e918f5b24fb1e0233f8c24660))
* roll up ADR-020 dispatchability and schema typing ([e85ec08](https://github.com/manifesto-ai/core/commit/e85ec082f61c117ee1b22707739f7528979b15fd))
* **schema:** support record and nullable schema positions ([59a0cfa](https://github.com/manifesto-ai/core/commit/59a0cfaf5b0117e6a7f143ce90e67964f8d37618))
* **sdk:** allow object binding for single-param intents ([afd6207](https://github.com/manifesto-ai/core/commit/afd6207a1454c287ab140d83e5335517cb6fd875))


### Bug Fixes

* address ADR-020 review feedback ([029a3b6](https://github.com/manifesto-ai/core/commit/029a3b6832aae04f23309dfe428e2cb22bb1fdcc))
* address escaped path and ref input review feedback ([2541a6e](https://github.com/manifesto-ai/core/commit/2541a6e649502d09e0ab5ef360ed000c01b21c3b))
* address follow-up ADR-020 review feedback ([c0e6244](https://github.com/manifesto-ai/core/commit/c0e6244063ba666b459c1fd049c4d00a5c6f2a86))
* address typing seam and input validation feedback ([aa0903a](https://github.com/manifesto-ai/core/commit/aa0903ab8c705c3774d710f45f4e838547804154))
* align input preflight and governance rejection events ([8fcca8e](https://github.com/manifesto-ai/core/commit/8fcca8e37a9c85b6e006f1911650f90af4742030))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/compiler bumped to 3.3.0
    * @manifesto-ai/core bumped to 2.11.0
    * @manifesto-ai/host bumped to 2.8.0

## [3.6.0](https://github.com/manifesto-ai/core/compare/sdk-v3.5.0...sdk-v3.6.0) (2026-04-07)


### Features

* **sdk:** add planner runtime kernel seam ([040af7a](https://github.com/manifesto-ai/core/commit/040af7a13cc3fc84ba114ccb7b2a3d68416b391e))


### Bug Fixes

* **sdk:** freeze simulation session intents ([a109088](https://github.com/manifesto-ai/core/commit/a10908863f5baa6b75005b7773d1186ac36141c7))

## [3.5.0](https://github.com/manifesto-ai/core/compare/sdk-v3.4.0...sdk-v3.5.0) (2026-04-06)


### Features

* **runtime:** add schema graph introspection and align docs ([79fce9c](https://github.com/manifesto-ai/core/commit/79fce9ceec6885a1925e6017f1e3b97e8a9208f1))
* **runtime:** add schema graph introspection and sync docs ([b00c053](https://github.com/manifesto-ai/core/commit/b00c05337f929785763479fd0b3161309849a326))


### Bug Fixes

* **sdk:** mirror host intent slots in simulate ([e4870aa](https://github.com/manifesto-ai/core/commit/e4870aa6dbe038787a16f1815ca72feb0a463fde))
* **sdk:** normalize slash platform projection ([5815e25](https://github.com/manifesto-ai/core/commit/5815e259b84942ab8b06d0f4a03d7840e55245c7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/compiler bumped to 3.2.0
    * @manifesto-ai/core bumped to 2.10.0
    * @manifesto-ai/host bumped to 2.7.0

## [3.4.0](https://github.com/manifesto-ai/core/compare/sdk-v3.3.2...sdk-v3.4.0) (2026-04-03)


### Features

* **sdk:** implement adr-018 public snapshot boundary ([47d05ad](https://github.com/manifesto-ai/core/commit/47d05ad702282f44331db4aa322697b3debeeaa4))


### Bug Fixes

* **runtime:** handle literal expr payloads and typed arrays ([3e2ec34](https://github.com/manifesto-ai/core/commit/3e2ec34bc2b737ad3e71659879523691431b2de7))
* **runtime:** harden snapshot projection against cycles ([6a1b8e4](https://github.com/manifesto-ai/core/commit/6a1b8e477b6948c1638c231353bacbb568a038dd))
* **runtime:** isolate typed array snapshot reads ([e1487ad](https://github.com/manifesto-ai/core/commit/e1487ad9243e5c49a0c6f5642413e5f852e398a9))
* **sdk:** compare sparse projected arrays precisely ([d03bb4f](https://github.com/manifesto-ai/core/commit/d03bb4f9acb37892c2f7b5151f21ca884760347e))
* **sdk:** derive projection visibility from expr reads ([32647b5](https://github.com/manifesto-ai/core/commit/32647b5a4297967788c37e02de58888e66cd0441))
* **sdk:** guard snapshot freezing against cycles ([677b4c9](https://github.com/manifesto-ai/core/commit/677b4c907d80209aadad3195304b8e9d25b1c165))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/compiler bumped to 3.1.1
    * @manifesto-ai/core bumped to 2.9.0
    * @manifesto-ai/host bumped to 2.6.0

## [3.3.2](https://github.com/manifesto-ai/core/compare/sdk-v3.3.1...sdk-v3.3.2) (2026-04-02)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/compiler bumped to 3.1.0

## [3.3.1](https://github.com/manifesto-ai/core/compare/sdk-v3.3.0...sdk-v3.3.1) (2026-04-02)


### Bug Fixes

* **sdk:** restore direct action availability check ([39a26c0](https://github.com/manifesto-ai/core/commit/39a26c02c37e84c94df3fc6be97ef89a5e4e9a0d))

## [3.3.0](https://github.com/manifesto-ai/core/compare/sdk-v3.2.0...sdk-v3.3.0) (2026-04-02)


### Features

* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))
* land core v4 cleanup and action availability queries ([#331](https://github.com/manifesto-ai/core/issues/331)) ([30ec2b4](https://github.com/manifesto-ai/core/commit/30ec2b481cebbf2a2640fe21fd7909d6b033a1b4))
* Phase2 R1 SDK-first transition (Track A) ([#159](https://github.com/manifesto-ai/core/issues/159)) ([57d7e66](https://github.com/manifesto-ai/core/commit/57d7e667fde2450c2a4608e5e0e5a76b0d0a3cee))
* **r2:** retire @manifesto-ai/app and lock no-app import guard ([1834515](https://github.com/manifesto-ai/core/commit/18345151bb0a9a29f4199fbc7d64ba291d40183e))
* **r2:** retire app package and enforce sdk-only guard ([53c9c3b](https://github.com/manifesto-ai/core/commit/53c9c3b9ef596341e3afc1295a9b7ecb3b26a92e))
* **sdk,docs,release:** execute phase2 r1 sdk-first transition ([01bf29e](https://github.com/manifesto-ai/core/commit/01bf29e03c4b079838bacca35c9e948d4af06590))
* **sdk:** add dispatchAsync utility ([#238](https://github.com/manifesto-ai/core/issues/238)) ([e34fcfa](https://github.com/manifesto-ai/core/commit/e34fcfafd1109da6eeefab9ab167c54c9f54a689))
* **sdk:** propagate Snapshot&lt;T&gt; generics and typed event map ([#239](https://github.com/manifesto-ai/core/issues/239), [#246](https://github.com/manifesto-ai/core/issues/246)) ([8a5b40a](https://github.com/manifesto-ai/core/commit/8a5b40acb8f1cf44187a09a407dd30c988b4c46d))
* super hard cut world facade ([a5d33f9](https://github.com/manifesto-ai/core/commit/a5d33f98cfcfea914e445900fc2410766e0f1358))


### Bug Fixes

* normalize system slot names and support time.now in system lowering ([ace3788](https://github.com/manifesto-ai/core/commit/ace3788bbbacdd1c5937dcdbd9daca92014ae3af))
* normalize system slot names and support time.now in system lowering ([e5ec213](https://github.com/manifesto-ai/core/commit/e5ec21372db60d924750d06b73854f9ab62b4c71))
* preserve governed seal outcomes and execution keys ([dc40be6](https://github.com/manifesto-ai/core/commit/dc40be6ebd1a5ed2dfdd194693e3efd240f54019))
* relax action shape upper bound ([c7204ea](https://github.com/manifesto-ai/core/commit/c7204eaa4a65e37d72ac70472d0c7a43e264a890))
* **sdk,compiler:** expose MEL compile diagnostics with source locations ([#187](https://github.com/manifesto-ai/core/issues/187)) ([c4e08b5](https://github.com/manifesto-ai/core/commit/c4e08b56a63687dc4adc74c4adfa1e4d9da0156a))
* **sdk:** address PR review — exclude undefined from set(), enrich error() metadata ([705d9f8](https://github.com/manifesto-ai/core/commit/705d9f89790ddf5c7c9e0e7068140950e6ea0ecc))
* **sdk:** correct depth limit off-by-one and add usage pattern tests ([03389b6](https://github.com/manifesto-ai/core/commit/03389b6d0d8e6127b57ec3a053c4f31ded154660))
* **sdk:** exclude reserved snapshot roots from typed paths ([0a3c663](https://github.com/manifesto-ai/core/commit/0a3c6633cd799655401f1d665a3b3c55ac907db0))
* **sdk:** pin local vitest runtime dependencies ([44e3fa6](https://github.com/manifesto-ai/core/commit/44e3fa616190928a3af84a0d0d8b7784b066d94f))
* **sdk:** populate genesis snapshot from schema defaults ([#240](https://github.com/manifesto-ai/core/issues/240)) ([35f83f5](https://github.com/manifesto-ai/core/commit/35f83f50fcade1780d2250d930c9229a1eae7cd1))
* **sdk:** stabilize bootstrap bootstrap test imports ([7902afa](https://github.com/manifesto-ai/core/commit/7902afab68215a23ec7bfe56d618955d44b0d35a))
* **sdk:** stabilize bootstrap test import path for release CI ([a5c4509](https://github.com/manifesto-ai/core/commit/a5c4509d2c57833db584e9b43f8fc2e7effb3f69))
* **sdk:** stop DataPaths recursion into Record fields, exclude undefined from merge ([d6c1f42](https://github.com/manifesto-ai/core/commit/d6c1f428810cb83dbb1b92d6ea3971af4223ed20))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/compiler bumped to 3.0.0

## [3.1.2](https://github.com/manifesto-ai/core/compare/sdk-v3.1.1...sdk-v3.1.2) (2026-04-01)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/compiler bumped to 1.9.1

## [3.1.1](https://github.com/manifesto-ai/core/compare/sdk-v3.1.0...sdk-v3.1.1) (2026-04-01)


### Bug Fixes

* preserve governed seal outcomes and execution keys ([dc40be6](https://github.com/manifesto-ai/core/commit/dc40be6ebd1a5ed2dfdd194693e3efd240f54019))
* relax action shape upper bound ([c7204ea](https://github.com/manifesto-ai/core/commit/c7204eaa4a65e37d72ac70472d0c7a43e264a890))

## [3.1.0](https://github.com/manifesto-ai/core/compare/sdk-v3.0.0...sdk-v3.1.0) (2026-04-01)


### Features

* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))
* land core v4 cleanup and action availability queries ([#331](https://github.com/manifesto-ai/core/issues/331)) ([30ec2b4](https://github.com/manifesto-ai/core/commit/30ec2b481cebbf2a2640fe21fd7909d6b033a1b4))
* Phase2 R1 SDK-first transition (Track A) ([#159](https://github.com/manifesto-ai/core/issues/159)) ([57d7e66](https://github.com/manifesto-ai/core/commit/57d7e667fde2450c2a4608e5e0e5a76b0d0a3cee))
* **r2:** retire @manifesto-ai/app and lock no-app import guard ([1834515](https://github.com/manifesto-ai/core/commit/18345151bb0a9a29f4199fbc7d64ba291d40183e))
* **r2:** retire app package and enforce sdk-only guard ([53c9c3b](https://github.com/manifesto-ai/core/commit/53c9c3b9ef596341e3afc1295a9b7ecb3b26a92e))
* **sdk,docs,release:** execute phase2 r1 sdk-first transition ([01bf29e](https://github.com/manifesto-ai/core/commit/01bf29e03c4b079838bacca35c9e948d4af06590))
* **sdk:** add dispatchAsync utility ([#238](https://github.com/manifesto-ai/core/issues/238)) ([e34fcfa](https://github.com/manifesto-ai/core/commit/e34fcfafd1109da6eeefab9ab167c54c9f54a689))
* **sdk:** propagate Snapshot&lt;T&gt; generics and typed event map ([#239](https://github.com/manifesto-ai/core/issues/239), [#246](https://github.com/manifesto-ai/core/issues/246)) ([8a5b40a](https://github.com/manifesto-ai/core/commit/8a5b40acb8f1cf44187a09a407dd30c988b4c46d))
* super hard cut world facade ([a5d33f9](https://github.com/manifesto-ai/core/commit/a5d33f98cfcfea914e445900fc2410766e0f1358))


### Bug Fixes

* normalize system slot names and support time.now in system lowering ([ace3788](https://github.com/manifesto-ai/core/commit/ace3788bbbacdd1c5937dcdbd9daca92014ae3af))
* normalize system slot names and support time.now in system lowering ([e5ec213](https://github.com/manifesto-ai/core/commit/e5ec21372db60d924750d06b73854f9ab62b4c71))
* **sdk,compiler:** expose MEL compile diagnostics with source locations ([#187](https://github.com/manifesto-ai/core/issues/187)) ([c4e08b5](https://github.com/manifesto-ai/core/commit/c4e08b56a63687dc4adc74c4adfa1e4d9da0156a))
* **sdk:** address PR review — exclude undefined from set(), enrich error() metadata ([705d9f8](https://github.com/manifesto-ai/core/commit/705d9f89790ddf5c7c9e0e7068140950e6ea0ecc))
* **sdk:** correct depth limit off-by-one and add usage pattern tests ([03389b6](https://github.com/manifesto-ai/core/commit/03389b6d0d8e6127b57ec3a053c4f31ded154660))
* **sdk:** exclude reserved snapshot roots from typed paths ([0a3c663](https://github.com/manifesto-ai/core/commit/0a3c6633cd799655401f1d665a3b3c55ac907db0))
* **sdk:** pin local vitest runtime dependencies ([44e3fa6](https://github.com/manifesto-ai/core/commit/44e3fa616190928a3af84a0d0d8b7784b066d94f))
* **sdk:** populate genesis snapshot from schema defaults ([#240](https://github.com/manifesto-ai/core/issues/240)) ([35f83f5](https://github.com/manifesto-ai/core/commit/35f83f50fcade1780d2250d930c9229a1eae7cd1))
* **sdk:** stabilize bootstrap bootstrap test imports ([7902afa](https://github.com/manifesto-ai/core/commit/7902afab68215a23ec7bfe56d618955d44b0d35a))
* **sdk:** stabilize bootstrap test import path for release CI ([a5c4509](https://github.com/manifesto-ai/core/commit/a5c4509d2c57833db584e9b43f8fc2e7effb3f69))
* **sdk:** stop DataPaths recursion into Record fields, exclude undefined from merge ([d6c1f42](https://github.com/manifesto-ai/core/commit/d6c1f428810cb83dbb1b92d6ea3971af4223ed20))

## [2.3.0](https://github.com/manifesto-ai/core/compare/sdk-v2.2.0...sdk-v2.3.0) (2026-03-30)


### Features

* land core v4 cleanup and action availability queries ([#331](https://github.com/manifesto-ai/core/issues/331)) ([30ec2b4](https://github.com/manifesto-ai/core/commit/30ec2b481cebbf2a2640fe21fd7909d6b033a1b4))

## [2.2.0](https://github.com/manifesto-ai/core/compare/sdk-v2.1.0...sdk-v2.2.0) (2026-03-29)


### Features

* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))
* super hard cut world facade ([a5d33f9](https://github.com/manifesto-ai/core/commit/a5d33f98cfcfea914e445900fc2410766e0f1358))

## [2.1.0](https://github.com/manifesto-ai/core/compare/sdk-v2.0.0...sdk-v2.1.0) (2026-03-25)


### Features

* Phase2 R1 SDK-first transition (Track A) ([#159](https://github.com/manifesto-ai/core/issues/159)) ([57d7e66](https://github.com/manifesto-ai/core/commit/57d7e667fde2450c2a4608e5e0e5a76b0d0a3cee))
* **r2:** retire @manifesto-ai/app and lock no-app import guard ([1834515](https://github.com/manifesto-ai/core/commit/18345151bb0a9a29f4199fbc7d64ba291d40183e))
* **r2:** retire app package and enforce sdk-only guard ([53c9c3b](https://github.com/manifesto-ai/core/commit/53c9c3b9ef596341e3afc1295a9b7ecb3b26a92e))
* **sdk,docs,release:** execute phase2 r1 sdk-first transition ([01bf29e](https://github.com/manifesto-ai/core/commit/01bf29e03c4b079838bacca35c9e948d4af06590))
* **sdk:** add dispatchAsync utility ([#238](https://github.com/manifesto-ai/core/issues/238)) ([e34fcfa](https://github.com/manifesto-ai/core/commit/e34fcfafd1109da6eeefab9ab167c54c9f54a689))
* **sdk:** propagate Snapshot&lt;T&gt; generics and typed event map ([#239](https://github.com/manifesto-ai/core/issues/239), [#246](https://github.com/manifesto-ai/core/issues/246)) ([8a5b40a](https://github.com/manifesto-ai/core/commit/8a5b40acb8f1cf44187a09a407dd30c988b4c46d))


### Bug Fixes

* normalize system slot names and support time.now in system lowering ([ace3788](https://github.com/manifesto-ai/core/commit/ace3788bbbacdd1c5937dcdbd9daca92014ae3af))
* normalize system slot names and support time.now in system lowering ([e5ec213](https://github.com/manifesto-ai/core/commit/e5ec21372db60d924750d06b73854f9ab62b4c71))
* **sdk,compiler:** expose MEL compile diagnostics with source locations ([#187](https://github.com/manifesto-ai/core/issues/187)) ([c4e08b5](https://github.com/manifesto-ai/core/commit/c4e08b56a63687dc4adc74c4adfa1e4d9da0156a))
* **sdk:** address PR review — exclude undefined from set(), enrich error() metadata ([705d9f8](https://github.com/manifesto-ai/core/commit/705d9f89790ddf5c7c9e0e7068140950e6ea0ecc))
* **sdk:** correct depth limit off-by-one and add usage pattern tests ([03389b6](https://github.com/manifesto-ai/core/commit/03389b6d0d8e6127b57ec3a053c4f31ded154660))
* **sdk:** exclude reserved snapshot roots from typed paths ([0a3c663](https://github.com/manifesto-ai/core/commit/0a3c6633cd799655401f1d665a3b3c55ac907db0))
* **sdk:** pin local vitest runtime dependencies ([44e3fa6](https://github.com/manifesto-ai/core/commit/44e3fa616190928a3af84a0d0d8b7784b066d94f))
* **sdk:** populate genesis snapshot from schema defaults ([#240](https://github.com/manifesto-ai/core/issues/240)) ([35f83f5](https://github.com/manifesto-ai/core/commit/35f83f50fcade1780d2250d930c9229a1eae7cd1))
* **sdk:** stabilize bootstrap bootstrap test imports ([7902afa](https://github.com/manifesto-ai/core/commit/7902afab68215a23ec7bfe56d618955d44b0d35a))
* **sdk:** stabilize bootstrap test import path for release CI ([a5c4509](https://github.com/manifesto-ai/core/commit/a5c4509d2c57833db584e9b43f8fc2e7effb3f69))
* **sdk:** stop DataPaths recursion into Record fields, exclude undefined from merge ([d6c1f42](https://github.com/manifesto-ai/core/commit/d6c1f428810cb83dbb1b92d6ea3971af4223ed20))

## [2.1.0](https://github.com/manifesto-ai/core/compare/sdk-v2.0.0...sdk-v2.1.0) (2026-03-25)


### Features

* Phase2 R1 SDK-first transition (Track A) ([#159](https://github.com/manifesto-ai/core/issues/159)) ([57d7e66](https://github.com/manifesto-ai/core/commit/57d7e667fde2450c2a4608e5e0e5a76b0d0a3cee))
* **r2:** retire @manifesto-ai/app and lock no-app import guard ([1834515](https://github.com/manifesto-ai/core/commit/18345151bb0a9a29f4199fbc7d64ba291d40183e))
* **r2:** retire app package and enforce sdk-only guard ([53c9c3b](https://github.com/manifesto-ai/core/commit/53c9c3b9ef596341e3afc1295a9b7ecb3b26a92e))
* **sdk,docs,release:** execute phase2 r1 sdk-first transition ([01bf29e](https://github.com/manifesto-ai/core/commit/01bf29e03c4b079838bacca35c9e948d4af06590))
* **sdk:** add dispatchAsync utility ([#238](https://github.com/manifesto-ai/core/issues/238)) ([e34fcfa](https://github.com/manifesto-ai/core/commit/e34fcfafd1109da6eeefab9ab167c54c9f54a689))
* **sdk:** propagate Snapshot&lt;T&gt; generics and typed event map ([#239](https://github.com/manifesto-ai/core/issues/239), [#246](https://github.com/manifesto-ai/core/issues/246)) ([8a5b40a](https://github.com/manifesto-ai/core/commit/8a5b40acb8f1cf44187a09a407dd30c988b4c46d))


### Bug Fixes

* normalize system slot names and support time.now in system lowering ([ace3788](https://github.com/manifesto-ai/core/commit/ace3788bbbacdd1c5937dcdbd9daca92014ae3af))
* normalize system slot names and support time.now in system lowering ([e5ec213](https://github.com/manifesto-ai/core/commit/e5ec21372db60d924750d06b73854f9ab62b4c71))
* **sdk,compiler:** expose MEL compile diagnostics with source locations ([#187](https://github.com/manifesto-ai/core/issues/187)) ([c4e08b5](https://github.com/manifesto-ai/core/commit/c4e08b56a63687dc4adc74c4adfa1e4d9da0156a))
* **sdk:** address PR review — exclude undefined from set(), enrich error() metadata ([705d9f8](https://github.com/manifesto-ai/core/commit/705d9f89790ddf5c7c9e0e7068140950e6ea0ecc))
* **sdk:** correct depth limit off-by-one and add usage pattern tests ([03389b6](https://github.com/manifesto-ai/core/commit/03389b6d0d8e6127b57ec3a053c4f31ded154660))
* **sdk:** exclude reserved snapshot roots from typed paths ([0a3c663](https://github.com/manifesto-ai/core/commit/0a3c6633cd799655401f1d665a3b3c55ac907db0))
* **sdk:** pin local vitest runtime dependencies ([44e3fa6](https://github.com/manifesto-ai/core/commit/44e3fa616190928a3af84a0d0d8b7784b066d94f))
* **sdk:** populate genesis snapshot from schema defaults ([#240](https://github.com/manifesto-ai/core/issues/240)) ([35f83f5](https://github.com/manifesto-ai/core/commit/35f83f50fcade1780d2250d930c9229a1eae7cd1))
* **sdk:** stabilize bootstrap bootstrap test imports ([7902afa](https://github.com/manifesto-ai/core/commit/7902afab68215a23ec7bfe56d618955d44b0d35a))
* **sdk:** stabilize bootstrap test import path for release CI ([a5c4509](https://github.com/manifesto-ai/core/commit/a5c4509d2c57833db584e9b43f8fc2e7effb3f69))
* **sdk:** stop DataPaths recursion into Record fields, exclude undefined from merge ([d6c1f42](https://github.com/manifesto-ai/core/commit/d6c1f428810cb83dbb1b92d6ea3971af4223ed20))

## [1.2.2](https://github.com/manifesto-ai/core/compare/sdk-v1.2.1...sdk-v1.2.2) (2026-02-25)


### Bug Fixes

* normalize system slot names and support time.now in system lowering ([ace3788](https://github.com/manifesto-ai/core/commit/ace3788bbbacdd1c5937dcdbd9daca92014ae3af))
* normalize system slot names and support time.now in system lowering ([e5ec213](https://github.com/manifesto-ai/core/commit/e5ec21372db60d924750d06b73854f9ab62b4c71))

## [1.2.1](https://github.com/manifesto-ai/core/compare/sdk-v1.2.0...sdk-v1.2.1) (2026-02-20)


### Bug Fixes

* **sdk:** address PR review — exclude undefined from set(), enrich error() metadata ([705d9f8](https://github.com/manifesto-ai/core/commit/705d9f89790ddf5c7c9e0e7068140950e6ea0ecc))
* **sdk:** correct depth limit off-by-one and add usage pattern tests ([03389b6](https://github.com/manifesto-ai/core/commit/03389b6d0d8e6127b57ec3a053c4f31ded154660))
* **sdk:** exclude reserved snapshot roots from typed paths ([0a3c663](https://github.com/manifesto-ai/core/commit/0a3c6633cd799655401f1d665a3b3c55ac907db0))
* **sdk:** stop DataPaths recursion into Record fields, exclude undefined from merge ([d6c1f42](https://github.com/manifesto-ai/core/commit/d6c1f428810cb83dbb1b92d6ea3971af4223ed20))

## [1.2.0](https://github.com/manifesto-ai/core/compare/sdk-v1.1.0...sdk-v1.2.0) (2026-02-17)


### Features

* **r2:** retire @manifesto-ai/app and lock no-app import guard ([1834515](https://github.com/manifesto-ai/core/commit/18345151bb0a9a29f4199fbc7d64ba291d40183e))
* **r2:** retire app package and enforce sdk-only guard ([53c9c3b](https://github.com/manifesto-ai/core/commit/53c9c3b9ef596341e3afc1295a9b7ecb3b26a92e))

## [1.1.0](https://github.com/manifesto-ai/core/compare/sdk-v1.0.0...sdk-v1.1.0) (2026-02-17)


### Features

* Phase2 R1 SDK-first transition (Track A) ([#159](https://github.com/manifesto-ai/core/issues/159)) ([57d7e66](https://github.com/manifesto-ai/core/commit/57d7e667fde2450c2a4608e5e0e5a76b0d0a3cee))
* **sdk,docs,release:** execute phase2 r1 sdk-first transition ([01bf29e](https://github.com/manifesto-ai/core/commit/01bf29e03c4b079838bacca35c9e948d4af06590))


### Bug Fixes

* **sdk:** stabilize bootstrap bootstrap test imports ([7902afa](https://github.com/manifesto-ai/core/commit/7902afab68215a23ec7bfe56d618955d44b0d35a))
* **sdk:** stabilize bootstrap test import path for release CI ([a5c4509](https://github.com/manifesto-ai/core/commit/a5c4509d2c57833db584e9b43f8fc2e7effb3f69))
