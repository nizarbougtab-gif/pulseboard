import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { applySecurityHeaders, enforceSameOriginApi } from "./security";

function mockResponse() {
  const headers = new Map<string, string>();
  const res = {
    headers,
    statusCode: 200,
    body: undefined as unknown,
    setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value),
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return res as unknown as Response & typeof res;
}

function mockRequest(overrides: Partial<Request> = {}) {
  return {
    path: "/api/trpc/patients.list",
    protocol: "https",
    get: (name: string) => name.toLowerCase() === "host" ? "sn.pulseboardsn.com" : undefined,
    ...overrides,
  } as Request;
}

describe("security middleware", () => {
  it("adds browser hardening headers and disables API caching", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;
    applySecurityHeaders(req, res, next);

    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(next).toHaveBeenCalledOnce();
  });

  it("allows a same-origin API request", () => {
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;
    enforceSameOriginApi(mockRequest({ get: name => name.toLowerCase() === "host" ? "sn.pulseboardsn.com" : "https://sn.pulseboardsn.com" }), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it("rejects cross-site API requests before they reach application routes", () => {
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;
    enforceSameOriginApi(mockRequest({ get: name => name.toLowerCase() === "host" ? "sn.pulseboardsn.com" : "https://evil.example" }), res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("does not impose browser-origin rules on non-API pages", () => {
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;
    enforceSameOriginApi(mockRequest({ path: "/login", get: () => "https://evil.example" }), res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
