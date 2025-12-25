# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| 0.2.x   | :x:                |
| < 0.2   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

### Do Not

- Do not open a public GitHub issue for security vulnerabilities
- Do not disclose the vulnerability publicly until it has been addressed

### Do

1. **Email us directly** at security@manifesto-ai.dev (or open a private security advisory on GitHub)
2. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 5 business days
- **Resolution Timeline**: We aim to resolve critical vulnerabilities within 30 days
- **Credit**: We will credit reporters in our security advisories (unless you prefer anonymity)

## Security Considerations

### Expression DSL

The Expression DSL is designed to be safe by default:

- Expressions are pure functions (no side effects)
- No access to JavaScript `eval()` or `Function()`
- No network access from expressions
- No file system access

```typescript
// Safe: Pure expression
['*', ['get', 'data.price'], 2]

// Not possible: No raw JS execution
eval('malicious code')  // Not accessible in expressions
```

### Effect System

Effects are controlled and auditable:

- All side effects are declared, not executed directly
- Effects are executed by the runtime with controlled handlers
- API calls go through the effect handler (can be monitored/proxied)

### Input Validation

All input is validated using Zod schemas:

```typescript
dataSchema: z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
});
```

### AI Agent Safety

When integrating AI agents:

- Actions have preconditions that are always checked
- AI cannot bypass validation rules
- All AI actions are logged and auditable
- Rate limiting recommended for production

## Best Practices

### API Keys

Never commit API keys or secrets:

```typescript
// Wrong
const adapter = createAnthropicAdapter({
  apiKey: 'sk-ant-...',  // Never commit!
});

// Correct
const adapter = createAnthropicAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

### Environment Variables

Use `.env` files for local development and never commit them:

```bash
# .gitignore
.env
.env.local
.env.*.local
```

### Rate Limiting

Enable rate limiting for LLM adapters:

```typescript
const adapter = createAnthropicAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  rateLimit: 100,  // requests per minute
});
```

### Audit Logging

Log all actions in production:

```typescript
runtime.subscribe((snapshot, event) => {
  if (event.type === 'action') {
    logger.info('Action executed', {
      action: event.actionId,
      user: getCurrentUser(),
      timestamp: new Date().toISOString(),
    });
  }
});
```

## Dependencies

We regularly update dependencies to address security vulnerabilities. Run `pnpm audit` to check for known vulnerabilities.

## Contact

For security-related questions that are not vulnerabilities, you can:

- Open a GitHub Discussion with the "security" label
- Email us at security@manifesto-ai.dev
