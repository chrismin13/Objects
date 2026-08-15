/**
 * CalDAV protocol handling: a pure function from (request, state) to
 * (response, effects). The Durable Object supplies state (snapshot, anchors,
 * tombstones) and persists effects; this module never touches storage.
 *
 * Protocol rules here follow the on-device validated list in the spec §8:
 * 207-direct well-known, VTODO-only component sets, PROPPATCH 207 no-op,
 * strong ETags everywhere (PUT returns the new one), GET is a live fetch
 * path, calendar-query never filters out dateless VTODOs, and sync-collection
 * carries RFC 6578 tombstones (never on an initial sync).
 */

import type { ToDo, WorkspaceDocument } from "../model.ts";
import type { WorkspaceSyncSnapshot } from "../sync.ts";
import {
  calDavList,
  calDavLists,
  changesForInboundPut,
  listNameForToDo,
  renderToDoResource,
  stampFor,
  toDosInList,
  type CalDavAnchor,
  type CalDavList,
  type CalDavTombstone,
} from "./adapter.ts";
import { resolveInboundChanges } from "./apply.ts";
import { parseVTodo, type ParsedVTodo } from "./ics.ts";
import { davDescendants, escapeXmlText, parseXml, type XmlNode } from "./xml.ts";

const XML_DECL = '<?xml version="1.0" encoding="utf-8"?>';
const NAMESPACES =
  'xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/" xmlns:CS="http://calendarserver.org/ns/"';

const TOMBSTONE_REVISION_WINDOW = 1000;
const TOMBSTONE_LIMIT = 500;

export type CalDavHttpRequest = {
  method: string;
  path: string;
  depth: string | null;
  ifMatch: string | null;
  ifNoneMatch: string | null;
  destination: string | null;
  body: string | null;
  /** SHA-256 hex of the request body — PUT idempotency receipts. */
  bodyHash: string;
  /** The DO found an existing receipt for this PUT's mutation identity. */
  putReplay: boolean;
};

export type CalDavHandlerState = {
  userId: string;
  snapshot: WorkspaceSyncSnapshot;
  anchors: CalDavAnchor[];
  tombstones: CalDavTombstone[];
};

export type CalDavEffectChange = {
  mutationId: string;
  /** The post-change document the handler resolved; persisted verbatim. */
  document: WorkspaceDocument;
};

export type CalDavEffects = {
  anchorUpserts: CalDavAnchor[];
  anchorDeletes: string[];
  tombstoneUpserts: CalDavTombstone[];
  tombstoneDeletes: string[];
  changes: CalDavEffectChange[];
};

export type CalDavResponse = {
  status: number;
  headers: Record<string, string>;
  body: string | null;
};

export type CalDavDeps = {
  now: string;
  baseUrl: string;
  createResourceId: () => string;
  createId: (kind: string) => string;
};

export type CalDavHandlerResult = CalDavResponse & { effects: CalDavEffects };

type Effects = {
  anchors: Map<string, CalDavAnchor>;
  anchorDeletes: Set<string>;
  tombstones: Map<string, CalDavTombstone>;
  tombstoneDeletes: Set<string>;
  changes: CalDavEffectChange[];
};

function emptyEffects(): Effects {
  return {
    anchors: new Map(),
    anchorDeletes: new Set(),
    tombstones: new Map(),
    tombstoneDeletes: new Set(),
    changes: [],
  };
}

function flushEffects(effects: Effects): CalDavEffects {
  return {
    anchorUpserts: [...effects.anchors.values()],
    anchorDeletes: [...effects.anchorDeletes],
    tombstoneUpserts: [...effects.tombstones.values()],
    tombstoneDeletes: [...effects.tombstoneDeletes],
    changes: effects.changes,
  };
}

