import { useMemo, useRef, useState } from "preact/hooks";
import { OverlayElement, useWebAwesomeOverlay, WaDialog } from "../../ui/webawesome";

export type QuickFindItem = {
  kind: string;
  title: string;
  meta: string;
  icon: string;
  [key: string]: unknown;
};

export function QuickFind({
  initialQuery,
  find,
  iconHtml,
  onChoose,
  onClose,
}: {
  initialQuery: string;
  find(query: string, everything: boolean): QuickFindItem[];
  iconHtml(name: string): string;
  onChoose(item: QuickFindItem): void;
  onClose(): void;
}) {
  const dialog = useRef<OverlayElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [everything, setEverything] = useState(false);
  const [focused, setFocused] = useState(0);
  const results = useMemo(() => find(query, everything), [query, everything]);
  const active = Math.min(focused, Math.max(0, results.length - 1));

  useWebAwesomeOverlay(dialog, onClose, () => input.current?.focus());

  const choose = (item: QuickFindItem | undefined) => {
    if (!item) return;
    if (item.kind === "continue") {
      setEverything(true);
      setFocused(0);
      return;
    }
    onChoose(item);
  };

  return <WaDialog ref={dialog} class="objects-dialog dialog-quick-find" label="Quick find" without-header light-dismiss>
    <div class="quick-find">
      <div class="modal-header">
        <span dangerouslySetInnerHTML={{ __html: iconHtml("search") }} />
        <input
          ref={input}
          class="modal-search"
          type="search"
          value={query}
          placeholder="Jump to a list or find a to-do…"
          autoComplete="off"
          aria-label="Quick find"
          onInput={(event) => { setQuery(event.currentTarget.value); setFocused(0); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setFocused(Math.min(results.length - 1, active + 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setFocused(Math.max(0, active - 1)); }
            if (event.key === "Enter") { event.preventDefault(); choose(results[active]); }
          }}
        />
        <span class="key-hint">esc</span>
      </div>
      <div class="search-results" role="listbox" aria-label="Quick Find results">
        {results.length ? results.map((item, index) => <button
          key={`${item.kind}:${String(item.id || item.type || item.title)}`}
          class={`search-result ${index === active ? "focused" : ""}`}
          type="button"
          role="option"
          aria-selected={index === active}
          onMouseEnter={() => setFocused(index)}
          onClick={() => choose(item)}
        >
          <span dangerouslySetInnerHTML={{ __html: iconHtml(item.icon) }} />
          <span class="search-result-text"><span class="search-result-title">{item.title}</span><span class="search-result-meta">{item.meta}</span></span>
          <span dangerouslySetInnerHTML={{ __html: iconHtml("chevron") }} />
        </button>) : <div class="search-empty">No matching to-dos or lists</div>}
      </div>
    </div>
  </WaDialog>;
}
