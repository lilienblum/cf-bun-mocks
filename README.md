# cf-bun-mocks

Cloudflare Workers mocks and helpers for Bun testing.

## Installation

```bash
bun add -d cf-bun-mocks
```

## D1 Mock

The D1 mock provides a drop-in replacement for Cloudflare's D1 database, backed by Bun's native SQLite.

### Basic Usage

```typescript
import { D1Mock } from "cf-bun-mocks";

// In-memory database (recommended for tests)
const db = new D1Mock(":memory:");

// Or persist to a file
const db = new D1Mock("./test.db");
```

### With Migrations

Use `createD1Mock` to create an in-memory database and run your migrations:

```typescript
import { createD1Mock } from "cf-bun-mocks";

const db = await createD1Mock("./migrations");
```

This reads all `.sql` files from the migrations directory in sorted order and executes them.

### Example Test

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { D1Mock } from "cf-bun-mocks";
import type { D1Database } from "@cloudflare/workers-types";

describe("my worker", () => {
  let db: D1Database;

  beforeEach(async () => {
    db = new D1Mock(":memory:");
    await db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE
      )
    `);
  });

  test("insert and query", async () => {
    await db
      .prepare("INSERT INTO users (name, email) VALUES (?, ?)")
      .bind("Alice", "alice@example.com")
      .run();

    const user = await db
      .prepare("SELECT * FROM users WHERE email = ?")
      .bind("alice@example.com")
      .first();

    expect(user).toEqual({
      id: 1,
      name: "Alice",
      email: "alice@example.com",
    });
  });

  test("batch operations", async () => {
    const results = await db.batch([
      db
        .prepare("INSERT INTO users (name, email) VALUES (?, ?)")
        .bind("Bob", "bob@example.com"),
      db
        .prepare("INSERT INTO users (name, email) VALUES (?, ?)")
        .bind("Carol", "carol@example.com"),
      db.prepare("SELECT * FROM users"),
    ]);

    expect(results[2].results).toHaveLength(2);
  });
});
```

### Injecting into Workers

Pass the mock as your D1 binding when testing your worker:

```typescript
import { D1Mock } from "cf-bun-mocks";
import type { Env } from "./worker";

const env: Env = {
  DB: new D1Mock(":memory:"),
};

// Test your worker with the mock env
const response = await worker.fetch(request, env);
```

## Workers Environment

For testing Cloudflare Workers, use the `useWorkersEnv` helper to create test environments:

```typescript
import { describe, test, expect } from "bun:test";
import { useWorkersEnv, D1Mock } from "cf-bun-mocks";
import type { Env } from "./worker";

describe("my worker", () => {
  const { env } = useWorkersEnv<Env>(() => ({
    DB: new D1Mock(":memory:"),
    MY_SECRET: "test-secret",
  }));

  test("uses test environment", async () => {
    // Pass the env to your worker handler
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
  });
});
```

### Module Mocking (Advanced)

For mocking `cloudflare:workers` module imports, use `setupWorkersMock` in a preload script and combine it with `useWorkersEnv`:

Create a `test-setup.ts` file:

```typescript
// test-setup.ts
import { setupWorkersMock } from "cf-bun-mocks";

// Set up module mocks before any test files load
await setupWorkersMock();
```

Then run tests with preload:

```bash
bun test --preload ./test-setup.ts
```

Or configure it in `bunfig.toml`:

```toml
[test]
preload = ["./test-setup.ts"]
```

Then use in your tests:

```typescript
import { describe, test, expect } from "bun:test";
import { useWorkersEnv, D1Mock } from "cf-bun-mocks";

describe("worker with module imports", () => {
  useWorkersEnv(() => ({
    DB: new D1Mock(":memory:"),
    API_KEY: "test-key",
  }));

  test("uses mocked module", async () => {
    // The env object reference stays the same, only properties change
    const { env } = await import("cloudflare:workers");
    expect(env.DB).toBeDefined();
    expect(env.API_KEY).toBe("test-key");
  });
});
```

> **Note**: `setupWorkersMock` uses Bun's `mock.module()` function. Module mocks must be set up before any imports happen. See [Bun's test lifecycle docs](https://bun.com/docs/test/lifecycle#global-setup-and-teardown) for preload details and [Bun's mocking docs](https://bun.sh/docs/test/mocking) for more on module mocking.

## API

### `D1Mock`

Implements the full `D1Database` interface from `@cloudflare/workers-types`:

- `prepare(query: string)` - Create a prepared statement
- `batch(statements: D1PreparedStatement[])` - Execute multiple statements
- `exec(query: string)` - Execute raw SQL (supports multiple statements)
- `dump()` - Serialize the database to an ArrayBuffer
- `withSession(constraint?)` - Get a session (bookmark tracking is stubbed)

### `createD1Mock(migrationsPath: string)`

Creates an in-memory D1Mock and runs all `.sql` migration files from the specified directory in sorted order.

### `useWorkersEnv<TEnv>(createEnv: () => Partial<TEnv> | Promise<Partial<TEnv>>)`

Updates the global workers mock environment for each test. Must be used with `setupWorkersMock()`.

### `setupWorkersMock<TEnv>(createMock?: () => WorkersModuleMock<TEnv> | Promise<WorkersModuleMock<TEnv>>)`

Sets up the `cloudflare:workers` module mock using Bun's `mock.module()`. **Must be called in a preload script before any test files load.** Use Bun's `--preload` flag or configure it in `bunfig.toml`. Call once at the start of your test suite, then use `useWorkersEnv()` to update the environment per test.

## Requirements

- Bun v1.0+
- TypeScript 5+

## License

MIT
