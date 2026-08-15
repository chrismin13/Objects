import {
  authorizationUrl,
  clearSessionCookieHeader,
  exchangeCodeForSession,
  readSession,
  sealSession,
  sessionCookieHeader,
  type Session,
} from "./auth.ts";
import { handleCalDavRequest, handleTokenApi, isCalDavPath } from "./caldav.ts";

export { WorkspaceDO } from "./workspace-do.ts";

/**
 * Objects API Worker.
 *
 * Auth: hosted WorkOS AuthKit. `/auth/login` redirects to AuthKit,
 * `/auth/callback` exchanges the code and seals an Objects session cookie,
 * `/auth/logout` clears it. API routes require the session; the WorkOS user
 * ID is the opaque owner key scoping every Durable Object.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CalDAV (iOS Reminders sync): Basic auth with app tokens, answered by
    // the owner's Workspace Durable Object (ADR 0001/0002/0004).
    if (isCalDavPath(url.pathname)) return handleCalDavRequest(request, env);

    if (url.pathname.startsWith("/api/caldav/tokens")) {
      const session = await requireSession(request, env);
      if (session instanceof Response) return session;
      return handleTokenApi(request, env, session, url);
    }

    if (url.pathname === "/auth/login" && request.method === "GET") {
      return Response.redirect(authorizationUrl(env, callbackUrl(url)), 302);
    }

    if (url.pathname === "/auth/callback" && request.method === "GET") {
      const code = url.searchParams.get("code");
      if (!code)
        return Response.json({ ok: false, error: "Missing authorization code." }, { status: 400 });
      const exchanged = await exchangeCodeForSession(env, code);
      if ("error" in exchanged)
        return Response.json({ ok: false, error: exchanged.error }, { status: 502 });
      const sealed = await sealSession(env, exchanged.session);
      return new Response(null, {
        status: 302,
        headers: { Location: "/", "Set-Cookie": sessionCookieHeader(sealed) },
      });
    }

    if (url.pathname === "/auth/logout") {
      return new Response(null, {
        status: 302,
        headers: { Location: "/", "Set-Cookie": clearSessionCookieHeader() },
      });
    }

    if (url.pathname === "/api/me" && request.method === "GET") {
      const session = await readSession(request, env);
      if (!session) return Response.json({ authenticated: false }, { status: 401 });
      return Response.json({ authenticated: true, user: session });
    }

    if (url.pathname === "/api/workspace" && request.method === "GET") {
      const session = await requireSession(request, env);
      if (session instanceof Response) return session;
      const stub = workspaceStub(session, env);
      const snapshot = await stub.load();
      return Response.json({
        ownerIdentity: session.userId,
        snapshot,
      });
    }

    if (url.pathname === "/api/workspace" && request.method === "POST") {
      const session = await requireSession(request, env);
      if (session instanceof Response) return session;
      const stub = workspaceStub(session, env);
      const result = await stub.save(await request.text());
      return new Response(result, { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/tasks" && request.method === "POST") {
      const session = await requireSession(request, env);
      if (session instanceof Response) return session;
      const stub = workspaceStub(session, env);
      const input = (await request.json()) as Record<string, unknown>;
      const headerIdentity = request.headers.get("idempotency-key");
      if (!input.submissionId && headerIdentity) input.submissionId = headerIdentity;
      const timeZone = input.timeZone ?? request.headers.get("x-time-zone") ?? "UTC";
      const { status, body } = await stub.capture(
        input,
        typeof timeZone === "string" ? timeZone : "UTC",
      );
      return Response.json(body, { status });
    }

    // Non-API requests delegate to the assets layer, where the
    // single-page-application fallback serves index.html for deep links.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

function callbackUrl(url: URL): string {
  return `${url.origin}/auth/callback`;
}

async function requireSession(request: Request, env: Env): Promise<Session | Response> {
  const session = await readSession(request, env);
  if (!session)
    return Response.json({ ok: false, error: "Authentication required" }, { status: 401 });
  return session;
}

function workspaceStub(session: Session, env: Env) {
  const id = env.WORKSPACE_DO.idFromName(session.userId);
  return env.WORKSPACE_DO.get(id);
}