type PathParts =
  | { kind: "wellKnown" }
  | { kind: "principal"; userId: string }
  | { kind: "home"; userId: string }
  | { kind: "list"; userId: string; list: string }
  | { kind: "resource"; userId: string; list: string; resource: string }
  | { kind: "unknown" };

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function parsePath(path: string): PathParts {
  const segments = path.split("/").filter(Boolean).map(safeDecode);
  if (segments.length === 2 && segments[0] === ".well-known" && segments[1] === "caldav")
    return { kind: "wellKnown" };
  if (segments.length === 2 && segments[0] === "principals")
    return { kind: "principal", userId: segments[1] };
  if (segments[0] !== "dav") return { kind: "unknown" };
  if (segments.length === 2) return { kind: "home", userId: segments[1] };
  if (segments.length === 3) return { kind: "list", userId: segments[1], list: segments[2] };
  if (segments.length === 4)
    return { kind: "resource", userId: segments[1], list: segments[2], resource: segments[3] };
  return { kind: "unknown" };
}

const STATUS_LINE: Record<number, string> = {
  200: "HTTP/1.1 200 OK",
  404: "HTTP/1.1 404 Not Found",
};

type PropNs = "DAV:" | "CALDAV" | "APPLE" | "CS";

type ResponseProp = { local: string; ns: PropNs; xml: string };

function propPrefix(ns: PropNs): string {
  switch (ns) {
    case "DAV:":
      return "D";
    case "CALDAV":
      return "C";
    case "APPLE":
      return "A";
    default:
      return "CS";
  }
}

function prop(ns: PropNs, local: string, inner: string): ResponseProp {
  const prefix = propPrefix(ns);
  return { local, ns, xml: `<${prefix}:${local}>${inner}</${prefix}:${local}>` };
}

function emptyProp(ns: PropNs, local: string): ResponseProp {
  return { local, ns, xml: `<${propPrefix(ns)}:${local}/>` };
}

function principalHref(userId: string): string {
  return `/principals/${encodeURIComponent(userId)}/`;
}

function collectionProps(list: CalDavList, revision: number, syncToken: string): ResponseProp[] {
  return [
    { local: "resourcetype", ns: "DAV:", xml: "<D:resourcetype><D:collection/></D:resourcetype>" },
    prop("DAV:", "displayname", escapeXmlText(list.displayName)),
    prop("APPLE", "calendar-color", escapeXmlText(list.color)),
    {
      local: "supported-calendar-component-set",
      ns: "CALDAV",
      xml: '<C:supported-calendar-component-set><C:comp name="VTODO"/></C:supported-calendar-component-set>',
    },
    prop("CS", "getctag", String(revision)),
    prop("DAV:", "sync-token", escapeXmlText(syncToken)),
  ];
}

function principalProps(userId: string, displayName: string): ResponseProp[] {
  return [
    {
      local: "resourcetype",
      ns: "DAV:",
      xml: "<D:resourcetype><D:principal/><D:collection/></D:resourcetype>",
    },
    prop("DAV:", "displayname", escapeXmlText(displayName)),
    prop("CALDAV", "calendar-home-set", `<D:href>${homeHref(userId)}</D:href>`),
    prop("DAV:", "current-user-principal", `<D:href>${principalHref(userId)}</D:href>`),
  ];
}

function homeHref(userId: string): string {
  return `/dav/${encodeURIComponent(userId)}/`;
}

function memberProps(etag: string, body: string | null): ResponseProp[] {
  const props: ResponseProp[] = [
    prop("DAV:", "getetag", etag),
    prop("DAV:", "getcontenttype", "text/calendar; charset=utf-8"),
    { local: "resourcetype", ns: "DAV:", xml: "<D:resourcetype/>" },
  ];
  if (body !== null) props.push(prop("CALDAV", "calendar-data", escapeXmlText(body)));
  return props;
}

