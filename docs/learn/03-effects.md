# Tutorial 3: Working with Effects

> **Time:** 25 minutes
> **Goal:** Connect to external APIs and handle async operations

In this tutorial, you'll build a user profile application that fetches data from an API, handles loading states, and manages errors gracefully.

---

## What You'll Build

A user profile app with:
- Fetch user data from an API
- Loading and error state management
- Retry functionality

---

## Prerequisites

Before starting, ensure you've completed:
1. [Your First App](./01-your-first-app)
2. [Actions and State](./02-actions-and-state)

---

## Understanding Effects

**Effects are declarations, not executions.**

When Core encounters an effect in a Flow:
1. It records a **Requirement** in `snapshot.system.pendingRequirements`
2. It returns with `status: 'pending'`
3. **Host** executes the effect via a registered handler
4. The handler returns **patches** (not values!)
5. Host applies patches and calls `compute()` again
6. Core sees the result in Snapshot

```
Core: "I need effect 'api.fetchUser' with params {id: '123'}"
       ↓
Host: Executes via registered handler
       ↓
Handler: Returns patches like [{op: 'set', path: 'user', value: {...}}]
       ↓
Host: Applies patches to Snapshot
       ↓
Core: Sees result in next compute cycle
```

---

## Step 1: Define State for API Data

Create `user-profile.mel`:

```mel
domain UserProfile {
  type User = {
    id: string,
    name: string,
    email: string
  }

  state {
    status: "idle" | "loading" | "success" | "error" = "idle"
    user: User | null = null
    error: string | null = null
    fetchIntent: string | null = null
  }
}
```

**Key points:**
- `status` tracks the request lifecycle
- `user` holds the fetched data (null until loaded)
- `error` stores error messages
- `fetchIntent` is our re-entry guard

---

## Step 2: Add the Fetch Action

```mel
domain UserProfile {
  type User = {
    id: string,
    name: string,
    email: string
  }

  state {
    status: "idle" | "loading" | "success" | "error" = "idle"
    user: User | null = null
    error: string | null = null
    fetchIntent: string | null = null
  }

  action fetchUser(id: string) {
    once(fetchIntent) {
      patch fetchIntent = $meta.intentId
      patch status = "loading"
      patch error = null
      effect api.fetchUser({ id: id })
    }
  }
}
```

**New concepts:**

| Element | Description |
|---------|-------------|
| `effect api.fetchUser({...})` | Declares an effect for Host to execute |
| `patch status = "loading"` | Set loading state before effect |
| `patch error = null` | Clear previous errors |

**Important:** The `once()` guard prevents the effect from being declared multiple times.

---

## Step 3: Register the Effect Handler

Create `main.ts`:

```typescript
import { createApp } from "@manifesto-ai/app";
import UserProfileMel from "./user-profile.mel";

const app = createApp(UserProfileMel, {
  effects: {
    'api.fetchUser': async (type, params, context) => {
      try {
        const response = await fetch(`/api/users/${params.id}`);

        if (!response.ok) {
          return [
            { op: 'set', path: 'data.status', value: 'error' },
            { op: 'set', path: 'data.error', value: `HTTP ${response.status}` }
          ];
        }

        const user = await response.json();

        return [
          { op: 'set', path: 'data.user', value: user },
          { op: 'set', path: 'data.status', value: 'success' }
        ];
      } catch (error) {
        return [
          { op: 'set', path: 'data.status', value: 'error' },
          { op: 'set', path: 'data.error', value: error.message }
        ];
      }
    }
  }
});

async function main() {
  await app.ready();

  // Subscribe to status changes
  app.subscribe(
    (state) => state.data.status,
    (status) => console.log("Status:", status)
  );

  // Fetch a user
  await app.act("fetchUser", { id: "123" }).done();

  // Check results
  const state = app.getState();
  if (state.data.status === "success") {
    console.log("User:", state.data.user);
  } else {
    console.log("Error:", state.data.error);
  }
}

main().catch(console.error);
```

---

## Step 4: Understanding the Handler Contract

Effect handlers MUST follow this contract:

```typescript
type EffectHandler = (
  type: string,                      // Effect type (e.g., 'api.fetchUser')
  params: Record<string, unknown>,   // Parameters from effect declaration
  context: EffectContext             // Contains snapshot and requirement info
) => Promise<Patch[]>;               // MUST return patches, NEVER throw
```

