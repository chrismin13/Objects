declare global {
  namespace Cloudflare {
    interface Env {
      WORKOS_API_KEY: string;
      WORKOS_COOKIE_PASSWORD: string;
    }
  }

  interface Env {
    WORKOS_API_KEY: string;
    WORKOS_COOKIE_PASSWORD: string;
  }
}

export {};
