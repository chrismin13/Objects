/**
 * Minimal namespace-aware XML parser for CalDAV request bodies, plus
 * escaping helpers for building multistatus responses.
 *
 * iOS decorates elements with inline namespace declarations
 * (`<A:href xmlns:A="DAV:">`), so attribute-less regex parsing misses every
 * href. This parser resolves prefixes through the in-scope `xmlns`
 * declarations (including declarations on the element itself), which is the
 * only correct way to read remindd's REPORT bodies.
 */

export type XmlAttribute = {
  ns: string | null;
  local: string;
  value: string;
};

export type XmlNode = {
  ns: string | null;
  local: string;
  attributes: XmlAttribute[];
  children: XmlNode[];
  text: string;
};

const ENTITY_PATTERN = /&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;

function decodeEntities(value: string): string {
  return value.replace(ENTITY_PATTERN, (_match, entity: string) => {
    switch (entity) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default: {
        const code =
          entity.startsWith("#x") || entity.startsWith("#X")
            ? Number.parseInt(entity.slice(2), 16)
            : Number.parseInt(entity.slice(1), 10);
        return Number.isInteger(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : "";
      }
    }
  });
}

type Scope = { parent: Scope | null; prefixes: Map<string, string | null> };

function lookupPrefix(scope: Scope | null, prefix: string): string | null {
  for (let current = scope; current; current = current.parent) {
    if (current.prefixes.has(prefix)) return current.prefixes.get(prefix) ?? null;
  }
  return null;
}

function resolveName(name: string, scope: Scope): { ns: string | null; local: string } {
  const separator = name.indexOf(":");
  if (separator < 0) return { ns: lookupPrefix(scope, ""), local: name };
  return { ns: lookupPrefix(scope, name.slice(0, separator)), local: name.slice(separator + 1) };
}

/**
 * Parses one XML document into a resolved tree. Returns null for malformed
 * input rather than throwing — a bad REPORT body yields an empty result,
 * never a crash.
 */
export function parseXml(input: string): XmlNode | null {
  let index = 0;
  const rootScope: Scope = { parent: null, prefixes: new Map() };
  const stack: { scope: Scope; node: XmlNode }[] = [];
  let root: XmlNode | null = null;

  const appendText = (value: string) => {
    if (!stack.length || !value) return;
    stack[stack.length - 1].node.text += decodeEntities(value);
  };

  while (index < input.length) {
    const open = input.indexOf("<", index);
    if (open < 0) {
      appendText(input.slice(index));
      break;
    }
    appendText(input.slice(index, open));
    if (input.startsWith("<!--", open)) {
      const end = input.indexOf("-->", open);
      if (end < 0) return null;
      index = end + 3;
      continue;
    }
    if (input.startsWith("<![CDATA[", open)) {
      const end = input.indexOf("]]>", open);
      if (end < 0) return null;
      if (stack.length) stack[stack.length - 1].node.text += input.slice(open + 9, end);
      index = end + 3;
      continue;
    }
    if (input.startsWith("<?", open) || input.startsWith("<!", open)) {
      const end = input.indexOf(">", open);
      if (end < 0) return null;
      index = end + 1;
      continue;
    }
    const end = input.indexOf(">", open);
    if (end < 0) return null;
    const closing = input[open + 1] === "/";
    const selfClosing = input[end - 1] === "/";
    const raw = input.slice(open + (closing ? 2 : 1), selfClosing ? end - 1 : end).trim();
    const nameMatch = /^([^\s/>]+)/.exec(raw);
    if (!nameMatch) return null;
    const rawName = nameMatch[1];
    const rawAttrs = raw.slice(rawName.length);

    if (closing) {
      const finished = stack.pop();
      if (!finished) return null;
      const expected = resolveName(rawName, finished.scope.parent ?? rootScope);
      if (finished.node.local !== expected.local) return null;
      index = end + 1;
      continue;
    }

    const scope: Scope = {
      parent: stack.length ? stack[stack.length - 1].scope : rootScope,
      prefixes: new Map(),
    };
    const attributes: XmlAttribute[] = [];
    const attrPattern = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrPattern.exec(rawAttrs))) {
      const rawAttrName = attrMatch[1];
      const value = attrMatch[3] ?? attrMatch[4] ?? "";
      if (rawAttrName === "xmlns") scope.prefixes.set("", value);
      else if (rawAttrName.startsWith("xmlns:")) scope.prefixes.set(rawAttrName.slice(6), value);
      else {
        const resolved = resolveName(rawAttrName, scope);
        attributes.push({ ns: resolved.ns, local: resolved.local, value: decodeEntities(value) });
      }
    }

    const resolved = resolveName(rawName, scope);
    const node: XmlNode = {
      ns: resolved.ns,
      local: resolved.local,
      attributes,
      children: [],
      text: "",
    };
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else if (!root) root = node;
    else return null;
    if (!selfClosing) stack.push({ scope, node });
    index = end + 1;
  }

  if (stack.length) return null;
  return root;
}

/** Finds all descendant elements with the given DAV: local name. */
export function davDescendants(node: XmlNode | null, local: string): XmlNode[] {
  if (!node) return [];
  const found: XmlNode[] = [];
  const visit = (current: XmlNode) => {
    for (const child of current.children) {
      if (child.ns === "DAV:" && child.local === local) found.push(child);
      visit(child);
    }
  };
  visit(node);
  return found;
}

/** Finds the first child element with the given DAV: local name. */
export function davChild(node: XmlNode | null, local: string): XmlNode | null {
  if (!node) return null;
  for (const child of node.children) if (child.ns === "DAV:" && child.local === local) return child;
  return null;
}

/** True when the node is a DAV: element with the given local name. */
export function isDavElement(node: XmlNode | null, local: string): boolean {
  return Boolean(node) && node!.ns === "DAV:" && node!.local === local;
}

export function escapeXmlText(value: string): string {
  return value.replace(/[&<>]/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      default:
        return "&gt;";
    }
  });
}

export function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value).replace(/"/g, "&quot;");
}
