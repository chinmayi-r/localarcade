// ⚠ HAND-WRITTEN SECURITY-SENSITIVE CODE — not from a vetted template. Review before trusting.

import { QuickTestError } from "./types";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** M7 network boundary: browser requests may target exact loopback hosts only. */
export function resolveChatCompletionsEndpoint(rawUrl: string): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(rawUrl.trim());
  } catch {
    throw new QuickTestError("invalid-endpoint", "Enter a complete localhost URL, including http:// or https://.");
  }

  if (!LOOPBACK_HOSTS.has(endpoint.hostname.toLowerCase())) {
    throw new QuickTestError("invalid-endpoint", "Only localhost, 127.0.0.1, or ::1 endpoints are allowed.");
  }
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new QuickTestError("invalid-endpoint", "The endpoint must use HTTP or HTTPS.");
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new QuickTestError("invalid-endpoint", "Credentials, query strings, and fragments are not allowed in the endpoint URL.");
  }

  const path = endpoint.pathname.replace(/\/+$/, "");
  if (path.endsWith("/chat/completions")) {
    endpoint.pathname = path;
  } else if (!path || path === "/") {
    endpoint.pathname = "/v1/chat/completions";
  } else {
    endpoint.pathname = `${path}/chat/completions`;
  }
  return endpoint;
}
