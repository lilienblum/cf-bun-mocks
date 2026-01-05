/// <reference types="@cloudflare/workers-types" />
import { beforeEach, mock, afterAll } from "bun:test";

type WorkersModuleMock<TEnv extends Cloudflare.Env = Cloudflare.Env> = {
  env: Partial<TEnv>;
};

let moduleMock: WorkersModuleMock = { env: {} };

export async function setupWorkersMock<
  TEnv extends Cloudflare.Env = Cloudflare.Env
>(createMock?: () => Bun.MaybePromise<WorkersModuleMock<TEnv>>) {
  if (createMock) {
    moduleMock = await createMock();
  }
  mock.module("cloudflare:workers", () => moduleMock);
}

export function useWorkersEnv<TEnv extends Cloudflare.Env = Cloudflare.Env>(
  createEnv: () => Bun.MaybePromise<Partial<TEnv>>
) {
  beforeEach(async () => {
    const env = await createEnv();
    for (const key in moduleMock.env) {
      delete (moduleMock.env as any)[key];
    }
    Object.assign(moduleMock.env, env);
  });

  afterAll(() => {
    moduleMock.env = {};
  });

  return moduleMock.env;
}
