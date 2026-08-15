import { useEffect, useState } from "preact/hooks";
import { WaButton } from "../../ui/webawesome";

type IntegrationToken = {
  id: string;
  label: string;
  timeZone: string;
  spaceId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

type SpaceOption = { id: string; title: string };

function defaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const FALLBACK_TIME_ZONES = [
  "UTC",
  "America/Anchorage",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/New_York",
  "America/Phoenix",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Kolkata",
  "Asia/Seoul",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Brisbane",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Rome",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];

function supportedTimeZones(): string[] {
  const detected = defaultTimeZone();
  let supported = FALLBACK_TIME_ZONES;
  try {
    supported = Intl.supportedValuesOf("timeZone");
  } catch {
    // Older browsers use the fallback list while preserving the detected zone.
  }
  return [...new Set([detected, "UTC", ...supported])].sort((left, right) =>
    left.localeCompare(right),
  );
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Safari may deny the async Clipboard API in an installed PWA. Fall
    // back to the synchronous selection path while the click gesture lives.
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      return document.execCommand("copy");
    } finally {
      textarea.remove();
    }
  }
}

function formatDate(value: string | null): string {
  if (!value) return "Never used";
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

/**
 * Settings → Integrations: CalDAV app tokens for iOS Reminders sync.
 * Talks to /api/caldav/tokens directly; the token value is shown exactly
 * once at creation (only its hash is stored).
 */
export function IntegrationsPanel({ spaces }: { spaces: SpaceOption[] }) {
  const [tokens, setTokens] = useState<IntegrationToken[] | null>(null);
  const [label, setLabel] = useState("");
  const [detectedTimeZone] = useState(defaultTimeZone);
  const [timeZone, setTimeZone] = useState(detectedTimeZone);
  const [spaceId, setSpaceId] = useState("");
  const [timeZones] = useState(supportedTimeZones);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const response = await fetch("/api/caldav/tokens");
      if (!response.ok) throw new Error();
      const body = (await response.json()) as { tokens: IntegrationToken[] };
      setTokens(body.tokens);
    } catch {
      setNotice("Tokens could not be loaded. Check your connection and retry.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/caldav/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), timeZone, spaceId: spaceId || null }),
      });
      const body = (await response.json()) as {
        token?: IntegrationToken & { token: string };
        error?: string;
      };
      if (!response.ok || !body.token) {
        setNotice(body.error ?? "The token could not be created.");
        return;
      }
      setCreatedToken(body.token.token);
      setCopied(false);
      setLabel("");
      await load();
    } catch {
      setNotice("The token could not be created. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await fetch(`/api/caldav/tokens/${id}`, { method: "DELETE" });
      await load();
    } catch {
      setNotice("The token could not be revoked. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!createdToken) return;
    const succeeded = await copyText(createdToken);
    setCopied(succeeded);
    setNotice(
      succeeded ? "Token copied to clipboard." : "Select the token text and copy it manually.",
    );
    if (succeeded) window.setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <div class="settings-panel">
      <section class="settings-card">
        <h3>iOS Reminders</h3>
        <p>
          Connect the Reminders app on iPhone or iPad over CalDAV. Each device gets its own token;
          revoking it signs that device out without touching anything else.
        </p>
        <div class="settings-native-grid">
          <label class="settings-native-field full">
            Label
            <input
              value={label}
              maxLength={100}
              placeholder="My iPhone"
              onInput={(event) => setLabel(event.currentTarget.value)}
            />
          </label>
          <label class="settings-native-field full">
            Time zone
            <select value={timeZone} onChange={(event) => setTimeZone(event.currentTarget.value)}>
              {timeZones.map((zone) => (
                <option value={zone} key={zone}>
                  {zone === detectedTimeZone ? `${zone} (current)` : zone}
                </option>
              ))}
            </select>
          </label>
          <label class="settings-native-field full">
            Spaces
            <select value={spaceId} onChange={(event) => setSpaceId(event.currentTarget.value)}>
              <option value="">All Spaces</option>
              {spaces.map((space) => (
                <option value={space.id} key={space.id}>
                  {space.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div class="settings-inline-actions">
          <WaButton
            size="s"
            variant="brand"
            disabled={busy || !label.trim()}
            onClick={() => void create()}
          >
            Create token
          </WaButton>
        </div>
        {notice && <p class="settings-empty">{notice}</p>}
        {createdToken && (
          <div class="settings-token-reveal">
            <p class="settings-empty">
              Copy this token now — it is shown only once. Username can be anything.
            </p>
            <div class="settings-token-row">
              <input
                readOnly
                value={createdToken}
                onFocus={(event) => event.currentTarget.select()}
              />
              <WaButton
                size="s"
                appearance="outlined"
                disabled={copied}
                onClick={() => void copy()}
              >
                {copied ? "Copied" : "Copy"}
              </WaButton>
            </div>
            <p class="settings-empty">
              On the phone: Settings → Apps → Reminders → Add Account → Other → Add CalDAV Account.
              Server <code>objects.chrismin13.com</code>, username anything, password the token.
            </p>
          </div>
        )}
        <div class="settings-token-list">
          {tokens === null ? (
            <p class="settings-empty">Loading tokens…</p>
          ) : tokens.length === 0 ? (
            <p class="settings-empty">No tokens yet. Create one to connect a device.</p>
          ) : (
            tokens.map((token) => (
              <div class="settings-token-entry" key={token.id}>
                <div class="settings-control-copy">
                  <strong>{token.label}</strong>
                  <small>
                    Created {formatDate(token.createdAt)} · {formatDate(token.lastUsedAt)} ·{" "}
                    {token.timeZone} ·{" "}
                    {token.spaceId === null
                      ? "All Spaces"
                      : (spaces.find((space) => space.id === token.spaceId)?.title ??
                        "Unavailable Space")}
                  </small>
                </div>
                <WaButton
                  size="s"
                  appearance="plain"
                  variant="danger"
                  disabled={busy}
                  onClick={() => void revoke(token.id)}
                >
                  Revoke
                </WaButton>
              </div>
            ))
          )}
        </div>
      </section>
      <section class="settings-card">
        <h3>What syncs</h3>
        <div class="settings-sync-table-wrap">
          <table class="settings-sync-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Details</th>
                <th scope="col">Sync</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">To-dos</th>
                <td>Inbox, Project, and Area lists</td>
                <td class="settings-sync-status syncs">
                  <span aria-hidden="true">✓</span> Both ways
                </td>
              </tr>
              <tr>
                <th scope="row">Changes</th>
                <td>Create, edit, complete, reopen, and move</td>
                <td class="settings-sync-status syncs">
                  <span aria-hidden="true">✓</span> Both ways
                </td>
              </tr>
              <tr>
                <th scope="row">Details</th>
                <td>Titles, notes, dates, one alert, and tags</td>
                <td class="settings-sync-status syncs">
                  <span aria-hidden="true">✓</span> Both ways
                </td>
              </tr>
              <tr>
                <th scope="row">Phone deletion</th>
                <td>Moves the to-do to Trash in Objects</td>
                <td class="settings-sync-status syncs">
                  <span aria-hidden="true">✓</span> To Objects
                </td>
              </tr>
              <tr>
                <th scope="row">Lists</th>
                <td>Created, renamed, and deleted in Objects only</td>
                <td class="settings-sync-status does-not-sync">
                  <span aria-hidden="true">×</span> No
                </td>
              </tr>
              <tr>
                <th scope="row">Other details</th>
                <td>
                  Repeat rules, Deadlines, checklists, This Evening, priorities, and location alerts
                </td>
                <td class="settings-sync-status does-not-sync">
                  <span aria-hidden="true">×</span> No
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
