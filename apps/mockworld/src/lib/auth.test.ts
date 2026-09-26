import { describe, expect, it } from "vitest";
import { isAuthorized, tokenFromHeaders } from "./auth";

describe("write token", () => {
  it("accepts only an exact match", () => {
    expect(isAuthorized("secret", "secret")).toBe(true);
    expect(isAuthorized("Secret", "secret")).toBe(false);
    expect(isAuthorized("secret ", "secret")).toBe(false);
  });
  it("fails closed when the server token is unset or the header is missing", () => {
    expect(isAuthorized("secret", undefined)).toBe(false);
    expect(isAuthorized("secret", "")).toBe(false);
    expect(isAuthorized(null, "secret")).toBe(false);
  });
  it("reads the contract header", () => {
    expect(tokenFromHeaders(new Headers({ "x-cortex-write-token": "abc" }))).toBe("abc");
    expect(tokenFromHeaders(new Headers())).toBeNull();
  });
});
