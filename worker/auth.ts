import { sealData, unsealData } from "iron-session";

/**
 * WorkOS AuthKit sign-in, with Objects-issued sessions.
 *
 * The hosted AuthKit page handles every provider (email/password, Magic
 * Auth, Google, …). After the OAuth code exchange — the only WorkOS network
 * call in the sign-in flow — the Worker seals the WorkOS user identity into
 * its own httpOnly cookie. Every subsequent request is authenticated purely
 * locally: no JWKS, no per-request WorkOS calls, and tests can mint valid
 * sessions offline with the same code path.
 */

export const SESSION_COOKIE = "objects_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type Session = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

type WorkOsUser = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

export function authorizationUrl(env: Env, redirectUri: string): string {
  const url = new URL("https://api.workos.com/user_management/authorize");
  url.searchParams.set("client_id", env.WORKOS_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("provider", "authkit");
  return url.toString();
}

export async function exchangeCodeForSession(
  env: Env,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<{ session: Session } | { error: string }> {
  const response = await fetcher("https://api.workos.com/user_management/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.WORKOS_CLIENT_ID,
      client_secret: env.WORKOS_API_KEY,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    return { error: `WorkOS sign-in failed (${response.status}): ${detail.slice(0, 200)}` };
  }
  const payload = (await response.json()) as { user?: WorkOsUser };
  if (!payload.user?.id) return { error: "WorkOS sign-in did not return a user." };
  return {
    session: {
      userId: payload.user.id,
      email: payload.user.email,
      firstName: payload.user.first_name ?? null,
      lastName: payload.user.last_name ?? null,
    },
  };
}

export async function sealSession(env: Env, session: Session): Promise<string> {
  return sealData(session, {
    password: env.WORKOS_COOKIE_PASSWORD,
    ttl: SESSION_TTL_SECONDS,
  });
}

export async function readSession(request: Request, env: Env): Promise<Session | null> {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  const cookies = Object.fromEntries(
    header.split(";").map((part) => {
      const [name, ...rest] = part.trim().split("=");
      return [name, rest.join("=")];
    }),
  );
  const sealed = cookies[SESSION_COOKIE];
  if (!sealed) return null;
  try {
    const session = await unsealData<Session>(decodeURIComponent(sealed), {
      password: env.WORKOS_COOKIE_PASSWORD,
      ttl: SESSION_TTL_SECONDS,
    });
    // Malformed or foreign seals can unseal to an empty object rather than
    // throwing; only a well-shaped session authenticates.
    return typeof session?.userId === "string" && session.userId ? session : null;
  } catch {
    return null;
  }
}

export function sessionCookieHeader(sealed: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(sealed)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