function responseElement(
  href: string,
  props: ResponseProp[],
  requested: Set<string> | null,
): string {
  if (requested === null)
    return `<D:response><D:href>${escapeXmlText(href)}</D:href><D:propstat><D:prop>${props
      .map((item) => item.xml)
      .join("")}</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`;
  const found = props.filter((item) => requested.has(item.local));
  const missing = [...requested].filter((local) => !props.some((item) => item.local === local));
  const parts = [`<D:response><D:href>${escapeXmlText(href)}</D:href>`];
  if (found.length)
    parts.push(
      `<D:propstat><D:prop>${found.map((item) => item.xml).join("")}</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat>`,
    );
  if (missing.length)
    parts.push(
      `<D:propstat><D:prop>${missing.map((local) => `<D:${local}/>`).join("")}</D:prop><D:status>HTTP/1.1 404 Not Found</D:status></D:propstat>`,
    );
  parts.push("</D:response>");
  return parts.join("");
}

function statusResponse(href: string, status: number): string {
  return `<D:response><D:href>${escapeXmlText(href)}</D:href><D:status>${STATUS_LINE[status] ?? STATUS_LINE[404]}</D:status></D:response>`;
}

function multiStatus(responses: string[], syncToken?: string): CalDavResponse {
  const token =
    syncToken === undefined ? "" : `<D:sync-token>${escapeXmlText(syncToken)}</D:sync-token>`;
  return {
    status: 207,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
    body: `${XML_DECL}<D:multistatus ${NAMESPACES}>${responses.join("")}${token}</D:multistatus>`,
  };
}

/** The main entry point used by the Durable Object. */
export function handleCalDavRequest(
  request: CalDavHttpRequest,
  state: CalDavHandlerState,
  deps: CalDavDeps,
): CalDavHandlerResult {
  const method = request.method.toUpperCase();
  const parts = parsePath(request.path);
  const revision = state.snapshot.revision;
  const syncToken = `${deps.baseUrl}/dav/sync/${revision}`;
  const effects = emptyEffects();

  if (method === "OPTIONS")
    return {
      status: 200,
      headers: {
        DAV: "1, 2, calendar-access",
        Allow: "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, PROPPATCH, REPORT, MKCALENDAR",
      },
      body: null,
      effects: flushEffects(effects),
    };

  if (parts.kind === "unknown" || method === "MKCALENDAR")
    return plain(method === "MKCALENDAR" ? 501 : 404, flushEffects(effects));

  if (parts.kind === "wellKnown") {
    if (method !== "PROPFIND") return methodNotAllowed(flushEffects(effects));
    return {
      ...multiStatus([
        responseElement(
          "/.well-known/caldav",
          [
            prop(
              "DAV:",
              "current-user-principal",
              `<D:href>${principalHref(state.userId)}</D:href>`,
            ),
          ],
          requestedProps(request.body),
        ),
      ]),
      effects: flushEffects(effects),
    };
  }

  if (parts.kind === "principal") {
    if (method !== "PROPFIND") return methodNotAllowed(flushEffects(effects));
    return {
      ...multiStatus([
        responseElement(
          principalHref(parts.userId),
          principalProps(parts.userId, "Objects"),
          requestedProps(request.body),
        ),
      ]),
      effects: flushEffects(effects),
    };
  }

  // Everything below /dav/* runs anchor/tombstone maintenance.
  maintainAnchors(state, effects);

  if (parts.kind === "home") {
    if (method !== "PROPFIND") return methodNotAllowed(flushEffects(effects));
    const requested = requestedProps(request.body);
    const responses = [
      responseElement(
        homeHref(parts.userId),
        [
          {
            local: "resourcetype",
            ns: "DAV:",
            xml: "<D:resourcetype><D:collection/></D:resourcetype>",
          },
          prop("DAV:", "displayname", "Objects"),
          prop("DAV:", "current-user-principal", `<D:href>${principalHref(parts.userId)}</D:href>`),
        ],
        requested,
      ),
    ];
    if ((request.depth ?? "1") !== "0") {
      const anchors = anchorMap(state, effects);
      for (const list of calDavLists(state.snapshot.document)) {
        responses.push(
          responseElement(
            listHref(parts.userId, list.name),
            collectionProps(list, revision, syncToken),
            requested,
          ),
        );
        for (const toDo of toDosInList(state.snapshot.document, list))
          serveToDo(state.snapshot.document, toDo, list.name, anchors, deps, effects);
      }
    }
    return { ...multiStatus(responses), effects: flushEffects(effects) };
  }

  if (parts.kind === "list") {
    const list = calDavList(state.snapshot.document, parts.list);
    if (!list) return plain(404, flushEffects(effects));
    const anchors = anchorMap(state, effects);

    if (method === "PROPFIND") {
      const requested = requestedProps(request.body);
      const responses = [
        responseElement(
          listHref(parts.userId, list.name),
          collectionProps(list, revision, syncToken),
          requested,
        ),
      ];
      if ((request.depth ?? "1") !== "0") {
        for (const toDo of toDosInList(state.snapshot.document, list)) {
          const served = serveToDo(
            state.snapshot.document,
            toDo,
            list.name,
            anchors,
            deps,
            effects,
          );
          responses.push(
            responseElement(
              resourceHref(parts.userId, list.name, served.resource),
              memberProps(served.etag, null),
              requested,
            ),
          );
        }
      }
      return { ...multiStatus(responses), effects: flushEffects(effects) };
    }

    if (method === "PROPPATCH") {
      const requested = requestedProps(request.body);
      const acknowledged = collectionProps(list, revision, syncToken).filter(
        (item) => requested === null || requested.has(item.local),
      );
      return {
        ...multiStatus([
          responseElement(
            listHref(parts.userId, list.name),
            acknowledged.map((item) => emptyProp(item.ns, item.local)),
            null,
          ),
        ]),
        effects: flushEffects(effects),
      };
    }

    if (method === "REPORT")
      return handleReport(request, parts, list, state, deps, effects, anchors);
    return methodNotAllowed(flushEffects(effects));
  }

  const result = handleResource(request, parts, state, deps, effects);
  return { ...result, effects: flushEffects(effects) };
}

