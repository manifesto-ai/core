# Changelog

## [3.6.0](https://github.com/manifesto-ai/core/compare/compiler-v3.5.0...compiler-v3.6.0) (2026-04-15)


### Features

* **compiler:** add [@meta](https://github.com/meta) structural annotation support ([#430](https://github.com/manifesto-ai/core/issues/430)) ([41b6ac3](https://github.com/manifesto-ai/core/commit/41b6ac3cc049687a12898b299021a7cba56913b3))

## [3.5.0](https://github.com/manifesto-ai/core/compare/compiler-v3.4.0...compiler-v3.5.0) (2026-04-14)


### Features

* **compiler:** add bounded MEL sugar contract ([f3e0cb4](https://github.com/manifesto-ai/core/commit/f3e0cb49ddae44d65a9478c8640c1cc9d2c96483))
* **compiler:** add bounded MEL sugar contract ([bb59b40](https://github.com/manifesto-ai/core/commit/bb59b409c57230a9f37691dd36b242ac49e21572))


### Bug Fixes

* **compiler:** accept unary numeric match keys ([d3183c8](https://github.com/manifesto-ai/core/commit/d3183c812e3370cc204fb86d2c4f17ee25cb1081))
* **compiler:** harden bounded sugar lowering ([4f7bf65](https://github.com/manifesto-ai/core/commit/4f7bf653be5f84225306e242a76f45a88f1bf5db))
* **compiler:** infer nullable idiv results ([f06a445](https://github.com/manifesto-ai/core/commit/f06a445eb342f1023637201e1cb99ce8438b83c2))
* **compiler:** remove broken numeric literal guard ([05d4f46](https://github.com/manifesto-ai/core/commit/05d4f465e1cdc73ab40cd70f568bd4609a8561a0))
* **compiler:** resolve clamp literal narrowing ([e7b9589](https://github.com/manifesto-ai/core/commit/e7b95893f01728c9fa39b36c57e946da6db2415b))
* **compiler:** tighten sugar validation contracts ([1bf1c4e](https://github.com/manifesto-ai/core/commit/1bf1c4eabfa14153b57c7fb374483c575c28faa4))

## [3.4.0](https://github.com/manifesto-ai/core/compare/compiler-v3.3.1...compiler-v3.4.0) (2026-04-13)


### Features

* **runtime:** add family reports and narrow provider seams ([693d669](https://github.com/manifesto-ai/core/commit/693d66946530f7986631d9665c703b1b61418f96))
* **runtime:** add family reports and narrow provider seams ([27277ec](https://github.com/manifesto-ai/core/commit/27277ec190b365abd8248b7e74b84f7995618db4))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @manifesto-ai/core bumped to 2.12.0
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.11.1 to ^2.12.0

## [3.3.1](https://github.com/manifesto-ai/core/compare/compiler-v3.3.0...compiler-v3.3.1) (2026-04-12)


### Bug Fixes

* **docs:** align clean urls and favicon links ([0db1df5](https://github.com/manifesto-ai/core/commit/0db1df54599619026f41bb14317a27ca21498644))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @manifesto-ai/core bumped to 2.11.1
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.11.0 to ^2.11.1

## [3.3.0](https://github.com/manifesto-ai/core/compare/compiler-v3.2.0...compiler-v3.3.0) (2026-04-08)


### Features

* implement ADR-020 dispatchability ([606fe7b](https://github.com/manifesto-ai/core/commit/606fe7b3b5e1679e918f5b24fb1e0233f8c24660))
* roll up ADR-020 dispatchability and schema typing ([e85ec08](https://github.com/manifesto-ai/core/commit/e85ec082f61c117ee1b22707739f7528979b15fd))
* **schema:** support record and nullable schema positions ([59a0cfa](https://github.com/manifesto-ai/core/commit/59a0cfaf5b0117e6a7f143ce90e67964f8d37618))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @manifesto-ai/core bumped to 2.11.0
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.10.0 to ^2.11.0

## [3.2.0](https://github.com/manifesto-ai/core/compare/compiler-v3.1.1...compiler-v3.2.0) (2026-04-06)


### Features

* **runtime:** add schema graph introspection and align docs ([79fce9c](https://github.com/manifesto-ai/core/commit/79fce9ceec6885a1925e6017f1e3b97e8a9208f1))
* **runtime:** add schema graph introspection and sync docs ([b00c053](https://github.com/manifesto-ai/core/commit/b00c05337f929785763479fd0b3161309849a326))


### Bug Fixes

* **compiler:** traverse call flows in schema graph ([4f2a5f4](https://github.com/manifesto-ai/core/commit/4f2a5f4006641e75e7b6c71e46f45cd087044d36))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @manifesto-ai/core bumped to 2.10.0
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.9.0 to ^2.10.0

## [3.1.1](https://github.com/manifesto-ai/core/compare/compiler-v3.1.0...compiler-v3.1.1) (2026-04-03)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @manifesto-ai/core bumped to 2.9.0
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.0.0 to ^2.9.0

## [3.1.0](https://github.com/manifesto-ai/core/compare/compiler-v3.0.0...compiler-v3.1.0) (2026-04-02)


### Features

* **compiler:** emit codegen during dev and rename domain output ([fee61e3](https://github.com/manifesto-ai/core/commit/fee61e35681268e941914f6be2c0374ec98c63c4))
* **compiler:** emit codegen during dev and rename domain output ([a67b3c0](https://github.com/manifesto-ai/core/commit/a67b3c082923191d3e46c7bbaab7bd117d318c5f))


### Bug Fixes

* **compiler:** validate codegen timing values ([5b9ead1](https://github.com/manifesto-ai/core/commit/5b9ead178abe5ea2dab03aa6526bef6534e8183a))

## [3.0.0](https://github.com/manifesto-ai/core/compare/compiler-v2.0.0...compiler-v3.0.0) (2026-04-02)


### ⚠ BREAKING CHANGES

* **compiler,monorepo:** @manifesto-ai/intent-ir and @manifesto-ai/translator are removed from the monorepo. The compiler's Webpack loader export path `@manifesto-ai/compiler/loader` now points to Node ESM loader hooks only; Webpack users should migrate to `@manifesto-ai/compiler/webpack`.

### Features

* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))
* **compiler,monorepo:** remove intent-ir/translator packages and migrate to unplugin ([76eadac](https://github.com/manifesto-ai/core/commit/76eadac9047308563793cf2a2d1299b1830f7f22))
* **compiler:** add MEL vite and loader subpath integrations ([211755e](https://github.com/manifesto-ai/core/commit/211755e59b0cdccad92da823dc0e95ef335974c7))
* **compiler:** add MEL vite and loader subpath integrations ([#96](https://github.com/manifesto-ai/core/issues/96)) ([57b1684](https://github.com/manifesto-ai/core/commit/57b16841f890c56c27d1c883d48ae6ccdee4f23b))
* **compiler:** add onceIntent contextual keyword ([018fddf](https://github.com/manifesto-ai/core/commit/018fddfd30a9a888ce75b01ae9e8976788fc8c71))
* **compiler:** implement SPEC v0.7.0 compiler baseline ([#289](https://github.com/manifesto-ai/core/issues/289)) ([35f1f00](https://github.com/manifesto-ai/core/commit/35f1f00550af700dfafe0283d777f71f68aa0dc5))
* **platform:** add  namespace and semantic schema hashing ([b7038a5](https://github.com/manifesto-ai/core/commit/b7038a57c4f4989ebda80589af57f08ec50c7fc7))
* super hard cut world facade ([a5d33f9](https://github.com/manifesto-ai/core/commit/a5d33f98cfcfea914e445900fc2410766e0f1358))


### Bug Fixes

* add field IR kind for static property access and fix at() record lookup ([#135](https://github.com/manifesto-ai/core/issues/135)) ([#140](https://github.com/manifesto-ai/core/issues/140)) ([2f88a17](https://github.com/manifesto-ai/core/commit/2f88a17ed6d2541ab00102d134bb77324b51b023))
* align vitest coverage with vite peer ([#299](https://github.com/manifesto-ai/core/issues/299)) ([57fd2e4](https://github.com/manifesto-ai/core/commit/57fd2e41d04aa1ff099ceca1a129a471285ec624))
* clamp synthetic parse diagnostics into patch text range ([44397fb](https://github.com/manifesto-ai/core/commit/44397fb06023189a7810faf89fb407d1c4d72071))
* **compiler,core:** add literal type validation for MEL state initializers and patches ([#282](https://github.com/manifesto-ai/core/issues/282)) ([fc4d2da](https://github.com/manifesto-ai/core/commit/fc4d2dad734bd02d5388b95cd0de1755bd992478))
* **compiler:** allow merge() as expression in patch value context ([#253](https://github.com/manifesto-ai/core/issues/253)) ([d71cbe5](https://github.com/manifesto-ai/core/commit/d71cbe505c4be5e03119a2827b30f946c3bee174))
* **compiler:** fix compileMelPatch remap function name and patch location scoping ([cca7db6](https://github.com/manifesto-ai/core/commit/cca7db6d1297d71576d3ba20eca5d16ea36a43f2))
* **compiler:** implement compileMelPatch and add regression tests ([bf2bba7](https://github.com/manifesto-ai/core/commit/bf2bba73cb035061ce645b14da983148d48c698c))
* **compiler:** restore declaration build for canonical ir ([01254b1](https://github.com/manifesto-ai/core/commit/01254b10e069c30f03d27339f29831a7ac592ad5))
* **compiler:** support dynamic patch property access and remap parse diagnostics ([91a75ae](https://github.com/manifesto-ai/core/commit/91a75ae82a7ff7e218b1f6b901635a0736c3007c))
* **compiler:** validate unknown functions and duplicate state fields ([#251](https://github.com/manifesto-ai/core/issues/251), [#252](https://github.com/manifesto-ai/core/issues/252)) ([f2e6539](https://github.com/manifesto-ai/core/commit/f2e65395fd37dd979f32e7cacae21a4995258b78))
* normalize system slot names and support time.now in system lowering ([ace3788](https://github.com/manifesto-ai/core/commit/ace3788bbbacdd1c5937dcdbd9daca92014ae3af))
* normalize system slot names and support time.now in system lowering ([e5ec213](https://github.com/manifesto-ai/core/commit/e5ec21372db60d924750d06b73854f9ab62b4c71))
* preserve empty path segments in compiler path generation ([1c8ed0e](https://github.com/manifesto-ai/core/commit/1c8ed0e9c28829d5fb364487350273f3a1d1a671))
* reject escaped synthetic wrapper escape hatch statements ([9edde7b](https://github.com/manifesto-ai/core/commit/9edde7b47125f3119e4c0d45ac292d5c1fdd00bb))
* remove unused compiler host peer ([#303](https://github.com/manifesto-ai/core/issues/303)) ([567471b](https://github.com/manifesto-ai/core/commit/567471b1323dd2a9f7ae8caa06b431f7af5f5df5))
* **review:** restore missing type re-exports and guard abort during lock queue ([ec7e7a0](https://github.com/manifesto-ai/core/commit/ec7e7a076e58e096c5b706adcccebb139b955955))
* **sdk,compiler:** expose MEL compile diagnostics with source locations ([#187](https://github.com/manifesto-ai/core/issues/187)) ([c4e08b5](https://github.com/manifesto-ai/core/commit/c4e08b56a63687dc4adc74c4adfa1e4d9da0156a))
* tighten MEL expression type checking ([#292](https://github.com/manifesto-ai/core/issues/292)) ([e02602a](https://github.com/manifesto-ai/core/commit/e02602a7c21e912c2d8f1ff07e8da62d3c09c831))
* update docs to use SDK dispatchAsync, unblock typeof, deduplicate E001 ([c492ef4](https://github.com/manifesto-ai/core/commit/c492ef4c9d65434b38584e91dfd653a552586a74))
* validate patch wrapper integrity and reject dynamic patch-path indexes ([f674ee6](https://github.com/manifesto-ai/core/commit/f674ee658e6fb53cb818c31c8a6fccd7f9163cb1))

## [1.9.1](https://github.com/manifesto-ai/core/compare/compiler-v1.9.0...compiler-v1.9.1) (2026-04-01)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @manifesto-ai/codegen bumped to 0.1.5
  * peerDependencies
    * @manifesto-ai/codegen bumped from ^0.1.0 to ^0.1.5

## [1.9.0](https://github.com/manifesto-ai/core/compare/compiler-v1.8.3...compiler-v1.9.0) (2026-03-29)


### Features

* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))
* super hard cut world facade ([a5d33f9](https://github.com/manifesto-ai/core/commit/a5d33f98cfcfea914e445900fc2410766e0f1358))

## [1.8.3](https://github.com/manifesto-ai/core/compare/compiler-v1.8.2...compiler-v1.8.3) (2026-03-25)


### Bug Fixes

* remove unused compiler host peer ([#303](https://github.com/manifesto-ai/core/issues/303)) ([567471b](https://github.com/manifesto-ai/core/commit/567471b1323dd2a9f7ae8caa06b431f7af5f5df5))

## [1.8.2](https://github.com/manifesto-ai/core/compare/compiler-v1.8.1...compiler-v1.8.2) (2026-03-25)


### Bug Fixes

* align vitest coverage with vite peer ([#299](https://github.com/manifesto-ai/core/issues/299)) ([57fd2e4](https://github.com/manifesto-ai/core/commit/57fd2e41d04aa1ff099ceca1a129a471285ec624))

## [1.8.1](https://github.com/manifesto-ai/core/compare/compiler-v1.8.0...compiler-v1.8.1) (2026-03-25)


### Bug Fixes

* tighten MEL expression type checking ([#292](https://github.com/manifesto-ai/core/issues/292)) ([e02602a](https://github.com/manifesto-ai/core/commit/e02602a7c21e912c2d8f1ff07e8da62d3c09c831))

## [1.8.0](https://github.com/manifesto-ai/core/compare/compiler-v1.7.0...compiler-v1.8.0) (2026-03-25)

### Features

* **compiler:** implement SPEC v0.7.0 compiler baseline ([#289](https://github.com/manifesto-ai/core/issues/289)) ([35f1f00](https://github.com/manifesto-ai/core/commit/35f1f00550af700dfafe0283d777f71f68aa0dc5))


### Bug Fixes

* add field IR kind for static property access and fix at() record lookup ([#135](https://github.com/manifesto-ai/core/issues/135)) ([#140](https://github.com/manifesto-ai/core/issues/140)) ([2f88a17](https://github.com/manifesto-ai/core/commit/2f88a17ed6d2541ab00102d134bb77324b51b023))
* clamp synthetic parse diagnostics into patch text range ([44397fb](https://github.com/manifesto-ai/core/commit/44397fb06023189a7810faf89fb407d1c4d72071))
* **compiler,core:** add literal type validation for MEL state initializers and patches ([#282](https://github.com/manifesto-ai/core/issues/282)) ([fc4d2da](https://github.com/manifesto-ai/core/commit/fc4d2dad734bd02d5388b95cd0de1755bd992478))
* **compiler:** allow merge() as expression in patch value context ([#253](https://github.com/manifesto-ai/core/issues/253)) ([d71cbe5](https://github.com/manifesto-ai/core/commit/d71cbe505c4be5e03119a2827b30f946c3bee174))
* **compiler:** fix compileMelPatch remap function name and patch location scoping ([cca7db6](https://github.com/manifesto-ai/core/commit/cca7db6d1297d71576d3ba20eca5d16ea36a43f2))
* **compiler:** implement compileMelPatch and add regression tests ([bf2bba7](https://github.com/manifesto-ai/core/commit/bf2bba73cb035061ce645b14da983148d48c698c))
* **compiler:** restore declaration build for canonical ir ([01254b1](https://github.com/manifesto-ai/core/commit/01254b10e069c30f03d27339f29831a7ac592ad5))
* **compiler:** support dynamic patch property access and remap parse diagnostics ([91a75ae](https://github.com/manifesto-ai/core/commit/91a75ae82a7ff7e218b1f6b901635a0736c3007c))
* **compiler:** validate unknown functions and duplicate state fields ([#251](https://github.com/manifesto-ai/core/issues/251), [#252](https://github.com/manifesto-ai/core/issues/252)) ([f2e6539](https://github.com/manifesto-ai/core/commit/f2e65395fd37dd979f32e7cacae21a4995258b78))
* normalize system slot names and support time.now in system lowering ([ace3788](https://github.com/manifesto-ai/core/commit/ace3788bbbacdd1c5937dcdbd9daca92014ae3af))
* normalize system slot names and support time.now in system lowering ([e5ec213](https://github.com/manifesto-ai/core/commit/e5ec21372db60d924750d06b73854f9ab62b4c71))
* preserve empty path segments in compiler path generation ([1c8ed0e](https://github.com/manifesto-ai/core/commit/1c8ed0e9c28829d5fb364487350273f3a1d1a671))
* reject escaped synthetic wrapper escape hatch statements ([9edde7b](https://github.com/manifesto-ai/core/commit/9edde7b47125f3119e4c0d45ac292d5c1fdd00bb))
* **review:** restore missing type re-exports and guard abort during lock queue ([ec7e7a0](https://github.com/manifesto-ai/core/commit/ec7e7a076e58e096c5b706adcccebb139b955955))
* **sdk,compiler:** expose MEL compile diagnostics with source locations ([#187](https://github.com/manifesto-ai/core/issues/187)) ([c4e08b5](https://github.com/manifesto-ai/core/commit/c4e08b56a63687dc4adc74c4adfa1e4d9da0156a))
* update docs to use SDK dispatchAsync, unblock typeof, deduplicate E001 ([c492ef4](https://github.com/manifesto-ai/core/commit/c492ef4c9d65434b38584e91dfd653a552586a74))
* validate patch wrapper integrity and reject dynamic patch-path indexes ([f674ee6](https://github.com/manifesto-ai/core/commit/f674ee658e6fb53cb818c31c8a6fccd7f9163cb1))

## [1.6.3](https://github.com/manifesto-ai/core/compare/compiler-v1.6.2...compiler-v1.6.3) (2026-02-25)


### Bug Fixes

* normalize system slot names and support time.now in system lowering ([ace3788](https://github.com/manifesto-ai/core/commit/ace3788bbbacdd1c5937dcdbd9daca92014ae3af))
* normalize system slot names and support time.now in system lowering ([e5ec213](https://github.com/manifesto-ai/core/commit/e5ec21372db60d924750d06b73854f9ab62b4c71))
* **review:** restore missing type re-exports and guard abort during lock queue ([ec7e7a0](https://github.com/manifesto-ai/core/commit/ec7e7a076e58e096c5b706adcccebb139b955955))

## [1.6.2](https://github.com/manifesto-ai/core/compare/compiler-v1.6.1...compiler-v1.6.2) (2026-02-24)


### Bug Fixes

* clamp synthetic parse diagnostics into patch text range ([44397fb](https://github.com/manifesto-ai/core/commit/44397fb06023189a7810faf89fb407d1c4d72071))
* **compiler:** fix compileMelPatch remap function name and patch location scoping ([cca7db6](https://github.com/manifesto-ai/core/commit/cca7db6d1297d71576d3ba20eca5d16ea36a43f2))
* **compiler:** implement compileMelPatch and add regression tests ([bf2bba7](https://github.com/manifesto-ai/core/commit/bf2bba73cb035061ce645b14da983148d48c698c))
* **compiler:** support dynamic patch property access and remap parse diagnostics ([91a75ae](https://github.com/manifesto-ai/core/commit/91a75ae82a7ff7e218b1f6b901635a0736c3007c))
* preserve empty path segments in compiler path generation ([1c8ed0e](https://github.com/manifesto-ai/core/commit/1c8ed0e9c28829d5fb364487350273f3a1d1a671))
* reject escaped synthetic wrapper escape hatch statements ([9edde7b](https://github.com/manifesto-ai/core/commit/9edde7b47125f3119e4c0d45ac292d5c1fdd00bb))
* validate patch wrapper integrity and reject dynamic patch-path indexes ([f674ee6](https://github.com/manifesto-ai/core/commit/f674ee658e6fb53cb818c31c8a6fccd7f9163cb1))

## [1.6.1](https://github.com/manifesto-ai/core/compare/compiler-v1.6.0...compiler-v1.6.1) (2026-02-11)


### Bug Fixes

* add field IR kind for static property access and fix at() record lookup ([#135](https://github.com/manifesto-ai/core/issues/135)) ([#140](https://github.com/manifesto-ai/core/issues/140)) ([2f88a17](https://github.com/manifesto-ai/core/commit/2f88a17ed6d2541ab00102d134bb77324b51b023))

## [1.6.0](https://github.com/manifesto-ai/core/compare/compiler-v1.5.0...compiler-v1.6.0) (2026-02-09)


### Features

* add action catalog, renderer, and new packages ([c11a00d](https://github.com/manifesto-ai/core/commit/c11a00de30fad91833f2295d5faec51d25a80641))
* **compiler:** add lowering and evaluation modules ([1f6a177](https://github.com/manifesto-ai/core/commit/1f6a1773337dee6bc0a549e3411009cd6dcc6a43))
* **compiler:** add MEL vite and loader subpath integrations ([211755e](https://github.com/manifesto-ai/core/commit/211755e59b0cdccad92da823dc0e95ef335974c7))
* **compiler:** add MEL vite and loader subpath integrations ([#96](https://github.com/manifesto-ai/core/issues/96)) ([57b1684](https://github.com/manifesto-ai/core/commit/57b16841f890c56c27d1c883d48ae6ccdee4f23b))
* **compiler:** add onceIntent contextual keyword ([018fddf](https://github.com/manifesto-ai/core/commit/018fddfd30a9a888ce75b01ae9e8976788fc8c71))
* **compiler:** enhance IR generation and core integration ([65a2989](https://github.com/manifesto-ai/core/commit/65a29890ab2ba93e0723b0eb8e6e859617b95c74))
* **compiler:** implement MEL SPEC v0.3.3 with named types and validation ([1121236](https://github.com/manifesto-ai/core/commit/11212369725ebdc30646b130725d1d2f8b8e1c0b))
* **host:** add v1.1 Compiler integration for Translator support ([2327bf0](https://github.com/manifesto-ai/core/commit/2327bf08bf138781806fd29a6920d9f4f4c12aa6))
* **integration-tests:** add full-stack integration test suite (L1-L6) ([66a704b](https://github.com/manifesto-ai/core/commit/66a704b93756d19e01a1d453d0ba1c17c5a7494c))
* **intent-ir:** implement Chomskyan LF-based Intent IR package (v0.1.0) ([000f1ba](https://github.com/manifesto-ai/core/commit/000f1ba64a09817e43ec746aeef030763dd734d9))
* **platform:** add  namespace and semantic schema hashing ([b7038a5](https://github.com/manifesto-ai/core/commit/b7038a57c4f4989ebda80589af57f08ec50c7fc7))
* sync updates from mind-protocol experimental branch ([85bf298](https://github.com/manifesto-ai/core/commit/85bf29860d5c35d5b7df442d75709fe09b544080))


### Bug Fixes

* **compiler:** generate fields for object types in state schema ([f129c6d](https://github.com/manifesto-ai/core/commit/f129c6da2bd2e61dd4826dd4baecf538124901ef))

## [1.2.0](https://github.com/manifesto-ai/core/compare/compiler-v1.1.0...compiler-v1.2.0) (2026-01-03)


### Features

* **compiler:** enhance IR generation and core integration ([65a2989](https://github.com/manifesto-ai/core/commit/65a29890ab2ba93e0723b0eb8e6e859617b95c74))
* **compiler:** implement MEL SPEC v0.3.3 with named types and validation ([1121236](https://github.com/manifesto-ai/core/commit/11212369725ebdc30646b130725d1d2f8b8e1c0b))


### Bug Fixes

* **compiler:** generate fields for object types in state schema ([f129c6d](https://github.com/manifesto-ai/core/commit/f129c6da2bd2e61dd4826dd4baecf538124901ef))
