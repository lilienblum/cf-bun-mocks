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

Use `initD1` to create an in-memory database and run your migrations:

```typescript
import { initD1 } from "cf-bun-mocks";

const db = await initD1("./migrations");
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

## Environment Mock

Use `useEnv` to mock `cloudflare:env` imports in your tests:

```typescript
import { describe, test, expect } from "bun:test";
import { useEnv, D1Mock } from "cf-bun-mocks";
import type { Env } from "./worker";

describe("my worker", () => {
  useEnv<Env>(async () => ({
    DB: new D1Mock(":memory:"),
    MY_SECRET: "test-secret",
  }));

  test("uses mocked env", async () => {
    // Your worker code that imports from "cloudflare:env" will get the mock
    const { myFunction } = await import("./worker");
    const result = await myFunction();
    expect(result).toBeDefined();
  });
});
```

## API

### `D1Mock`

Implements the full `D1Database` interface from `@cloudflare/workers-types`:

- `prepare(query: string)` - Create a prepared statement
- `batch(statements: D1PreparedStatement[])` - Execute multiple statements
- `exec(query: string)` - Execute raw SQL
- `dump()` - Serialize the database to an ArrayBuffer
- `withSession(constraint?)` - Get a session (bookmark tracking is stubbed)

### `initD1(migrationsPath: string)`

Creates an in-memory D1Mock and runs all `.sql` files from the specified directory.

### `useEnv<TEnv>(setup: () => TEnv | Promise<TEnv>)`

Registers `beforeEach`/`afterEach` hooks to mock `cloudflare:env` for each test. Call at the top of your `describe` block.

## Requirements

- Bun v1.0+
- TypeScript 5+

## License

MIT
