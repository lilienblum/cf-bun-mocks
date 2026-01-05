/// <reference types="@cloudflare/workers-types" />
import { beforeEach, afterEach, mock } from "bun:test";

export function useEnv<TEnv extends Cloudflare.Env = Cloudflare.Env>(
  setup: () => Bun.MaybePromise<TEnv>
) {
  beforeEach(async () => {
    const env = await setup();
    mock.module("cloudflare:env", () => env);
  });

  afterEach(() => {
    mock.module("cloudflare:env", () => {});
  });
}
