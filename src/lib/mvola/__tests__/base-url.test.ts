/**
 * Tests for src/lib/mvola/base-url.ts — MVola Base URL Resolver
 *
 * Architecture rule R2: exactly one place resolves the MVola base URL from
 * MVOLA_ENV. Covers:
 * - "production" -> https://api.mvola.mg
 * - "sandbox" and any other unexpected value -> https://devapi.mvola.mg
 * - unset / empty MVOLA_ENV -> https://devapi.mvola.mg (default-to-sandbox)
 * - guard against the duplication in auth.ts coming back
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("base-url.ts — getBaseUrl()", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns the production host when MVOLA_ENV="production"', async () => {
    process.env.MVOLA_ENV = "production";
    const { getBaseUrl } = await import("../base-url");
    expect(getBaseUrl()).toBe("https://api.mvola.mg");
  });

  it('returns the sandbox host when MVOLA_ENV="sandbox"', async () => {
    process.env.MVOLA_ENV = "sandbox";
    const { getBaseUrl } = await import("../base-url");
    expect(getBaseUrl()).toBe("https://devapi.mvola.mg");
  });

  it("returns the sandbox host when MVOLA_ENV is unset", async () => {
    delete process.env.MVOLA_ENV;
    const { getBaseUrl } = await import("../base-url");
    expect(getBaseUrl()).toBe("https://devapi.mvola.mg");
  });

  it("returns the sandbox host when MVOLA_ENV is an empty string", async () => {
    process.env.MVOLA_ENV = "";
    const { getBaseUrl } = await import("../base-url");
    expect(getBaseUrl()).toBe("https://devapi.mvola.mg");
  });

  it("returns the sandbox host for an unexpected MVOLA_ENV value", async () => {
    process.env.MVOLA_ENV = "staging";
    const { getBaseUrl } = await import("../base-url");
    expect(getBaseUrl()).toBe("https://devapi.mvola.mg");
  });

  describe("no duplicated MVOLA_ENV base-URL resolution elsewhere", () => {
    it("auth.ts does not compute its own base URL from MVOLA_ENV", () => {
      const source = readFileSync(
        join(__dirname, "..", "auth.ts"),
        "utf8"
      );
      expect(source).not.toContain("process.env.MVOLA_ENV");
      expect(source).toContain('from "./base-url"');
    });

    it("client.ts does not compute its own base URL from MVOLA_ENV", () => {
      const source = readFileSync(
        join(__dirname, "..", "client.ts"),
        "utf8"
      );
      expect(source).not.toContain("process.env.MVOLA_ENV");
      expect(source).toContain('from "./base-url"');
    });
  });
});