function plain(status: number, effects: CalDavEffects): CalDavHandlerResult {
  return { status, headers: {}, body: null, effects };
}

function methodNotAllowed(effects: CalDavEffects): CalDavHandlerResult {
  return {
    status: 405,
    headers: { Allow: "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, PROPPATCH, REPORT" },
    body: null,
    effects,
  };
}

function requestedProps(body: string | null): Set<string> | null {
  if (body === null) return null;
  const root = parseXml(body);
  if (!root) return null;
  const prop = davDescendants(root, "prop")[0] ?? null;
  if (!prop) return null;
  const names = prop.children.map((child) => child.local);
  return names.length ? new Set(names) : null;
}

type AnchorIndex = {
  byToDo: Map<string, CalDavAnchor>;
  byResource: Map<string, CalDavAnchor>;
};

function anchorMap(state: CalDavHandlerState, effects: Effects): AnchorIndex {
  const index: AnchorIndex = { byToDo: new Map(), byResource: new Map() };
  const add = (anchor: CalDavAnchor) => {
    index.byToDo.set(anchor.toDoId, anchor);
    index.byResource.set(anchor.resource, anchor);
  };
  for (const anchor of state.anchors) add(anchor);
  for (const anchor of effects.anchors.values()) add(anchor);
  return index;
}

/**
 * Keeps the anchor table honest: anchors for permanently deleted to-dos are
 * removed (their tombstones remain), trashed to-dos gain tombstones, and
 * restored to-dos lose theirs.
 */
function maintainAnchors(state: CalDavHandlerState, effects: Effects): void {
  const document = state.snapshot.document;
  const revision = state.snapshot.revision;
  const tombstoned = new Set(state.tombstones.map((tombstone) => tombstone.resource));
  for (const anchor of state.anchors) {
    const toDo = document.toDos.find((item) => item.id === anchor.toDoId);
    if (!toDo) {
      effects.anchorDeletes.add(anchor.resource);
      if (!tombstoned.has(anchor.resource) && !effects.tombstoneDeletes.has(anchor.resource))
        effects.tombstones.set(anchor.resource, { resource: anchor.resource, revision });
      continue;
    }
    if (toDo.trashedAt) {
      if (!tombstoned.has(anchor.resource))
        effects.tombstones.set(anchor.resource, { resource: anchor.resource, revision });
    } else if (tombstoned.has(anchor.resource)) effects.tombstoneDeletes.add(anchor.resource);
  }
}

