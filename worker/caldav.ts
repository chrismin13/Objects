/**
 * CalDAV HTTP layer: Basic auth with app tokens (ADR 0004) and routing into
 * the owner's Workspace Durable Object.
 *
 * iOS probes anonymously first, so every CalDAV path (including well-known)
 * answers 401 + `WWW-Authenticate: Basic` until credentials arrive; OPTIONS
 * answers anonymously. The Basic username is ignored. `/dav/*` and
 * `/principals/*` carry the WorkOS user id in the path, so routing is
 * `WORKSPACE_DO.idFromName(userId)` with no lookup; the userId-less
 * well-known probe resolves its owner through the singleton token index
 * stored in the `caldav-index` DO instance.
 */

import type { Session } from "./auth.ts";

const CALDAV_REALM = 'Basic realm="Objects"';
const MAX_CALDAV_BODY = 1_000_000;
const TOKEN_INDEX_NAME = "caldav-index";

export type CalDavTokenRecord = {
  id: string;
  label: string;
  timeZone: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type CalDavTokenCreated = CalDavTokenRecord & { token: string };

export function isCalDavPath(pathname: string): boolean {
  return (
    pathname === "/.well-known/caldav" ||
    pathname === "/.well-known/caldav/" ||
    pathname.startsWith("/dav/") ||
    pathname.startsWith("/principals/")
  );
}

function unauthorized(): Response {
  return new Response(null, { status: 401, headers: { "WWW-Authenticate": CALDAV_REALM } });
}

function basicCredentials(request: Request): { username: string; password: string } | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function userIdFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "principals" && segments.length >= 2) return decodeURIComponent(segments[1]);
  if (segments[0] === "dav" && segments.length >= 2) return decodeURIComponent(segments[1]);
  return null;
}

/** The full CalDAV endpoint: auth, then one round trip into the owner's DO. */
export async function handleCalDavRequest(request: Request, env: Env): Promise<Response> {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  if (method === "OPTIONS")
    return new Response(null, {
      status: 200,
      headers: {
        DAV: "1, 2, calendar-access",
        Allow: "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, PROPPATCH, REPORT, MKCALENDAR",
      },
    });

  const credentials = basicCredentials(request);
  if (!credentials || !credentials.password.startsWith("objcal_")) return unauthorized();
  const tokenHash = await sha256Hex(credentials.password);

  const pathUserId = userIdFromPath(url.pathname);
  let userId = pathUserId;
  if (!userId) {
    // The well-known probe carries no user in its path: resolve the token's
    // owner through the singleton index instance.
    const indexId = env.WORKSPACE_DO.idFromName(TOKEN_INDEX_NAME);
    userId = (await env.WORKSPACE_DO.get(indexId).caldavIndexLookup(tokenHash)) as string | null;
    if (!userId) return unauthorized();
  }
  // Requests with a userId in the path verify the token against that user's
  // DO below; a valid token for another account still yields 401 there.

  const body =
    method === "GET" || method === "HEAD" ? null : await request.text().catch(() => null);
  if (body !== null && body.length > MAX_CALDAV_BODY) return new Response(null, { status: 413 });

  const stub = env.WORKSPACE_DO.get(env.WORKSPACE_DO.idFromName(userId));
  const result = (await stub.caldav({
    method,
    path: url.pathname,
    depth: request.headers.get("Depth"),
    ifMatch: request.headers.get("If-Match"),
    ifNoneMatch: request.headers.get("If-None-Match"),
    destination: request.headers.get("Destination"),
    body,
    bodyHash: body === null ? "" : await sha256Hex(body),
    tokenHash,
    baseUrl: url.origin,
  })) as {
    status: number;
    headers: Record<string, string>;
    body: string | null;
    unauthorized?: boolean;
  };

  if (result.unauthorized) return unauthorized();
  const headers: Record<string, string> = { ...result.headers };
  if (result.body !== null) headers["Content-Length"] = String(result.body.length);
  return new Response(result.body, { status: result.status, headers });
}

function workspaceStub(env: Env, userId: string) {
  return env.WORKSPACE_DO.get(env.WORKSPACE_DO.idFromName(userId));
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const base64url = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `objcal_${base64url}`;
}

function validTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Session-gated token management for the Integrations UI. */
export async function handleTokenApi(
  request: Request,
  env: Env,
  session: Session,
  url: URL,
): Promise<Response> {
  const stub = workspaceStub(env, session.userId);
  const method = request.method.toUpperCase();
  const match = /^\/api\/caldav\/tokens(?:\/([^/]+))?$/.exec(url.pathname);

  if (method === "GET" && match?.[1] === undefined) {
    const tokens = (await stub.caldavTokens()) as CalDavTokenRecord[];
    return Response.json({ tokens });
  }

  if (method === "POST" && match?.[1] === undefined) {
    const input = (await request.json().catch(() => null)) as {
      label?: unknown;
      timeZone?: unknown;
    } | null;
    const label = typeof input?.label === "string" ? input.label.trim() : "";
    const timeZone = typeof input?.timeZone === "string" ? input.timeZone : "";
    if (!label || label.length > 100)
      return Response.json(
        { ok: false, error: "Enter a label between 1 and 100 characters." },
        { status: 400 },
      );
    if (!validTimeZone(timeZone))
      return Response.json({ ok: false, error: "Choose a valid IANA time zone." }, { status: 400 });
    const token = generateToken();
    const created = (await stub.caldavCreateToken({
      id: crypto.randomUUID(),
      label,
      timeZone,
      hash: await sha256Hex(token),
    })) as CalDavTokenRecord;
    const indexId = env.WORKSPACE_DO.idFromName(TOKEN_INDEX_NAME);
    await env.WORKSPACE_DO.get(indexId).caldavIndexSet(await sha256Hex(token), session.userId);
    return Response.json({ token: { ...created, token } }, { status: 201 });
  }

  if (method === "DELETE" && match?.[1]) {
    const hash = (await stub.caldavRevokeToken(match[1])) as string | null;
    if (hash) {
      const indexId = env.WORKSPACE_DO.idFromName(TOKEN_INDEX_NAME);
      await env.WORKSPACE_DO.get(indexId).caldavIndexDrop(hash);
    }
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Unknown token operation." }, { status: 404 });
}
