import { afterEach, expect, test, vi } from "vitest";
import { request } from "../../../src/core/http";

afterEach(() => vi.unstubAllGlobals());

test("Given a 204 response, When the client reads it, Then it returns no content without decoding JSON", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  expect(await request("/v1/example")).toBeUndefined();
});