type ServedResource = { resource: string; body: string; etag: string };

/** Renders a to-do for serving, allocating a resource on first render. */
function serveToDo(
  document: WorkspaceDocument,
  toDo: ToDo,
  listName: string,
  anchors: AnchorIndex,
  deps: CalDavDeps,
  effects: Effects,
): ServedResource {
  const stamp = stampFor(deps.now);
  const existing = anchors.byToDo.get(toDo.id) ?? null;
  const resource = existing?.resource ?? `${deps.createResourceId()}.ics`;
  const rendered = renderToDoResource(document, toDo, resource, stamp);
  const anchor: CalDavAnchor = {
    resource,
    toDoId: toDo.id,
    list: listName,
    served: rendered.served,
  };
  if (
    !existing ||
    existing.list !== listName ||
    JSON.stringify(existing.served) !== JSON.stringify(rendered.served)
  ) {
    effects.anchors.set(resource, anchor);
    anchors.byToDo.set(toDo.id, anchor);
    anchors.byResource.set(resource, anchor);
  }
  return { resource, body: rendered.body, etag: rendered.etag };
}

function listHref(userId: string, list: string): string {
  return `/dav/${encodeURIComponent(userId)}/${encodeURIComponent(list)}/`;
}

function resourceHref(userId: string, list: string, resource: string): string {
  return `/dav/${encodeURIComponent(userId)}/${encodeURIComponent(list)}/${encodeURIComponent(resource)}`;
}

function handleReport(
  request: CalDavHttpRequest,
  parts: { userId: string; list: string },
  list: CalDavList,
  state: CalDavHandlerState,
  deps: CalDavDeps,
  effects: Effects,
  anchors: AnchorIndex,
): CalDavHandlerResult {
  const document = state.snapshot.document;
  const root = request.body ? parseXml(request.body) : null;
  const report = root?.local ?? "";
  const requested = requestedReportProps(root);
  const wantBodies = requested === null || requested.has("calendar-data");

  if (report === "calendar-query") {
    const filter = root ? findFilter(root) : null;
    const responses: string[] = [];
    for (const toDo of toDosInList(document, list)) {
      const served = serveToDo(document, toDo, list.name, anchors, deps, effects);
      if (filter && !matchesFilter(filter, parseVTodo(served.body))) continue;
      responses.push(
        responseElement(
          resourceHref(parts.userId, list.name, served.resource),
          memberProps(served.etag, wantBodies ? served.body : null),
          requested,
        ),
      );
    }
    return { ...multiStatus(responses), effects: flushEffects(effects) };
  }

  if (report === "calendar-multiget") {
    const hrefs = davDescendants(root, "href").map((node) => node.text.trim());
    const responses: string[] = [];
    for (const href of hrefs) {
      const resource = safeDecode(href.split("/").filter(Boolean).at(-1) ?? "");
      const anchor = anchors.byResource.get(resource);
      const toDo = anchor
        ? (document.toDos.find((item) => item.id === anchor.toDoId) ?? null)
        : null;
      if (!anchor || !toDo || toDo.trashedAt || listNameForToDo(document, toDo) !== parts.list) {
        responses.push(statusResponse(href, 404));
        continue;
      }
      const served = serveToDo(document, toDo, list.name, anchors, deps, effects);
      responses.push(
        responseElement(
          resourceHref(parts.userId, list.name, served.resource),
          memberProps(served.etag, wantBodies ? served.body : null),
          requested,
        ),
      );
    }
    return { ...multiStatus(responses), effects: flushEffects(effects) };
  }

  if (report === "sync-collection") {
    const token = `${deps.baseUrl}/dav/sync/${state.snapshot.revision}`;
    const clientToken = davDescendants(root, "sync-token")[0]?.text.trim() ?? "";
    if (clientToken && clientToken === token)
      return { ...multiStatus([], token), effects: flushEffects(effects) };
    const responses: string[] = [];
    for (const toDo of toDosInList(document, list)) {
      const served = serveToDo(document, toDo, list.name, anchors, deps, effects);
      responses.push(
        responseElement(
          resourceHref(parts.userId, list.name, served.resource),
          memberProps(served.etag, wantBodies ? served.body : null),
          requested,
        ),
      );
    }
    // RFC 6578 §3.4: no tombstones on an initial (empty-token) sync.
    if (clientToken) {
      for (const tombstone of state.tombstones)
        responses.push(
          statusResponse(resourceHref(parts.userId, parts.list, tombstone.resource), 404),
        );
      pruneTombstones(state, effects);
    }
    return { ...multiStatus(responses, token), effects: flushEffects(effects) };
  }

  return plain(404, flushEffects(effects));
}

