export type ToastLayer = {
  childElementCount: number;
  matches(selector: string): boolean;
  showPopover?(): void;
  hidePopover?(): void;
};

export type ToastLayerParent = {
  append(child: ToastLayer): void;
};

function isOpen(region: ToastLayer): boolean {
  return region.matches(":popover-open");
}

export function showToastLayer(region: ToastLayer): void {
  if (!isOpen(region)) region.showPopover?.();
}

export function placeToastLayer(region: ToastLayer, parent: ToastLayerParent): void {
  parent.append(region);
}

export function raiseToastLayer(region: ToastLayer): void {
  if (!region.childElementCount) return;
  if (isOpen(region)) region.hidePopover?.();
  region.showPopover?.();
}

export function hideEmptyToastLayer(region: ToastLayer): void {
  if (!region.childElementCount && isOpen(region)) region.hidePopover?.();
}
