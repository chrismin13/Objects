import type { ComponentType, RefObject } from "preact";
type WaComponent = ComponentType<Record<string, unknown>>;
import { useEffect } from "preact/hooks";
import { placeToastLayer, raiseToastLayer } from "../toast-layer";

export type OverlayElement = HTMLElement & { open: boolean; show(): void; hide(): void };
export type ValueElement = HTMLElement & { value: string | string[] | null; checked: boolean };

export const WaButton = "wa-button" as unknown as WaComponent;
export const WaButtonGroup = "wa-button-group" as unknown as WaComponent;
export const WaCheckbox = "wa-checkbox" as unknown as WaComponent;
export const WaDetails = "wa-details" as unknown as WaComponent;
export const WaDialog = "wa-dialog" as unknown as WaComponent;
export const WaDivider = "wa-divider" as unknown as WaComponent;
export const WaDrawer = "wa-drawer" as unknown as WaComponent;
export const WaDropdown = "wa-dropdown" as unknown as WaComponent;
export const WaDropdownItem = "wa-dropdown-item" as unknown as WaComponent;
export const WaOption = "wa-option" as unknown as WaComponent;
export const WaProgressRing = "wa-progress-ring" as unknown as WaComponent;
export const WaSelect = "wa-select" as unknown as WaComponent;
export const WaSwitch = "wa-switch" as unknown as WaComponent;
export const WaTab = "wa-tab" as unknown as WaComponent;
export const WaTabGroup = "wa-tab-group" as unknown as WaComponent;
export const WaTabPanel = "wa-tab-panel" as unknown as WaComponent;
export const WaTag = "wa-tag" as unknown as WaComponent;
export const WaTooltip = "wa-tooltip" as unknown as WaComponent;

export function eventValue(event: Event): string {
  return (event.currentTarget as ValueElement).value as string;
}

export function eventChecked(event: Event): boolean {
  const source = event.composedPath()[0] as { checked?: boolean } | undefined;
  return typeof source?.checked === "boolean"
    ? source.checked
    : (event.currentTarget as ValueElement).checked;
}

export function useWebAwesomeChecked(ref: RefObject<ValueElement>, initialChecked: boolean): void {
  useEffect(() => {
    let active = true;
    const element = ref.current;
    if (!element) return;
    void customElements.whenDefined(element.localName).then(() => {
      if (active && element.isConnected) element.toggleAttribute("checked", initialChecked);
    });
    return () => {
      active = false;
    };
  }, []);
}

export function hideWebAwesomeOverlay(event: Event, onClose: () => void): void {
  const dialog = (event.currentTarget as HTMLElement).closest("wa-dialog") as OverlayElement | null;
  if (typeof dialog?.hide === "function") dialog.hide();
  else onClose();
}

export function useWebAwesomeOverlay(
  ref: RefObject<OverlayElement>,
  onClose: () => void,
  onOpen?: () => void,
): void {
  useEffect(() => {
    let active = true;
    const element = ref.current;
    if (!element) return;
    const closed = (event: Event) => {
      if (event.target !== element) return;
      const toastRegion = document.querySelector("#toast-region");
      const openDialogs = [...document.querySelectorAll("wa-dialog[open]")];
      const remainingDialog = openDialogs.findLast((dialog) => dialog !== element);
      const toastHome = document.querySelector("#toast-anchor")?.parentElement;
      const nextParent = remainingDialog || toastHome;
      if (toastRegion instanceof HTMLElement && nextParent instanceof HTMLElement) {
        placeToastLayer(toastRegion, nextParent);
        raiseToastLayer(toastRegion);
      }
      onClose();
    };
    const opened = (event: Event) => {
      if (event.target !== element) return;
      const toastRegion = document.querySelector("#toast-region");
      if (toastRegion instanceof HTMLElement && toastRegion.childElementCount) {
        placeToastLayer(toastRegion, element);
        raiseToastLayer(toastRegion);
      }
      onOpen?.();
    };
    void customElements.whenDefined(element.localName).then(() => {
      if (!active || !element.isConnected) return;
      element.addEventListener("wa-after-hide", closed);
      element.addEventListener("wa-after-show", opened, { once: true });
      element.show();
    });
    return () => {
      active = false;
      element.removeEventListener("wa-after-hide", closed);
      element.removeEventListener("wa-after-show", opened);
    };
  }, []);
}
