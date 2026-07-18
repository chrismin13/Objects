import { useEffect, useRef, useState } from "preact/hooks";

// These are pinned upstream bundles documented in client/vendor/README.md.
import { webAwesomeReady } from "./vendor/webawesome/loader";
import { webAwesomeTheme } from "./vendor/webawesome/theme";
import { sortableReady } from "./vendor/sortablejs/loader";
import { makeRepeatRule } from "./app/actions";
import { runDomainTests } from "./app/domain-tests";

type DialogElement = HTMLElement & { open: boolean; show(): void; hide(): void };
type DrawerElement = HTMLElement & { open: boolean; show(): void; hide(): void };

const WaDialog = "wa-dialog" as never;
const WaDrawer = "wa-drawer" as never;
const WaDropdown = "wa-dropdown" as never;
const WaDropdownItem = "wa-dropdown-item" as never;

export function isUiHarnessLocation(): boolean {
  if (typeof window === "undefined") return false;
  const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  return local && new URLSearchParams(window.location.search).get("ui_harness") === "1";
}

export function UiHarness() {
  const dialog = useRef<DialogElement | null>(null);
  const drawer = useRef<DrawerElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);
  const [order, setOrder] = useState(["Inbox", "Today", "Upcoming"]);
  const repeatProof = makeRepeatRule().frequency;
  const domainTests = runDomainTests();

  useEffect(() => {
    void webAwesomeReady;
    if (!list.current) return;
    let sortable: { destroy(): void } | null = null;
    void sortableReady.then((Sortable) => { if (!list.current) return; sortable = Sortable.create(list.current, {
      animation: 150,
      handle: "[data-handle]",
      onEnd: (event: { oldIndex?: number; newIndex?: number }) => {
        if (event.oldIndex == null || event.newIndex == null) return;
        setOrder((current) => {
          const next = [...current];
          const [moved] = next.splice(event.oldIndex!, 1);
          next.splice(event.newIndex!, 0, moved);
          return next;
        });
      }
    }); });
    return () => sortable?.destroy();
  }, []);

  return (
    <main class="ui-harness">
      <style>{`${webAwesomeTheme}.ui-harness{min-height:100dvh;padding:32px;background:#f7f7f5;color:#272725;font:14px -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}.ui-harness section{max-width:680px;margin:0 auto 28px;padding:22px;border:1px solid #ddd;border-radius:14px;background:white}.ui-harness .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.ui-harness button{min-height:36px;padding:7px 13px;border:1px solid #ccc;border-radius:8px;background:white}.ui-harness ul{padding:0;list-style:none}.ui-harness li{display:flex;gap:10px;padding:10px;border-bottom:1px solid #eee}.ui-harness [data-handle]{cursor:grab;color:#888}`}</style>
      <section>
        <h1>Vendored UI harness</h1>
        <p>This route proves library registration, overlays, controls, and drag ordering without changing the Objects interface.</p>
        <span hidden data-domain-proof={repeatProof} />
        <div class="row">
          <button type="button" onClick={() => dialog.current?.show()}>Open dialog</button>
          <button type="button" onClick={() => drawer.current?.show()}>Open drawer</button>
          <WaDropdown>
            <button slot="trigger" type="button">Open menu</button>
            <WaDropdownItem value="today">Today</WaDropdownItem>
            <WaDropdownItem value="someday">Someday</WaDropdownItem>
          </WaDropdown>
        </div>
      </section>
      <section>
        <h2>Sortable list</h2>
        <ul ref={list}>{order.map((item) => <li key={item} data-id={item}><span data-handle aria-label={`Move ${item}`}>⠿</span>{item}</li>)}</ul>
      </section>
      <section aria-label="Domain tests">
        <h2>Typed domain checks</h2>
        <p>{domainTests.filter((test) => test.passed).length} of {domainTests.length} passing</p>
        <ul>{domainTests.map((test) => <li key={test.name}><strong>{test.passed ? "Pass" : "Fail"}</strong> {test.name}{test.detail ? `: ${test.detail}` : ""}</li>)}</ul>
      </section>
      <WaDialog ref={dialog} label="Library dialog">
        <p>Focus, Escape handling, backdrop dismissal, and focus return belong to Web Awesome.</p>
        <button slot="footer" type="button" onClick={() => dialog.current?.hide()}>Done</button>
      </WaDialog>
      <WaDrawer ref={drawer} label="Library drawer" placement="start">
        <p>The mobile navigation will use this behavior after parity styling.</p>
        <button slot="footer" type="button" onClick={() => drawer.current?.hide()}>Close</button>
      </WaDrawer>
    </main>
  );
}
