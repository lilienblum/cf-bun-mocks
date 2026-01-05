import { Database, type SQLQueryBindings } from "bun:sqlite";
import { readdirSync } from "node:fs";
import path from "node:path";
import type {
  D1PreparedStatement,
  D1Result,
  D1Database,
  D1DatabaseSession,
  D1SessionBookmark,
  D1SessionConstraint,
  D1ExecResult,
} from "@cloudflare/workers-types";

class D1PreparedStatementMock implements D1PreparedStatement {
  #stmt: ReturnType<Database["prepare"]>;
  #boundValues: SQLQueryBindings[] = [];

  constructor(stmt: ReturnType<Database["prepare"]>) {
    this.#stmt = stmt;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    this.#boundValues = values as SQLQueryBindings[];
    return this as D1PreparedStatement;
  }

  async first<T = Record<string, unknown>>(
    colName?: string
  ): Promise<T | null> {
    const result = this.#stmt.get(...this.#boundValues);
    if (result === null || result === undefined) {
      return null;
    }
    if (colName) {
      return (result as Record<string, unknown>)[colName] as T;
    }
    return result as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const changes = this.#stmt.run(...this.#boundValues);
    return {
      success: true,
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: changes.changes,
        last_row_id: Number(changes.lastInsertRowid),
        changed_db: changes.changes > 0,
        changes: changes.changes,
      },
      results: [] as T[],
    };
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const results = this.#stmt.all(...this.#boundValues);
    return {
      success: true,
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: results.length,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
        changes: 0,
      },
      results: results as T[],
    };
  }

  async raw<T = unknown[]>(options: {
    columnNames: true;
  }): Promise<[string[], ...T[]]>;
  async raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
  async raw<T = unknown[]>(options?: {
    columnNames?: boolean;
  }): Promise<T[] | [string[], ...T[]]> {
    const values = this.#stmt.values(...this.#boundValues);
    if (options?.columnNames) {
      return [this.#stmt.columnNames, ...(values as T[])] as [string[], ...T[]];
    }
    return values as T[];
  }
}

class D1DatabaseSessionMock implements D1DatabaseSession {
  #db: D1Mock;
  #bookmark: D1SessionBookmark | null = null;

  constructor(db: D1Mock) {
    this.#db = db;
  }

  prepare(query: string): D1PreparedStatement {
    return this.#db.prepare(query);
  }

  async batch<T = unknown>(
    statements: D1PreparedStatement[]
  ): Promise<D1Result<T>[]> {
    return this.#db.batch(statements);
  }

  getBookmark(): D1SessionBookmark | null {
    return this.#bookmark;
  }
}

export class D1Mock implements D1Database {
  db: Database;

  constructor(
    filename?: string,
    options?:
      | number
      | {
          readonly?: boolean;
          create?: boolean;
          readwrite?: boolean;
          safeIntegers?: boolean;
          strict?: boolean;
        }
  ) {
    this.db = new Database(filename, options);
  }

  prepare(query: string): D1PreparedStatement {
    const stmt = this.db.prepare(query);
    return new D1PreparedStatementMock(stmt);
  }

  async batch<T = unknown>(
    statements: D1PreparedStatement[]
  ): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    for (const stmt of statements) {
      if (stmt instanceof D1PreparedStatementMock) {
        const result = await stmt.all<T>();
        results.push(result);
      }
    }
    return results;
  }

  async exec(query: string): Promise<D1ExecResult> {
    const start = performance.now();
    try {
      const { changes: count } = this.db.run(query);
      const duration = performance.now() - start;
      return {
        count,
        duration,
      };
    } catch (error) {
      throw new Error(
        `D1Mock exec failed: ${
          error instanceof Error ? error.message : String(error)
        }\nQuery: ${query}`
      );
    }
  }

  withSession(
    _constraintOrBookmark?: D1SessionBookmark | D1SessionConstraint
  ): D1DatabaseSession {
    return new D1DatabaseSessionMock(this);
  }

  async dump(): Promise<ArrayBuffer> {
    const serialized = this.db.serialize();
    const buffer = serialized.buffer;
    if (buffer instanceof SharedArrayBuffer) {
      const newBuffer = new ArrayBuffer(buffer.byteLength);
      new Uint8Array(newBuffer).set(new Uint8Array(buffer));
      return newBuffer;
    }
    return buffer;
  }
}

export async function createD1Mock(migrationsPath: string): Promise<D1Mock> {
  const files = readdirSync(migrationsPath)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const db = new D1Mock(":memory:");
  for (const file of files) {
    const migration = await Bun.file(path.join(migrationsPath, file)).text();
    try {
      await db.exec(migration);
    } catch (error) {
      throw new Error(
        `Failed to execute migration ${file}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  return db;
}
