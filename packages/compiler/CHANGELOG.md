# Changelog

## [1.6.2](https://github.com/manifesto-ai/core/compare/compiler-v1.6.1...compiler-v1.6.2) (2026-02-22)


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