**Critical rules:**

1. **Always return patches** - Never return raw values
2. **Never throw** - Catch all errors and return error patches
3. **No domain logic** - Handlers do IO only, domain logic stays in Flow
4. **Only JSON-serializable values** - No functions, Dates, or class instances

```typescript
// WRONG: Returning value
return user;

// WRONG: Throwing
throw new Error("Failed");

// RIGHT: Returning patches
return [
  { op: 'set', path: 'data.user', value: user }
];

// RIGHT: Error as patches
return [
  { op: 'set', path: 'data.error', value: error.message }
];
```

---

## Step 5: Handle Errors Gracefully

Update the MEL domain to add a reset action:

```mel
domain UserProfile {
  type User = {
    id: string,
    name: string,
    email: string
  }

  state {
    status: "idle" | "loading" | "success" | "error" = "idle"
    user: User | null = null
    error: string | null = null
    fetchIntent: string | null = null
  }

  computed hasError = eq(status, "error")
  computed isLoading = eq(status, "loading")
  computed hasUser = isNotNull(user)

  action fetchUser(id: string) {
    once(fetchIntent) {
      patch fetchIntent = $meta.intentId
      patch status = "loading"
      patch error = null
      effect api.fetchUser({ id: id })
    }
  }

  action reset() {
    once(resetIntent) {
      patch resetIntent = $meta.intentId
      patch status = "idle"
      patch user = null
      patch error = null
      patch fetchIntent = null
    }
  }
}
```

Use the computed values in your app:

```typescript
const state = app.getState();

if (state.computed.isLoading) {
  console.log("Loading...");
} else if (state.computed.hasError) {
  console.log("Error:", state.data.error);
} else if (state.computed.hasUser) {
  console.log("User:", state.data.user);
}
```

---

## Step 6: Add Retry Functionality

Update the domain with retry state:

```mel
domain UserProfile {
  type User = {
    id: string,
    name: string,
    email: string
  }

  state {
    status: "idle" | "loading" | "success" | "error" = "idle"
    user: User | null = null
    error: string | null = null
    fetchIntent: string | null = null
    lastUserId: string | null = null
    retryCount: number = 0
  }

  computed hasError = eq(status, "error")
  computed isLoading = eq(status, "loading")
  computed hasUser = isNotNull(user)
  computed canRetry = and(hasError, lt(retryCount, 3))

  action fetchUser(id: string) {
    once(fetchIntent) {
      patch fetchIntent = $meta.intentId
      patch status = "loading"
      patch error = null
      patch lastUserId = id
      patch retryCount = 0
      effect api.fetchUser({ id: id })
    }
  }

  action retry() available when canRetry {
    once(retryIntent) {
      patch retryIntent = $meta.intentId
      patch fetchIntent = null
      patch status = "loading"
      patch error = null
      patch retryCount = add(retryCount, 1)
      effect api.fetchUser({ id: lastUserId })
    }
  }

  action reset() {
    once(resetIntent) {
      patch resetIntent = $meta.intentId
      patch status = "idle"
      patch user = null
      patch error = null
      patch fetchIntent = null
      patch retryIntent = null
      patch lastUserId = null
      patch retryCount = 0
    }
  }
}
```

**Key patterns:**
- `lastUserId` stores the ID for retry
- `retryCount` tracks attempts
- `canRetry` computed value limits retries to 3
- `available when canRetry` disables retry when limit reached

---

## Complete Example

Here's the complete application:

**user-profile.mel:**

```mel
domain UserProfile {
  type User = {
    id: string,
    name: string,
    email: string
  }

  state {
    status: "idle" | "loading" | "success" | "error" = "idle"
    user: User | null = null
    error: string | null = null
    fetchIntent: string | null = null
    retryIntent: string | null = null
    resetIntent: string | null = null
    lastUserId: string | null = null
    retryCount: number = 0
  }

  computed hasError = eq(status, "error")
  computed isLoading = eq(status, "loading")
  computed hasUser = isNotNull(user)
  computed canRetry = and(hasError, lt(retryCount, 3))

  action fetchUser(id: string) {
    once(fetchIntent) {
      patch fetchIntent = $meta.intentId
      patch status = "loading"
      patch error = null
      patch lastUserId = id
      patch retryCount = 0
      effect api.fetchUser({ id: id })
    }
  }

  action retry() available when canRetry {
    once(retryIntent) {
      patch retryIntent = $meta.intentId
      patch fetchIntent = null
      patch status = "loading"
      patch error = null
      patch retryCount = add(retryCount, 1)
      effect api.fetchUser({ id: lastUserId })
    }
  }

  action reset() {
    once(resetIntent) {
      patch resetIntent = $meta.intentId
      patch status = "idle"
      patch user = null
      patch error = null
      patch fetchIntent = null
      patch retryIntent = null
      patch lastUserId = null
      patch retryCount = 0
    }
  }
}
```

