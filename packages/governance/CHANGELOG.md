# Changelog

## [3.13.1](https://github.com/manifesto-ai/core/compare/governance-v3.13.0...governance-v3.13.1) (2026-04-25)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.12.1
    * @manifesto-ai/sdk bumped to 3.18.1

## [3.13.0](https://github.com/manifesto-ai/core/compare/governance-v3.12.3...governance-v3.13.0) (2026-04-24)


### Features

* **sdk:** add bound intent dry-run surface ([#455](https://github.com/manifesto-ai/core/issues/455)) ([4851c0d](https://github.com/manifesto-ai/core/commit/4851c0d83729db6df94d02364cd65c5aa7fc8e0b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.12.0
    * @manifesto-ai/sdk bumped to 3.18.0

## [3.12.3](https://github.com/manifesto-ai/core/compare/governance-v3.12.2...governance-v3.12.3) (2026-04-23)


### Bug Fixes

* **sdk:** codify helper-safe runtime boundaries ([#451](https://github.com/manifesto-ai/core/issues/451)) ([12bed45](https://github.com/manifesto-ai/core/commit/12bed45c29d47945b87e0f16b0184b51448b529d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.11.3
    * @manifesto-ai/sdk bumped to 3.17.3

## [3.12.2](https://github.com/manifesto-ai/core/compare/governance-v3.12.1...governance-v3.12.2) (2026-04-23)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.11.2
    * @manifesto-ai/sdk bumped to 3.17.2
  * devDependencies
    * @manifesto-ai/core bumped to 2.13.0
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.12.0 to ^2.13.0

## [3.12.1](https://github.com/manifesto-ai/core/compare/governance-v3.12.0...governance-v3.12.1) (2026-04-23)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.11.1
    * @manifesto-ai/sdk bumped to 3.17.1

## [3.12.0](https://github.com/manifesto-ai/core/compare/governance-v3.11.5...governance-v3.12.0) (2026-04-18)


### Features

* add sdk intent explanation reads and hard-cut docs flow ([6a0b528](https://github.com/manifesto-ai/core/commit/6a0b5280081b7bfc0af5be2720468663a0944fa0))
* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))
* **decorators:** inherit legality query surface ([5ddc9e2](https://github.com/manifesto-ai/core/commit/5ddc9e25178b504f2cec131b20c7fdbd10ec31ed))
* **governance:** add waitForProposal observer ([94be2f1](https://github.com/manifesto-ai/core/commit/94be2f1e24c8228b4542393048090cd7dbd15929))
* **governance:** add waitForProposal observer ([26ccdf8](https://github.com/manifesto-ai/core/commit/26ccdf8842679f059b083584a7635edc14011d00))
* implement governance phase 3 split ([ba625b9](https://github.com/manifesto-ai/core/commit/ba625b982bf959d2d15de9762899e4f40cf4724b))
* implement world facade phase 4 split ([b988dd7](https://github.com/manifesto-ai/core/commit/b988dd7458e4dfe867b9be7e24f74cc756d491c2))
* land core v4 cleanup and action availability queries ([#331](https://github.com/manifesto-ai/core/issues/331)) ([30ec2b4](https://github.com/manifesto-ai/core/commit/30ec2b481cebbf2a2640fe21fd7909d6b033a1b4))
* roll up ADR-020 dispatchability and schema typing ([e85ec08](https://github.com/manifesto-ai/core/commit/e85ec082f61c117ee1b22707739f7528979b15fd))
* **runtime:** add family reports and narrow provider seams ([693d669](https://github.com/manifesto-ai/core/commit/693d66946530f7986631d9665c703b1b61418f96))
* **runtime:** add family reports and narrow provider seams ([27277ec](https://github.com/manifesto-ai/core/commit/27277ec190b365abd8248b7e74b84f7995618db4))
* **runtime:** add schema graph introspection and align docs ([79fce9c](https://github.com/manifesto-ai/core/commit/79fce9ceec6885a1925e6017f1e3b97e8a9208f1))
* **runtime:** add schema graph introspection and sync docs ([b00c053](https://github.com/manifesto-ai/core/commit/b00c05337f929785763479fd0b3161309849a326))
* **sdk:** implement adr-018 public snapshot boundary ([47d05ad](https://github.com/manifesto-ai/core/commit/47d05ad702282f44331db4aa322697b3debeeaa4))
* super hard cut world facade ([a5d33f9](https://github.com/manifesto-ai/core/commit/a5d33f98cfcfea914e445900fc2410766e0f1358))


### Bug Fixes

* align input preflight and governance rejection events ([8fcca8e](https://github.com/manifesto-ai/core/commit/8fcca8e37a9c85b6e006f1911650f90af4742030))
* fall back to failed governance recovery ([7c97506](https://github.com/manifesto-ai/core/commit/7c97506e1a9f4fae9d5e206b613102cbbdb0b6ae))
* **governance:** normalize failed settlement without world ([8290758](https://github.com/manifesto-ai/core/commit/829075825ed529c2896a9e1cb2aa7a21c6ee61cc))
* harden lineage config and finalize recovery ([1742398](https://github.com/manifesto-ai/core/commit/1742398121fefce13ff534d2ffaafd124f7e445a))
* preserve governed seal outcomes and execution keys ([dc40be6](https://github.com/manifesto-ai/core/commit/dc40be6ebd1a5ed2dfdd194693e3efd240f54019))
* **runtime:** propagate explanation reads to decorators ([469aeae](https://github.com/manifesto-ai/core/commit/469aeae0860f0443557fa76ae9ee08a1ef1c7ff7))
* tighten governance post-commit events ([7a9404f](https://github.com/manifesto-ai/core/commit/7a9404f47d54dbaf8984cd1851c404a4743412a8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.11.0
    * @manifesto-ai/sdk bumped to 3.17.0

## [3.11.5](https://github.com/manifesto-ai/core/compare/governance-v3.11.4...governance-v3.11.5) (2026-04-18)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.10.5
    * @manifesto-ai/sdk bumped to 3.16.0

## [3.11.4](https://github.com/manifesto-ai/core/compare/governance-v3.11.3...governance-v3.11.4) (2026-04-17)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.10.4
    * @manifesto-ai/sdk bumped to 3.15.1

## [3.11.3](https://github.com/manifesto-ai/core/compare/governance-v3.11.2...governance-v3.11.3) (2026-04-16)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.10.3
    * @manifesto-ai/sdk bumped to 3.15.0

## [3.11.2](https://github.com/manifesto-ai/core/compare/governance-v3.11.1...governance-v3.11.2) (2026-04-15)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.10.2
    * @manifesto-ai/sdk bumped to 3.14.0

## [3.11.1](https://github.com/manifesto-ai/core/compare/governance-v3.11.0...governance-v3.11.1) (2026-04-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.10.1
    * @manifesto-ai/sdk bumped to 3.13.1

## [3.11.0](https://github.com/manifesto-ai/core/compare/governance-v3.10.1...governance-v3.11.0) (2026-04-13)


### Features

* **runtime:** add family reports and narrow provider seams ([693d669](https://github.com/manifesto-ai/core/commit/693d66946530f7986631d9665c703b1b61418f96))
* **runtime:** add family reports and narrow provider seams ([27277ec](https://github.com/manifesto-ai/core/commit/27277ec190b365abd8248b7e74b84f7995618db4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.10.0
    * @manifesto-ai/sdk bumped to 3.13.0
  * devDependencies
    * @manifesto-ai/core bumped to 2.12.0
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.11.1 to ^2.12.0

## [3.10.1](https://github.com/manifesto-ai/core/compare/governance-v3.10.0...governance-v3.10.1) (2026-04-12)


### Bug Fixes

* **docs:** align clean urls and favicon links ([0db1df5](https://github.com/manifesto-ai/core/commit/0db1df54599619026f41bb14317a27ca21498644))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.9.1
    * @manifesto-ai/sdk bumped to 3.12.1
  * devDependencies
    * @manifesto-ai/core bumped to 2.11.1
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.11.0 to ^2.11.1

## [3.10.0](https://github.com/manifesto-ai/core/compare/governance-v3.9.0...governance-v3.10.0) (2026-04-12)


### Features

* add sdk intent explanation reads and hard-cut docs flow ([6a0b528](https://github.com/manifesto-ai/core/commit/6a0b5280081b7bfc0af5be2720468663a0944fa0))
* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))
* **decorators:** inherit legality query surface ([5ddc9e2](https://github.com/manifesto-ai/core/commit/5ddc9e25178b504f2cec131b20c7fdbd10ec31ed))
* **governance:** add waitForProposal observer ([94be2f1](https://github.com/manifesto-ai/core/commit/94be2f1e24c8228b4542393048090cd7dbd15929))
* **governance:** add waitForProposal observer ([26ccdf8](https://github.com/manifesto-ai/core/commit/26ccdf8842679f059b083584a7635edc14011d00))
* implement governance phase 3 split ([ba625b9](https://github.com/manifesto-ai/core/commit/ba625b982bf959d2d15de9762899e4f40cf4724b))
* implement world facade phase 4 split ([b988dd7](https://github.com/manifesto-ai/core/commit/b988dd7458e4dfe867b9be7e24f74cc756d491c2))
* land core v4 cleanup and action availability queries ([#331](https://github.com/manifesto-ai/core/issues/331)) ([30ec2b4](https://github.com/manifesto-ai/core/commit/30ec2b481cebbf2a2640fe21fd7909d6b033a1b4))
* roll up ADR-020 dispatchability and schema typing ([e85ec08](https://github.com/manifesto-ai/core/commit/e85ec082f61c117ee1b22707739f7528979b15fd))
* **runtime:** add schema graph introspection and align docs ([79fce9c](https://github.com/manifesto-ai/core/commit/79fce9ceec6885a1925e6017f1e3b97e8a9208f1))
* **runtime:** add schema graph introspection and sync docs ([b00c053](https://github.com/manifesto-ai/core/commit/b00c05337f929785763479fd0b3161309849a326))
* **sdk:** implement adr-018 public snapshot boundary ([47d05ad](https://github.com/manifesto-ai/core/commit/47d05ad702282f44331db4aa322697b3debeeaa4))
* super hard cut world facade ([a5d33f9](https://github.com/manifesto-ai/core/commit/a5d33f98cfcfea914e445900fc2410766e0f1358))


### Bug Fixes

* align input preflight and governance rejection events ([8fcca8e](https://github.com/manifesto-ai/core/commit/8fcca8e37a9c85b6e006f1911650f90af4742030))
* fall back to failed governance recovery ([7c97506](https://github.com/manifesto-ai/core/commit/7c97506e1a9f4fae9d5e206b613102cbbdb0b6ae))
* **governance:** normalize failed settlement without world ([8290758](https://github.com/manifesto-ai/core/commit/829075825ed529c2896a9e1cb2aa7a21c6ee61cc))
* harden lineage config and finalize recovery ([1742398](https://github.com/manifesto-ai/core/commit/1742398121fefce13ff534d2ffaafd124f7e445a))
* preserve governed seal outcomes and execution keys ([dc40be6](https://github.com/manifesto-ai/core/commit/dc40be6ebd1a5ed2dfdd194693e3efd240f54019))
* **runtime:** propagate explanation reads to decorators ([469aeae](https://github.com/manifesto-ai/core/commit/469aeae0860f0443557fa76ae9ee08a1ef1c7ff7))
* tighten governance post-commit events ([7a9404f](https://github.com/manifesto-ai/core/commit/7a9404f47d54dbaf8984cd1851c404a4743412a8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.9.0
    * @manifesto-ai/sdk bumped to 3.12.0

## [3.9.0](https://github.com/manifesto-ai/core/compare/governance-v3.8.1...governance-v3.9.0) (2026-04-12)


### Features

* add sdk intent explanation reads and hard-cut docs flow ([6a0b528](https://github.com/manifesto-ai/core/commit/6a0b5280081b7bfc0af5be2720468663a0944fa0))
* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))
* **decorators:** inherit legality query surface ([5ddc9e2](https://github.com/manifesto-ai/core/commit/5ddc9e25178b504f2cec131b20c7fdbd10ec31ed))
* **governance:** add waitForProposal observer ([94be2f1](https://github.com/manifesto-ai/core/commit/94be2f1e24c8228b4542393048090cd7dbd15929))
* **governance:** add waitForProposal observer ([26ccdf8](https://github.com/manifesto-ai/core/commit/26ccdf8842679f059b083584a7635edc14011d00))
* implement governance phase 3 split ([ba625b9](https://github.com/manifesto-ai/core/commit/ba625b982bf959d2d15de9762899e4f40cf4724b))
* implement world facade phase 4 split ([b988dd7](https://github.com/manifesto-ai/core/commit/b988dd7458e4dfe867b9be7e24f74cc756d491c2))
* land core v4 cleanup and action availability queries ([#331](https://github.com/manifesto-ai/core/issues/331)) ([30ec2b4](https://github.com/manifesto-ai/core/commit/30ec2b481cebbf2a2640fe21fd7909d6b033a1b4))
* roll up ADR-020 dispatchability and schema typing ([e85ec08](https://github.com/manifesto-ai/core/commit/e85ec082f61c117ee1b22707739f7528979b15fd))
* **runtime:** add schema graph introspection and align docs ([79fce9c](https://github.com/manifesto-ai/core/commit/79fce9ceec6885a1925e6017f1e3b97e8a9208f1))
* **runtime:** add schema graph introspection and sync docs ([b00c053](https://github.com/manifesto-ai/core/commit/b00c05337f929785763479fd0b3161309849a326))
* **sdk:** implement adr-018 public snapshot boundary ([47d05ad](https://github.com/manifesto-ai/core/commit/47d05ad702282f44331db4aa322697b3debeeaa4))
* super hard cut world facade ([a5d33f9](https://github.com/manifesto-ai/core/commit/a5d33f98cfcfea914e445900fc2410766e0f1358))


### Bug Fixes

* align input preflight and governance rejection events ([8fcca8e](https://github.com/manifesto-ai/core/commit/8fcca8e37a9c85b6e006f1911650f90af4742030))
* fall back to failed governance recovery ([7c97506](https://github.com/manifesto-ai/core/commit/7c97506e1a9f4fae9d5e206b613102cbbdb0b6ae))
* **governance:** normalize failed settlement without world ([8290758](https://github.com/manifesto-ai/core/commit/829075825ed529c2896a9e1cb2aa7a21c6ee61cc))
* harden lineage config and finalize recovery ([1742398](https://github.com/manifesto-ai/core/commit/1742398121fefce13ff534d2ffaafd124f7e445a))
* preserve governed seal outcomes and execution keys ([dc40be6](https://github.com/manifesto-ai/core/commit/dc40be6ebd1a5ed2dfdd194693e3efd240f54019))
* **runtime:** propagate explanation reads to decorators ([469aeae](https://github.com/manifesto-ai/core/commit/469aeae0860f0443557fa76ae9ee08a1ef1c7ff7))
* tighten governance post-commit events ([7a9404f](https://github.com/manifesto-ai/core/commit/7a9404f47d54dbaf8984cd1851c404a4743412a8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.8.0
    * @manifesto-ai/sdk bumped to 3.11.0

## [3.8.1](https://github.com/manifesto-ai/core/compare/governance-v3.8.0...governance-v3.8.1) (2026-04-12)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.7.2
    * @manifesto-ai/sdk bumped to 3.10.0

## [3.8.0](https://github.com/manifesto-ai/core/compare/governance-v3.7.0...governance-v3.8.0) (2026-04-12)


### Features

* **governance:** add waitForProposal observer ([94be2f1](https://github.com/manifesto-ai/core/commit/94be2f1e24c8228b4542393048090cd7dbd15929))
* **governance:** add waitForProposal observer ([26ccdf8](https://github.com/manifesto-ai/core/commit/26ccdf8842679f059b083584a7635edc14011d00))


### Bug Fixes

* **governance:** normalize failed settlement without world ([8290758](https://github.com/manifesto-ai/core/commit/829075825ed529c2896a9e1cb2aa7a21c6ee61cc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.7.1
    * @manifesto-ai/sdk bumped to 3.9.0

## [3.7.0](https://github.com/manifesto-ai/core/compare/governance-v3.6.0...governance-v3.7.0) (2026-04-09)


### Features

* add sdk intent explanation reads and hard-cut docs flow ([6a0b528](https://github.com/manifesto-ai/core/commit/6a0b5280081b7bfc0af5be2720468663a0944fa0))


### Bug Fixes

* **runtime:** propagate explanation reads to decorators ([469aeae](https://github.com/manifesto-ai/core/commit/469aeae0860f0443557fa76ae9ee08a1ef1c7ff7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.7.0
    * @manifesto-ai/sdk bumped to 3.8.0

## [3.6.0](https://github.com/manifesto-ai/core/compare/governance-v3.5.1...governance-v3.6.0) (2026-04-08)


### Features

* **decorators:** inherit legality query surface ([5ddc9e2](https://github.com/manifesto-ai/core/commit/5ddc9e25178b504f2cec131b20c7fdbd10ec31ed))
* roll up ADR-020 dispatchability and schema typing ([e85ec08](https://github.com/manifesto-ai/core/commit/e85ec082f61c117ee1b22707739f7528979b15fd))


### Bug Fixes

* align input preflight and governance rejection events ([8fcca8e](https://github.com/manifesto-ai/core/commit/8fcca8e37a9c85b6e006f1911650f90af4742030))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.6.0
    * @manifesto-ai/sdk bumped to 3.7.0
  * devDependencies
    * @manifesto-ai/core bumped to 2.11.0
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.10.0 to ^2.11.0

## [3.5.1](https://github.com/manifesto-ai/core/compare/governance-v3.5.0...governance-v3.5.1) (2026-04-07)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.5.1
    * @manifesto-ai/sdk bumped to 3.6.0

## [3.5.0](https://github.com/manifesto-ai/core/compare/governance-v3.4.0...governance-v3.5.0) (2026-04-06)


### Features

* **runtime:** add schema graph introspection and align docs ([79fce9c](https://github.com/manifesto-ai/core/commit/79fce9ceec6885a1925e6017f1e3b97e8a9208f1))
* **runtime:** add schema graph introspection and sync docs ([b00c053](https://github.com/manifesto-ai/core/commit/b00c05337f929785763479fd0b3161309849a326))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.5.0
    * @manifesto-ai/sdk bumped to 3.5.0
  * devDependencies
    * @manifesto-ai/core bumped to 2.10.0
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.9.0 to ^2.10.0

## [3.4.0](https://github.com/manifesto-ai/core/compare/governance-v3.3.2...governance-v3.4.0) (2026-04-03)


### Features

* **sdk:** implement adr-018 public snapshot boundary ([47d05ad](https://github.com/manifesto-ai/core/commit/47d05ad702282f44331db4aa322697b3debeeaa4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.4.0
    * @manifesto-ai/sdk bumped to 3.4.0
  * devDependencies
    * @manifesto-ai/core bumped to 2.9.0
  * peerDependencies
    * @manifesto-ai/core bumped from ^2.0.0 to ^2.9.0

## [3.3.2](https://github.com/manifesto-ai/core/compare/governance-v3.3.1...governance-v3.3.2) (2026-04-02)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.3.2
    * @manifesto-ai/sdk bumped to 3.3.2

## [3.3.1](https://github.com/manifesto-ai/core/compare/governance-v3.3.0...governance-v3.3.1) (2026-04-02)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.3.1
    * @manifesto-ai/sdk bumped to 3.3.1

## [3.3.0](https://github.com/manifesto-ai/core/compare/governance-v3.2.0...governance-v3.3.0) (2026-04-02)


### Features

* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))
* implement governance phase 3 split ([ba625b9](https://github.com/manifesto-ai/core/commit/ba625b982bf959d2d15de9762899e4f40cf4724b))
* implement world facade phase 4 split ([b988dd7](https://github.com/manifesto-ai/core/commit/b988dd7458e4dfe867b9be7e24f74cc756d491c2))
* land core v4 cleanup and action availability queries ([#331](https://github.com/manifesto-ai/core/issues/331)) ([30ec2b4](https://github.com/manifesto-ai/core/commit/30ec2b481cebbf2a2640fe21fd7909d6b033a1b4))
* super hard cut world facade ([a5d33f9](https://github.com/manifesto-ai/core/commit/a5d33f98cfcfea914e445900fc2410766e0f1358))


### Bug Fixes

* fall back to failed governance recovery ([7c97506](https://github.com/manifesto-ai/core/commit/7c97506e1a9f4fae9d5e206b613102cbbdb0b6ae))
* harden lineage config and finalize recovery ([1742398](https://github.com/manifesto-ai/core/commit/1742398121fefce13ff534d2ffaafd124f7e445a))
* preserve governed seal outcomes and execution keys ([dc40be6](https://github.com/manifesto-ai/core/commit/dc40be6ebd1a5ed2dfdd194693e3efd240f54019))
* tighten governance post-commit events ([7a9404f](https://github.com/manifesto-ai/core/commit/7a9404f47d54dbaf8984cd1851c404a4743412a8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.3.0
    * @manifesto-ai/sdk bumped to 3.3.0

## [3.1.2](https://github.com/manifesto-ai/core/compare/governance-v3.1.1...governance-v3.1.2) (2026-04-01)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @manifesto-ai/lineage bumped to 3.1.2
    * @manifesto-ai/sdk bumped to 3.1.2

## [3.1.1](https://github.com/manifesto-ai/core/compare/governance-v3.1.0...governance-v3.1.1) (2026-04-01)


### Bug Fixes

* fall back to failed governance recovery ([7c97506](https://github.com/manifesto-ai/core/commit/7c97506e1a9f4fae9d5e206b613102cbbdb0b6ae))
* harden lineage config and finalize recovery ([1742398](https://github.com/manifesto-ai/core/commit/1742398121fefce13ff534d2ffaafd124f7e445a))
* preserve governed seal outcomes and execution keys ([dc40be6](https://github.com/manifesto-ai/core/commit/dc40be6ebd1a5ed2dfdd194693e3efd240f54019))

## [3.1.0](https://github.com/manifesto-ai/core/compare/governance-v3.0.0...governance-v3.1.0) (2026-04-01)


### Features

* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))
* implement governance phase 3 split ([ba625b9](https://github.com/manifesto-ai/core/commit/ba625b982bf959d2d15de9762899e4f40cf4724b))
* implement world facade phase 4 split ([b988dd7](https://github.com/manifesto-ai/core/commit/b988dd7458e4dfe867b9be7e24f74cc756d491c2))
* land core v4 cleanup and action availability queries ([#331](https://github.com/manifesto-ai/core/issues/331)) ([30ec2b4](https://github.com/manifesto-ai/core/commit/30ec2b481cebbf2a2640fe21fd7909d6b033a1b4))
* super hard cut world facade ([a5d33f9](https://github.com/manifesto-ai/core/commit/a5d33f98cfcfea914e445900fc2410766e0f1358))


### Bug Fixes

* tighten governance post-commit events ([7a9404f](https://github.com/manifesto-ai/core/commit/7a9404f47d54dbaf8984cd1851c404a4743412a8))

## [0.1.1](https://github.com/manifesto-ai/core/compare/governance-v0.1.0...governance-v0.1.1) (2026-03-31)


### Features

* align consumers for phase 5 facade rollout ([7c59041](https://github.com/manifesto-ai/core/commit/7c590412d9b16c52270c62ed35140d1f7ef0ecb0))
* implement governance phase 3 split ([ba625b9](https://github.com/manifesto-ai/core/commit/ba625b982bf959d2d15de9762899e4f40cf4724b))
* implement world facade phase 4 split ([b988dd7](https://github.com/manifesto-ai/core/commit/b988dd7458e4dfe867b9be7e24f74cc756d491c2))
* land core v4 cleanup and action availability queries ([#331](https://github.com/manifesto-ai/core/issues/331)) ([30ec2b4](https://github.com/manifesto-ai/core/commit/30ec2b481cebbf2a2640fe21fd7909d6b033a1b4))
* super hard cut world facade ([a5d33f9](https://github.com/manifesto-ai/core/commit/a5d33f98cfcfea914e445900fc2410766e0f1358))


### Bug Fixes

* tighten governance post-commit events ([7a9404f](https://github.com/manifesto-ai/core/commit/7a9404f47d54dbaf8984cd1851c404a4743412a8))
