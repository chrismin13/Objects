let initialized = false;

const navigationKeys = new Set([
  "Tab",
  "Escape",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]);

export function initializeInputModality(): void {
  if (initialized) return;
  initialized = true;

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Tab" || navigationKeys.has(event.key))
        document.documentElement.classList.add("objects-keyboard-navigation");
    },
    true,
  );
  document.addEventListener(
    "pointerdown",
    () => document.documentElement.classList.remove("objects-keyboard-navigation"),
    true,
  );
}

export function keyboardNavigationActive(): boolean {
  return document.documentElement.classList.contains("objects-keyboard-navigation");
}
