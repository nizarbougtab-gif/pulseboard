import { describe, expect, it, vi } from "vitest";
import { createIpRateLimiter } from "./rateLimit";

function createResponse() {
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(body: unknown) {
      response.body = body;
      return response;
    },
  };
  return response;
}

describe("authentication IP rate limit", () => {
  it("allows ten auth requests and returns 429 on the eleventh", () => {
    let now = 1_000_000;
    const onLimit = vi.fn();
    const limiter = createIpRateLimiter({ onLimit, now: () => now, cleanup: false });
    const next = vi.fn();
    let lastResponse = createResponse();

    for (let request = 0; request < 10; request += 1) {
      lastResponse = createResponse();
      limiter({ ip: "203.0.113.4", socket: {} } as never, lastResponse as never, next);
    }
    expect(next).toHaveBeenCalledTimes(10);
    expect(lastResponse.headers.get("RateLimit-Remaining")).toBe("0");

    const blockedResponse = createResponse();
    limiter({ ip: "203.0.113.4", socket: {} } as never, blockedResponse as never, next);
    expect(blockedResponse.statusCode).toBe(429);
    expect(blockedResponse.body).toEqual({ error: "Trop de tentatives. Réessayez dans quelques minutes." });
    expect(blockedResponse.headers.get("Retry-After")).toBe("900");
    expect(onLimit).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(10);

    limiter({ ip: "203.0.113.4", socket: {} } as never, createResponse() as never, next);
    expect(onLimit).toHaveBeenCalledTimes(1);
  });

  it("resets after the 15-minute window and keeps separate IPs independent", () => {
    let now = 2_000_000;
    const limiter = createIpRateLimiter({ now: () => now, cleanup: false });
    const next = vi.fn();
    for (let request = 0; request < 10; request += 1) {
      limiter({ ip: "203.0.113.5", socket: {} } as never, createResponse() as never, next);
    }

    const otherIpResponse = createResponse();
    limiter({ ip: "203.0.113.6", socket: {} } as never, otherIpResponse as never, next);
    expect(otherIpResponse.statusCode).toBe(200);

    now += 15 * 60 * 1000;
    const resetResponse = createResponse();
    limiter({ ip: "203.0.113.5", socket: {} } as never, resetResponse as never, next);
    expect(resetResponse.statusCode).toBe(200);
    expect(resetResponse.headers.get("RateLimit-Remaining")).toBe("9");
  });
});
