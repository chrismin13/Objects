type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type PwaStatus = {
  canPromptInstall: boolean;
  installed: boolean;
  ios: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  serviceWorkerReady: boolean;
  updateAvailable: boolean;
};

let installPrompt: InstallPromptEvent | null = null;
let registration: ServiceWorkerRegistration | null = null;
let registrationPromise: Promise<ServiceWorkerRegistration | null> = Promise.resolve(null);
let initialized = false;
let reloadForUpdate = false;
let updateAvailable = false;

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalled(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function emitStatus(): void {
  window.dispatchEvent(new CustomEvent("objects:pwa-status", { detail: getPwaStatus() }));
}

function watchRegistration(next: ServiceWorkerRegistration): void {
  registration = next;
  if (next.waiting) {
    updateAvailable = true;
    emitStatus();
  }
  next.addEventListener("updatefound", () => {
    const worker = next.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        updateAvailable = true;
        emitStatus();
      }
    });
  });
}

export function initializePwa(): () => void {
  if (initialized) return () => {};
  initialized = true;

  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((item) => item.unregister()))
      );
    }
    if ("caches" in window) {
      void caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("objects-pwa-")).map((name) => caches.delete(name))));
    }
    emitStatus();
    return () => { initialized = false; };
  }

  const onInstallPrompt = (event: Event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    emitStatus();
  };
  const onInstalled = () => {
    installPrompt = null;
    emitStatus();
  };
  const onControllerChange = () => {
    if (reloadForUpdate) window.location.reload();
  };
  const checkForUpdate = () => {
    if (document.visibilityState === "visible") void registration?.update();
  };

  window.addEventListener("beforeinstallprompt", onInstallPrompt);
  window.addEventListener("appinstalled", onInstalled);
  window.addEventListener("online", emitStatus);
  window.addEventListener("offline", emitStatus);
  window.addEventListener("focus", checkForUpdate);
  document.addEventListener("visibilitychange", checkForUpdate);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    registrationPromise = navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then((next) => {
        watchRegistration(next);
        return navigator.serviceWorker.ready;
      })
      .then((ready) => {
        registration = ready;
        emitStatus();
        return ready;
      })
      .catch(() => {
        emitStatus();
        return null;
      });
  }

  emitStatus();
  return () => {
    window.removeEventListener("beforeinstallprompt", onInstallPrompt);
    window.removeEventListener("appinstalled", onInstalled);
    window.removeEventListener("online", emitStatus);
    window.removeEventListener("offline", emitStatus);
    window.removeEventListener("focus", checkForUpdate);
    document.removeEventListener("visibilitychange", checkForUpdate);
    navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
    initialized = false;
  };
}

export function getPwaStatus(): PwaStatus {
  return {
    canPromptInstall: Boolean(installPrompt),
    installed: isInstalled(),
    ios: isIos(),
    notificationPermission: "Notification" in window ? Notification.permission : "unsupported",
    serviceWorkerReady: Boolean(registration?.active),
    updateAvailable,
  };
}

export async function requestPwaInstall(): Promise<"accepted" | "dismissed" | "instructions" | "installed"> {
  if (isInstalled()) return "installed";
  if (!installPrompt) return "instructions";
  const prompt = installPrompt;
  installPrompt = null;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  emitStatus();
  return choice.outcome;
}

export async function requestNotificationAccess(): Promise<NotificationPermission | "unsupported"> {
  if (!("Notification" in window)) return "unsupported";
  const permission = await Notification.requestPermission();
  emitStatus();
  if (permission !== "granted") return permission;

  const ready = registration ?? await registrationPromise;
  if (ready?.active) {
    await ready.showNotification("Objects notifications are ready", {
      body: "Task reminders will appear here while Objects is running.",
      icon: "/favicon.svg",
      tag: "objects-notifications-ready",
      data: { url: "/" },
    });
  }
  return permission;
}

export async function showTaskReminder(task: { id: string; title: string; notes?: string }, options: { replacement?: boolean } = {}): Promise<boolean> {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  const notificationOptions: NotificationOptions = {
    body: task.notes || "Scheduled in Objects",
    icon: "/favicon.svg",
    tag: `objects-task-${task.id}`,
    data: { url: options.replacement ? `/?replacement=1&todo=${encodeURIComponent(task.id)}` : `/?task=${encodeURIComponent(task.id)}` },
    actions: [
      { action: "snooze-10", title: "Snooze 10 min" },
      { action: "snooze-30", title: "Snooze 30 min" },
      { action: "snooze-60", title: "Snooze 1 hour" },
    ],
  };

  try {
    const ready = registration ?? await registrationPromise;
    if (ready?.active) {
      await ready.showNotification(task.title, notificationOptions);
    } else {
      new Notification(task.title, notificationOptions);
    }
    return true;
  } catch {
    return false;
  }
}

export function activatePwaUpdate(): boolean {
  if (!registration?.waiting) {
    if (!updateAvailable) return false;
    window.location.reload();
    return true;
  }
  reloadForUpdate = true;
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}
