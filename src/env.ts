/// <reference types="@cloudflare/workers-types" />
import { beforeEach, afterEach, mock } from "bun:test";

const MODULE_NAME = "cloudflare:workers";

export function useEnv<TEnv extends Cloudflare.Env = Cloudflare.Env>(
  setup: () => Bun.MaybePromise<Partial<TEnv>>
) {
  beforeEach(async () => {
    const env = await setup();
    mock.module(MODULE_NAME, () => ({ env }));
  });

  afterEach(() => {
    mock.module(MODULE_NAME, () => ({ env: {} }));
  });
}
