export { WorkspaceDO } from "./workspace-do.ts";

/**
 * Objects API Worker.
 *
 * Auth is stubbed for Phase 1–2: the owner identity comes from the
 * `x-owner` header. Phase 3 replaces this with a WorkOS sealed-cookie
 * session that yields the same opaque owner string.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/workspace" && request.method === "GET") {
      const stub = workspaceStub(request, env);
      const snapshot = await stub.load();
      return Response.json({
        ownerIdentity: ownerOf(request),
        snapshot,
        migrationReport: null,
        migrationRequired: false,
      });
    }

    if (url.pathname === "/api/workspace" && request.method === "POST") {
      const stub = workspaceStub(request, env);
      const result = await stub.save(await request.text());
      return new Response(result, { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/tasks" && request.method === "POST") {
      const stub = workspaceStub(request, env);
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

function ownerOf(request: Request): string {
  return request.headers.get("x-owner") ?? "local-dev-user";
}

function workspaceStub(request: Request, env: Env) {
  const id = env.WORKSPACE_DO.idFromName(ownerOf(request));
  return env.WORKSPACE_DO.get(id);
}
