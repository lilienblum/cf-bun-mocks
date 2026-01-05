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

For testing code that imports from `cloudflare:workers`, use `useWorkersMock()` to mock the module and set up test environments:

```typescript
import { describe, test, expect } from "bun:test";
import { useWorkersMock, D1Mock } from "cf-bun-mocks";

describe("worker with module imports", () => {
  const { env } = useWorkersMock(() => ({
    env: {
      DB: new D1Mock(":memory:"),
      API_KEY: "test-key",
    },
  }));

  test("uses mocked environment", async () => {
    const { env } = await import("cloudflare:workers");
    expect(env.DB).toBeDefined();
    expect(env.API_KEY).toBe("test-key");
  });
});
```

The mock environment is reset before each test with the values from your factory function.

### Manual Injection (Alternative)

If you're not using `cloudflare:workers` imports, you can pass the environment directly to your worker:

```typescript
import { describe, test, expect } from "bun:test";
import { D1Mock } from "cf-bun-mocks";
import type { Env } from "./worker";

describe("my worker", () => {
  test("uses test environment", async () => {
    const env: Env = {
      DB: new D1Mock(":memory:"),
      MY_SECRET: "test-secret",
    };

    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
  });
});
```

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

### `useWorkersMock<TEnv>(createMock: () => Partial<{ env: TEnv }> | Promise<Partial<{ env: TEnv }>>)`

Mocks the `cloudflare:workers` module and sets up test environments. Returns a mock object with an `env` property that gets updated before each test with values from the factory function. Uses Bun's `mock.module()` internally.

## Requirements

- Bun v1.0+
- TypeScript 5+

## License

MIT
