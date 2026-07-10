const DEVELOPMENT_API_PROXY_BASE = "/_yrese-api";
const DEVELOPMENT_HTTP_LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const API_CONFIGURATION_ERROR_MESSAGE =
  "Web API endpoint configuration is unavailable.";

export interface WebApiEnvironment {
  readonly nodeEnv: string | undefined;
  readonly publicApiBase: string | undefined;
}

export class ApiTransportConfigurationError extends Error {
  constructor() {
    super(API_CONFIGURATION_ERROR_MESSAGE);
    this.name = "ApiTransportConfigurationError";
  }
}

function currentWebApiEnvironment(): WebApiEnvironment {
  return {
    nodeEnv: process.env.NODE_ENV,
    publicApiBase: process.env.NEXT_PUBLIC_API_BASE,
  };
}

function normalizeConfiguredBase(
  value: string,
  nodeEnv: string | undefined,
): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (/[?#]/u.test(trimmed)) {
    throw new ApiTransportConfigurationError();
  }

  const isRootRelative =
    trimmed.startsWith("/") && !trimmed.startsWith("//");
  if (isRootRelative) {
    if (/\\/u.test(trimmed)) {
      throw new ApiTransportConfigurationError();
    }
    return trimmed.replace(/\/+$/, "");
  }

  try {
    const url = new URL(trimmed);
    const isHttps = url.protocol === "https:";
    const isDevelopmentLoopbackHttp =
      nodeEnv === "development" &&
      url.protocol === "http:" &&
      DEVELOPMENT_HTTP_LOOPBACK_HOSTS.has(url.hostname);
    if (
      (isHttps || isDevelopmentLoopbackHttp) &&
      !trimmed.includes("@") &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.search.length === 0 &&
      url.hash.length === 0
    ) {
      return trimmed.replace(/\/+$/, "");
    }
  } catch {
    // Fall through to the fixed, value-free configuration error below.
  }

  throw new ApiTransportConfigurationError();
}

/** Resolve the public API base without exposing configuration values in errors. */
export function resolveWebApiBase(
  environment: WebApiEnvironment = currentWebApiEnvironment(),
): string {
  const configured =
    environment.publicApiBase === undefined
      ? undefined
      : normalizeConfiguredBase(environment.publicApiBase, environment.nodeEnv);
  if (configured !== undefined) {
    return configured;
  }

  if (environment.nodeEnv === "development") {
    return DEVELOPMENT_API_PROXY_BASE;
  }

  throw new ApiTransportConfigurationError();
}

export function resolveWebApiUrl(
  path: string,
  environment?: WebApiEnvironment,
): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ApiTransportConfigurationError();
  }
  return `${resolveWebApiBase(environment)}${path}`;
}
