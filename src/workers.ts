/// <reference types="@cloudflare/workers-types" />
import { beforeEach, mock, afterAll, beforeAll } from "bun:test";

type WorkersModuleMock<TEnv extends Partial<Cloudflare.Env> = Cloudflare.Env> =
  {
    env: TEnv;
  };

export function useWorkersMock<
  TEnv extends Partial<Cloudflare.Env> = Cloudflare.Env
>(createMock: () => Bun.MaybePromise<Partial<WorkersModuleMock<TEnv>>>) {
  const moduleMock: WorkersModuleMock<TEnv> = { env: {} as TEnv };

  beforeAll(() => {
    mock.module("cloudflare:workers", () => moduleMock);
  });

  beforeEach(async () => {
    const mock = await createMock();
    Object.assign(moduleMock.env, mock.env);
  });

  afterAll(() => {
    mock.restore();
  });

  return moduleMock;
}
