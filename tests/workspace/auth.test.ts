import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  SESSION_COOKIE,
  exchangeCodeForSession,
  sealSession,
  type Session,
} from "../../worker/auth.ts";
import { representativeWorkspace } from "./workspace-fixtures.ts";

const session: Session = {
  userId: "user_01TEST0000000000000000000",
  email: "tester@example.com",
  firstName: "Test",
  lastName: "User",
};

async function sealedCookie(value: Session): Promise<string> {
  const sealed = await sealSession(env, value);
  return `${SESSION_COOKIE}=${encodeURIComponent(sealed)}`;
}

describe("auth routes", () => {
  it("redirects /auth/login to hosted AuthKit with the client id and callback", async () => {
    const response = await SELF.fetch("https://objects.test/auth/login", { redirect: "manual" });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location") ?? "");
    expect(location.origin).toBe("https://api.workos.com");
    expect(location.pathname).toBe("/user_management/authorize");
    expect(location.searchParams.get("client_id")).toBe(env.WORKOS_CLIENT_ID);
    expect(location.searchParams.get("redirect_uri")).toBe("https://objects.test/auth/callback");
    expect(location.searchParams.get("provider")).toBe("authkit");
  });

  it("clears the session cookie on /auth/logout", async () => {
    const response = await SELF.fetch("https://objects.test/auth/logout", { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("Set-Cookie")).toContain(`${SESSION_COOKIE}=;`);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("rejects /auth/callback without a code", async () => {
    const response = await SELF.fetch("https://objects.test/auth/callback");
    expect(response.status).toBe(400);
  });
});

describe("session-gated API", () => {
  it("returns 401 for API requests without a session", async () => {
    for (const [method, path] of [
      ["GET", "/api/workspace"],
      ["POST", "/api/workspace"],
      ["POST", "/api/tasks"],
      ["GET", "/api/me"],
    ] as const) {
      const response = await SELF.fetch(`https://objects.test${path}`, { method });
      expect(response.status, `${method} ${path}`).toBe(401);
    }
  });

  it("returns 401 for a garbage session cookie", async () => {
    const response = await SELF.fetch("https://objects.test/api/workspace", {
      headers: { Cookie: `${SESSION_COOKIE}=not-a-real-cookie` },
    });
    expect(response.status).toBe(401);
  });

  it("identifies the sealed session via /api/me", async () => {
    const response = await SELF.fetch("https://objects.test/api/me", {
      headers: { Cookie: await sealedCookie(session) },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { authenticated: boolean; user: Session };
    expect(body.authenticated).toBe(true);
    expect(body.user.userId).toBe(session.userId);
    expect(body.user.email).toBe(session.email);
  });

  it("scopes the workspace to the sealed WorkOS user id", async () => {
    const cookie = await sealedCookie({
      ...session,
      userId: `user_scope_${Math.random().toString(36).slice(2)}`,
    });
    const saved = await SELF.fetch("https://objects.test/api/workspace", {
      method: "POST",
      headers: { Cookie: cookie },
      body: JSON.stringify({
        expectedRevision: 0,
        mutationId: "auth-scope",
        document: representativeWorkspace("authscope"),
      }),
    });
    expect(saved.status).toBe(200);
    const loaded = await SELF.fetch("https://objects.test/api/workspace", {
      headers: { Cookie: cookie },
    });
    const body = (await loaded.json()) as {
      ownerIdentity: string;
      snapshot: { revision: number } | null;
    };
    expect(body.snapshot?.revision).toBe(1);
  });
});

describe("WorkOS code exchange", () => {
  beforeEach(() => {
    exchangedBody = null;
  });

  it("posts the authorization code with client credentials and maps the user", async () => {
    const stubFetcher: typeof fetch = async (input, init) => {
      exchangedBody = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<
        string,
        unknown
      >;
      const requestedUrl =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      expect(requestedUrl).toBe("https://api.workos.com/user_management/authenticate");
      return Response.json({
        user: {
          id: "user_01EXCHANGE",
          email: "exchange@example.com",
          first_name: "Ex",
          last_name: "Change",
        },
      });
    };
    const result = await exchangeCodeForSession(env, "code_123", stubFetcher);
    expect("session" in result).toBe(true);
    if ("session" in result) {
      expect(result.session.userId).toBe("user_01EXCHANGE");
      expect(result.session.email).toBe("exchange@example.com");
    }
    expect(exchangedBody?.client_id).toBe(env.WORKOS_CLIENT_ID);
    expect(exchangedBody?.client_secret).toBe(env.WORKOS_API_KEY);
    expect(exchangedBody?.grant_type).toBe("authorization_code");
    expect(exchangedBody?.code).toBe("code_123");
  });

  it("surfaces a WorkOS failure instead of signing in", async () => {
    const stubFetcher: typeof fetch = async () => new Response("invalid code", { status: 400 });
    const result = await exchangeCodeForSession(env, "bad-code", stubFetcher);
    expect("error" in result).toBe(true);
  });
});

let exchangedBody: Record<string, unknown> | null = null;