**main.ts:**

```typescript
import { createApp } from "@manifesto-ai/app";
import UserProfileMel from "./user-profile.mel";

// Mock API for testing
const mockUsers = {
  "123": { id: "123", name: "Alice", email: "alice@example.com" },
  "456": { id: "456", name: "Bob", email: "bob@example.com" },
};

const app = createApp(UserProfileMel, {
  effects: {
    'api.fetchUser': async (type, params) => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const user = mockUsers[params.id as string];

      if (!user) {
        return [
          { op: 'set', path: 'data.status', value: 'error' },
          { op: 'set', path: 'data.error', value: 'User not found' }
        ];
      }

      return [
        { op: 'set', path: 'data.user', value: user },
        { op: 'set', path: 'data.status', value: 'success' }
      ];
    }
  }
});

async function main() {
  await app.ready();

  // Subscribe to all relevant state
  app.subscribe(
    (state) => ({
      status: state.data.status,
      user: state.data.user,
      error: state.data.error,
      retryCount: state.data.retryCount
    }),
    (data) => console.log("State:", data)
  );

  // Fetch existing user
  console.log("\n--- Fetching user 123 ---");
  await app.act("fetchUser", { id: "123" }).done();

  // Reset and fetch non-existent user
  console.log("\n--- Fetching user 999 (will fail) ---");
  await app.act("reset").done();
  await app.act("fetchUser", { id: "999" }).done();

  // Try retry
  console.log("\n--- Retrying ---");
  await app.act("retry").done();

  console.log("\nRetry count:", app.getState().data.retryCount);

  await app.dispose();
}

main().catch(console.error);
```

Run with:

```bash
npx tsx main.ts
```

---

## Key Concepts Learned

| Concept | Description |
|---------|-------------|
| **Effect declaration** | `effect type({ params })` - declares what Host should do |
| **Effect handler** | Async function returning `Patch[]`, never throws |
| **Loading states** | Use status enum: `"idle" \| "loading" \| "success" \| "error"` |
| **Error handling** | Errors are patches to state, not exceptions |
| **Retry pattern** | Store context for retry, track attempt count |
| **Guard state** | Always use `once()` to prevent re-execution |

---

## Exercises

### Exercise 1: Add Cancel Functionality

Add a `cancel` action that:
- Clears `fetchIntent` to allow new fetches
- Sets status back to "idle"
- Only available when loading

### Exercise 2: Fetch Multiple Users

Extend the domain to:
- Store multiple users in `users: Record<string, User>`
- Add `fetchUsers(ids: Array<string>)` action
- Track loading state per user

### Exercise 3: Add Caching

Implement caching:
- Store `fetchedAt: number | null` per user
- Add `isCacheValid` computed (e.g., within 5 minutes)
- Skip API call if cache is valid

---

## What's Next?

In the next tutorial, you'll learn about **Governance** - how to:
- Control who can perform actions
- Add authority checks
- Implement approval workflows

[Learn about World](/concepts/world) | [Effect Handlers Guide](/guides/effect-handlers)

---

## Reference

### Effect Handler Signature

```typescript
type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: {
    snapshot: Readonly<Snapshot>;
    requirement: Requirement;
  }
) => Promise<Patch[]>;
```

### Patch Operations

| Operation | Description |
|-----------|-------------|
| `{ op: 'set', path, value }` | Set value at path |
| `{ op: 'unset', path }` | Remove value at path |
| `{ op: 'merge', path, value }` | Shallow merge at path |

### Common Effect Patterns

| Pattern | Use Case |
|---------|----------|
| API GET | Fetch data from server |
| API POST | Create/update resources |
| Timer | Delayed operations |
| Storage | Persist to localStorage/DB |
| Log | Record events |