function requestedReportProps(root: XmlNode | null): Set<string> | null {
  if (!root) return null;
  const prop = davDescendants(root, "prop")[0] ?? null;
  if (!prop) return null;
  const names = prop.children.map((child) => child.local);
  return names.length ? new Set(names) : null;
}

function pruneTombstones(state: CalDavHandlerState, effects: Effects): void {
  const revision = state.snapshot.revision;
  const ordered = [...state.tombstones].sort((left, right) => right.revision - left.revision);
  ordered.forEach((tombstone, index) => {
    if (tombstone.revision <= revision - TOMBSTONE_REVISION_WINDOW || index >= TOMBSTONE_LIMIT)
      effects.tombstoneDeletes.add(tombstone.resource);
  });
}

function findFilter(root: XmlNode): XmlNode | null {
  for (const child of root.children) if (child.local === "filter") return child;
  return null;
}

function matchesFilter(filter: XmlNode, parsed: ParsedVTodo | null): boolean {
  const compFilters = filter.children.filter((child) => child.local === "comp-filter");
  return compFilters.every((comp) => compFilterMatches(comp, parsed));
}

function compFilterMatches(node: XmlNode, parsed: ParsedVTodo | null): boolean {
  const name = (
    node.attributes.find((attribute) => attribute.local === "name")?.value ?? ""
  ).toUpperCase();
  if (name === "VCALENDAR")
    return node.children
      .filter((child) => child.local === "comp-filter")
      .every((child) => compFilterMatches(child, parsed));
  if (name === "VTODO") {
    for (const child of node.children) {
      if (child.local === "comp-filter") {
        const nested = (
          child.attributes.find((attribute) => attribute.local === "name")?.value ?? ""
        ).toUpperCase();
        if (nested === "VALARM" && !parsed?.alarm) return false;
      }
      if (child.local === "prop-filter" && !propFilterMatches(child, parsed)) return false;
      // time-range filters are not evaluated: dateless VTODOs must stay
      // listed (RFC 4791 §9.9) and iOS filters client-side anyway.
    }
    return true;
  }
  return false;
}

function propFilterMatches(node: XmlNode, parsed: ParsedVTodo | null): boolean {
  const name = (
    node.attributes.find((attribute) => attribute.local === "name")?.value ?? ""
  ).toUpperCase();
  const value = propertyValue(parsed, name);
  if (node.children.some((child) => child.local === "not-defined")) return value === null;
  const textMatch = node.children.find((child) => child.local === "text-match");
  if (!textMatch) return value !== null;
  const negate = textMatch.attributes.some(
    (attribute) => attribute.local === "negate" && attribute.value === "yes",
  );
  const needle = textMatch.text.trim().toLowerCase();
  const haystack = String(value ?? "").toLowerCase();
  return negate ? !haystack.includes(needle) : haystack.includes(needle);
}

