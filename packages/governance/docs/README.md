# Governance Docs

> Governance v5 is the legitimacy-owning decorator for the SDK v5
> action-candidate runtime.

> **Current Contract Note:** The current governance contract is
> [governance-SPEC.md](governance-SPEC.md). The canonical v5 governed write
> ingress is `actions.x.submit()` / `action(name).submit()`, and settlement is
> observed through `pending.waitForSettlement()` or `app.waitForSettlement(ref)`.
> The v2.0.0 and v1.0.0 specs remain as historical references.

## Read First

- [../README.md](../README.md) - package landing and canonical usage
- [GUIDE.md](GUIDE.md) - practical `withGovernance()`, governance-mode `submit()`, and `waitForSettlement(ref)` composition guide
- [governance-SPEC.md](governance-SPEC.md) - current normative governance contract

## Historical References

- [governance-SPEC-2.0.0v.md](governance-SPEC-2.0.0v.md) - service-first split package baseline
- [governance-SPEC-1.0.0v.md](governance-SPEC-1.0.0v.md) - original extracted protocol baseline
- [VERSION-INDEX.md](VERSION-INDEX.md) - version map and reading order
