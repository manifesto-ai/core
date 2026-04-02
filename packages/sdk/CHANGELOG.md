# Changelog

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