function propertyValue(parsed: ParsedVTodo | null, name: string): string | null {
  if (!parsed) return null;
  switch (name) {
    case "UID":
      return parsed.uid;
    case "SUMMARY":
      return parsed.summary;
    case "DESCRIPTION":
      return parsed.description;
    case "STATUS":
      return parsed.status;
    case "COMPLETED":
      return parsed.completed;
    case "PERCENT-COMPLETE":
      return parsed.percentComplete === null ? null : String(parsed.percentComplete);
    case "CATEGORIES":
      return parsed.categories.length ? parsed.categories.join(",") : null;
    case "DUE":
      return parsed.due
        ? parsed.due.time
          ? `${parsed.due.date}T${parsed.due.time}`
          : parsed.due.date
        : null;
    default:
      return null;
  }
}

function handleResource(
  request: CalDavHttpRequest,
  parts: { userId: string; list: string; resource: string },
  state: CalDavHandlerState,
  deps: CalDavDeps,
  effects: Effects,
): CalDavResponse {
  const method = request.method.toUpperCase();
  const document = state.snapshot.document;
  const anchors = anchorMap(state, effects);
  const anchor = anchors.byResource.get(parts.resource) ?? null;
  const toDo = anchor ? (document.toDos.find((item) => item.id === anchor.toDoId) ?? null) : null;
  // `anchored`: the resource's to-do exists outside Trash. `live`: it also
  // currently belongs to this list — a web-side move makes the old href a
  // vanished resource for reads and deletes.
  const anchored = toDo && !toDo.trashedAt ? toDo : null;
  const live = anchored && listNameForToDo(document, anchored) === parts.list ? anchored : null;

  if (method === "GET" || method === "HEAD") {
    if (!live || !anchor) return { status: 404, headers: {}, body: null };
    const served = serveToDo(document, live, parts.list, anchors, deps, effects);
    return {
      status: 200,
      headers: { "Content-Type": "text/calendar; charset=utf-8", ETag: served.etag },
      body: method === "GET" ? served.body : null,
    };
  }

  // A PUT may target the resource even while the to-do currently lives in
  // another list — that is exactly a phone-driven move, which the merge
  // turns into a location change.
  if (method === "PUT")
    return handlePut(request, parts, state, deps, effects, anchors, anchor, anchored);

  if (method === "DELETE") {
    // Deleting an open to-do trashes it; deleting a completed or canceled
    // one is a no-op (Reminders' clear-completed). A delete aimed at the old
    // list of a just-moved resource is also a no-op.
    if (anchor && live && anchor.list === parts.list && live.outcome === "open") {
      const applied = resolveInboundChanges(
        document,
        [{ kind: "change", change: { type: "trashToDo", id: live.id } }],
        { now: () => deps.now, createId: deps.createId },
      );
      if (applied.ok)
        effects.changes.push({
          mutationId: `caldav:delete:${parts.resource}`,
          document: applied.document,
        });
    }
    return { status: 204, headers: {}, body: null };
  }

  if (method === "MOVE" && request.destination) {
    const destination = parsePath(new URL(request.destination, `${deps.baseUrl}/`).pathname);
    if (destination.kind !== "list" || !anchored || !anchor)
      return { status: 404, headers: {}, body: null };
    const target = calDavList(document, destination.list);
    if (!target) return { status: 404, headers: {}, body: null };
    // A MOVE is a re-file: apply the container change directly.
    const applied = resolveInboundChanges(
      document,
      [
        {
          kind: "change",
          change: {
            type: "updateToDo",
            id: anchored.id,
            changes: { location: locationForMove(document, target) },
          },
        },
      ],
      { now: () => deps.now, createId: deps.createId },
    );
    if (!applied.ok) return { status: 403, headers: {}, body: null };
    const nextToDo = applied.document.toDos.find((item) => item.id === anchored.id);
    if (!nextToDo) return { status: 403, headers: {}, body: null };
    const rendered = renderToDoResource(
      applied.document,
      nextToDo,
      parts.resource,
      stampFor(deps.now),
    );
    effects.changes.push({
      mutationId: `caldav:move:${parts.resource}:${state.snapshot.revision}`,
      document: applied.document,
    });
    effects.anchors.set(parts.resource, {
      resource: parts.resource,
      toDoId: anchored.id,
      list: target.name,
      served: rendered.served,
    });
    return { status: 201, headers: { ETag: rendered.etag }, body: null };
  }

  return methodNotAllowed(flushEffects(effects));
}

