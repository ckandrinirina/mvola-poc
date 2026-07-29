/**
 * Tests for parseMvolaStatus() — src/lib/mvola/status.ts
 *
 * The reader is the single interpretation of MVola's progress reply, shared
 * by the status-polling route and the callback route. It accepts either
 * field spelling MVola might use (`status`/`objectReference`, the verified
 * status-endpoint shape, or `transactionStatus`/`transactionReference`, the
 * shape the code previously assumed — see story 09-02's Technical Notes),
 * and it must never let an unreadable payload settle a transaction.
 */

import { parseMvolaStatus } from "../status";

describe("parseMvolaStatus — field spelling", () => {
  it("reads status/objectReference (the verified status-endpoint shape)", () => {
    const result = parseMvolaStatus({
      status: "completed",
      objectReference: "MVL-REF-1",
    });
    expect(result).toEqual({ status: "completed", reference: "MVL-REF-1" });
  });

  it("reads transactionStatus/transactionReference (the assumed callback shape)", () => {
    const result = parseMvolaStatus({
      transactionStatus: "failed",
      transactionReference: "MVL-REF-2",
    });
    expect(result).toEqual({ status: "failed", reference: "MVL-REF-2" });
  });

  it("prefers status/objectReference when both spellings are present simultaneously", () => {
    const result = parseMvolaStatus({
      status: "completed",
      objectReference: "MVL-REF-NEW",
      transactionStatus: "pending",
      transactionReference: "MVL-REF-OLD",
    });
    expect(result).toEqual({ status: "completed", reference: "MVL-REF-NEW" });
  });
});

describe("parseMvolaStatus — status normalisation", () => {
  it.each(["pending", "completed", "failed"] as const)(
    "passes through the known status %s",
    (status) => {
      expect(parseMvolaStatus({ status }).status).toBe(status);
    }
  );

  it("normalises an unrecognised status string to 'pending'", () => {
    expect(parseMvolaStatus({ status: "processing" }).status).toBe("pending");
  });

  it("normalises a missing status field to 'pending'", () => {
    expect(parseMvolaStatus({ objectReference: "MVL-REF-3" }).status).toBe(
      "pending"
    );
  });

  it("never yields a terminal state for a malformed status value", () => {
    const result = parseMvolaStatus({ status: 12345 });
    expect(result.status).toBe("pending");
  });
});

describe("parseMvolaStatus — reference normalisation", () => {
  it("normalises an empty-string reference to undefined", () => {
    const result = parseMvolaStatus({ status: "completed", objectReference: "" });
    expect(result.reference).toBeUndefined();
  });

  it("omits the reference entirely when absent", () => {
    const result = parseMvolaStatus({ status: "pending" });
    expect(result.reference).toBeUndefined();
  });
});

describe("parseMvolaStatus — malformed payload shapes", () => {
  it("does not throw and yields 'pending' for null", () => {
    expect(() => parseMvolaStatus(null)).not.toThrow();
    expect(parseMvolaStatus(null)).toEqual({ status: "pending", reference: undefined });
  });

  it("does not throw and yields 'pending' for undefined", () => {
    expect(() => parseMvolaStatus(undefined)).not.toThrow();
    expect(parseMvolaStatus(undefined)).toEqual({ status: "pending", reference: undefined });
  });

  it("does not throw and yields 'pending' for a string payload", () => {
    expect(() => parseMvolaStatus("completed")).not.toThrow();
    expect(parseMvolaStatus("completed")).toEqual({ status: "pending", reference: undefined });
  });

  it("does not throw and yields 'pending' for an array payload", () => {
    expect(() => parseMvolaStatus(["completed", "MVL-REF-4"])).not.toThrow();
    expect(parseMvolaStatus(["completed", "MVL-REF-4"])).toEqual({
      status: "pending",
      reference: undefined,
    });
  });

  it("does not throw and yields 'pending' for a number payload", () => {
    expect(() => parseMvolaStatus(42)).not.toThrow();
    expect(parseMvolaStatus(42)).toEqual({ status: "pending", reference: undefined });
  });
});
