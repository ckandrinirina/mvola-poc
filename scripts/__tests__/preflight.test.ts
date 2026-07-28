// KNOWN BLOCKED — collected by Jest, but cannot execute without a
// jest.config.ts change that is out of this story's declared scope.
//
// This file lives under `**/__tests__/**/*.test.ts`, so Jest's current
// `testMatch` DOES discover it (verified: `npx jest --listTests` lists it).
// But `scripts/preflight.mjs` is a real ESM (.mjs) module by design (the
// story requires it run under plain Node with no new dependency), and
// jest.config.ts's `transform` only covers `.tsx?` — it has no
// `extensionsToTreatAsEsm` / `--experimental-vm-modules` ESM support. Both a
// static `import` and a dynamic `import()` of the real .mjs file were tried
// here and both fail identically:
//
//   SyntaxError: Cannot use import statement outside a module
//     at scripts/preflight.mjs:26 (import { readFileSync, existsSync } ...)
//
// Jest's module registry intercepts dynamic import() the same as static
// import when running under its default (non-ESM) runtime — there is no way
// to load the real .mjs source without either transforming it or enabling
// Jest's experimental ESM mode, both of which mean editing jest.config.ts (a
// shared file explicitly outside this story's scope: scripts/preflight.mjs,
// package.json, .env.example).
//
// The assertions below are written and ready — they cover a path-embedded
// secret, a query-embedded secret, userinfo, a malformed URL, and MSISDN
// edge cases (1-3 chars, empty) exactly as requested. They are `.skip`ped so
// this structural gap doesn't turn the suite red; un-skip once jest.config.ts
// gains .mjs/ESM support (or the script is ever ported to .ts under src/).
let maskMsisdn: (msisdn: string) => string;
let maskUrl: (rawUrl: string) => string;

beforeAll(async () => {
  const mod = await import("../preflight.mjs");
  maskMsisdn = mod.maskMsisdn;
  maskUrl = mod.maskUrl;
});

describe.skip("maskUrl", () => {
  it("never leaks a secret embedded in the path", () => {
    const out = maskUrl(
      "https://example.invalid/cb/SECRETPATH555?sig=SIGLEAK444"
    );
    expect(out).not.toContain("SECRETPATH555");
    expect(out).not.toContain("SIGLEAK444");
  });

  it("never leaks a secret embedded in the query string", () => {
    const out = maskUrl("https://example.invalid/cb?sig=SIGLEAK444");
    expect(out).not.toContain("SIGLEAK444");
  });

  it("never leaks Basic-auth userinfo (username/password)", () => {
    const out = maskUrl(
      "https://user:SECRETTOKEN333@example.invalid/cb?sig=SIGLEAK444"
    );
    expect(out).not.toContain("SECRETTOKEN333");
    expect(out).not.toContain("user:");
    expect(out).not.toContain("SIGLEAK444");
  });

  it("never echoes the raw input for a malformed URL", () => {
    const out = maskUrl("ht!tp://x:SECRETTOKEN333@@@?sig=SIGLEAK444");
    expect(out).not.toContain("SECRETTOKEN333");
    expect(out).not.toContain("SIGLEAK444");
  });

  it("prints the origin plainly and a path marker when a real path is present", () => {
    const out = maskUrl("https://tunnel.example/cb/abc123");
    expect(out).toContain("https://tunnel.example");
    expect(out).toContain("path masked");
  });

  it("prints a bare slash when there is no meaningful path", () => {
    const out = maskUrl("https://tunnel.example");
    expect(out).not.toContain("path masked");
    expect(out).toBe("https://tunnel.example/");
  });
});

describe.skip("maskMsisdn", () => {
  it("never prints the full MSISDN", () => {
    const out = maskMsisdn("0341234567");
    expect(out).not.toContain("0341234567");
    expect(out).toBe("set (…567)");
  });

  it("handles a 3-character value without leaking it", () => {
    const out = maskMsisdn("123");
    expect(out).not.toContain("123");
    expect(out).toBe("set");
  });

  it("handles a 1-character value without leaking it", () => {
    const out = maskMsisdn("1");
    expect(out).not.toContain("1");
    expect(out).toBe("set");
  });

  it("reports 'not set' for an empty value", () => {
    expect(maskMsisdn("")).toBe("not set");
  });
});