function locationForMove(document: WorkspaceDocument, list: CalDavList) {
  if (list.container.kind === "project")
    return { kind: "project" as const, projectId: list.container.id };
  if (list.container.kind === "area") return { kind: "area" as const, areaId: list.container.id };
  const spaceId = document.settings.defaultSpaceId;
  return spaceId ? { kind: "unfiled" as const, spaceId } : null;
}

function handlePut(
  request: CalDavHttpRequest,
  parts: { userId: string; list: string; resource: string },
  state: CalDavHandlerState,
  deps: CalDavDeps,
  effects: Effects,
  anchors: AnchorIndex,
  anchor: CalDavAnchor | null,
  live: ToDo | null,
): CalDavResponse {
  const document = state.snapshot.document;
  const list = calDavList(document, parts.list);
  if (!list) return { status: 404, headers: {}, body: null };

  const parsed = request.body ? parseVTodo(request.body) : null;
  if (!parsed) return { status: 400, headers: {}, body: null };

  // Vanished resources stay gone so the phone drops stale copies.
  if (anchor && !live) return { status: 404, headers: {}, body: null };
  // A preconditional create against an existing resource is a 412.
  if (anchor && request.ifNoneMatch === "*") return { status: 412, headers: {}, body: null };
  // An edit preconditioned on a resource that no longer exists is a 404.
  if (!anchor && request.ifMatch) return { status: 404, headers: {}, body: null };

  const mutationId = `caldav:put:${parts.resource}:${request.bodyHash}`;
  const created = !anchor;

  // Identical iOS retries replay the original result from the receipt.
  if (request.putReplay && anchor && live) {
    const served = serveToDo(document, live, parts.list, anchors, deps, effects);
    return { status: 204, headers: { ETag: served.etag }, body: null };
  }

  const { changes, served: nextServed } = changesForInboundPut(document, anchor, parsed, list);
  let etag: string;
  let toDoId: string;

  if (!changes.length) {
    if (!live) return { status: 404, headers: {}, body: null };
    const served = serveToDo(document, live, parts.list, anchors, deps, effects);
    etag = served.etag;
    toDoId = live.id;
  } else {
    const applied = resolveInboundChanges(document, changes, {
      now: () => deps.now,
      createId: deps.createId,
    });
    if (!applied.ok) return { status: 403, headers: {}, body: null };
    toDoId = applied.toDoId ?? live?.id ?? "";
    if (!toDoId) return { status: 403, headers: {}, body: null };
    const nextToDo = applied.document.toDos.find((item) => item.id === toDoId);
    if (!nextToDo) return { status: 403, headers: {}, body: null };
    etag = renderToDoResource(applied.document, nextToDo, parts.resource, stampFor(deps.now)).etag;
    effects.changes.push({ mutationId, document: applied.document });
  }

  const moved = changes.some(
    (entry) =>
      entry.change.type === "updateToDo" &&
      (entry.change.changes as Record<string, unknown> | undefined)?.location !== undefined,
  );
  const upsert: CalDavAnchor = {
    resource: parts.resource,
    toDoId,
    list: moved ? parts.list : (anchor?.list ?? parts.list),
    served: nextServed,
  };
  effects.anchors.set(parts.resource, upsert);
  anchors.byResource.set(parts.resource, upsert);
  anchors.byToDo.set(toDoId, upsert);

  return { status: created ? 201 : 204, headers: { ETag: etag }, body: null };
}
