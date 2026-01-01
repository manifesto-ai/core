# Security Policy

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**DO NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email security reports to:

**security@manifesto.ai**

(Note: Replace with actual security contact email when available)

### What to Include

Please include the following information in your report:

1. **Description** — A clear description of the vulnerability
2. **Impact** — The potential impact if exploited
3. **Steps to Reproduce** — Detailed steps to reproduce the issue
4. **Affected Versions** — Which versions are affected
5. **Suggested Fix** — If you have a recommendation (optional)

### Response Timeline

- **Initial Response:** Within 48 hours
- **Status Update:** Within 7 days
- **Fix Timeline:** Depends on severity (see below)

### Severity Levels

| Severity | Response Time | Example |
|----------|---------------|---------|
| **Critical** | 24-48 hours | Remote code execution, data breach |
| **High** | 7 days | Authentication bypass, privilege escalation |
| **Medium** | 30 days | Denial of service, information disclosure |
| **Low** | 90 days | Minor information leak, edge case bugs |

### Disclosure Policy

- We will acknowledge your report within 48 hours
- We will provide regular updates on the fix progress
- We will notify you when a fix is released
- We ask that you do not publicly disclose the vulnerability until we have released a fix

### Recognition

We maintain a Security Hall of Fame to recognize security researchers who responsibly disclose vulnerabilities:

- Your name will be listed in our SECURITY.md (with your permission)
- You will be credited in the release notes for the security fix

### Out of Scope

The following are **not** considered security vulnerabilities:

- Issues in dependencies (please report to the respective maintainers)
- Theoretical attacks without proof of concept
- Social engineering attacks
- Physical attacks on infrastructure
- Denial of service attacks requiring excessive resources

---

## Security Best Practices

When using Manifesto in production:

### 1. Input Validation

- Always validate user input before passing to domain actions
- Use Zod schemas for runtime validation
- Never trust external data sources

### 2. Effect Handlers

- Effect handlers run with Host privileges
- Never execute untrusted code in effect handlers
- Sanitize all external inputs
- Use principle of least privilege

### 3. Authority Configuration

- Configure Authority rules to prevent unauthorized state changes
- Review Authority logic for bypass vulnerabilities
- Test governance rules thoroughly

### 4. Trace & Audit

- Enable trace recording in production
- Monitor for suspicious Intent patterns
- Regularly audit World lineage for anomalies

### 5. Dependency Management

- Keep dependencies up to date
- Use `pnpm audit` to check for known vulnerabilities
- Review security advisories regularly

---

## Known Issues

(None at this time)

---

## Security Updates

Security patches are released as patch versions (e.g., 1.0.1) and documented in the [CHANGELOG.md](./CHANGELOG.md).

Subscribe to our [GitHub Security Advisories](https://github.com/manifesto-ai/core/security/advisories) to be notified of security updates.

---

*Last updated: 2026-01-01*
