import type { z } from "zod";

import { log } from "../logger.js";
import { WeatherError, describeUnknownError } from "./errors.js";

/** Open-Meteo is usually sub-second; anything past this is treated as dead. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Open-Meteo reports its own errors as `200`-shaped JSON on a 4xx response,
 * e.g. `{"error": true, "reason": "Latitude must be in range of -90 to 90°"}`.
 * Surfacing `reason` gives a far better message than the status code alone.
 */
interface UpstreamErrorBody {
  reason?: unknown;
}

function extractUpstreamReason(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const reason = (body as UpstreamErrorBody).reason;
  return typeof reason === "string" && reason.length > 0 ? reason : undefined;
}

/**
 * Fetches JSON and validates it against `schema`.
 *
 * Every failure mode below becomes a `WeatherError` with a message meant for a
 * human: timeouts, network failures, non-2xx responses, unparseable bodies, and
 * responses whose shape does not match what we expect.
 */
export async function fetchJson<T>(url: URL, schema: z.ZodType<T>, label: string): Promise<T> {
  log.info(`${label}: GET ${url.pathname}${url.search}`);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
  } catch (error) {
    // AbortSignal.timeout rejects with a TimeoutError; everything else here is
    // DNS/TLS/socket trouble, which the caller can only retry.
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new WeatherError(
        `The weather service did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds. Try again in a moment.`,
        { cause: error },
      );
    }
    throw new WeatherError("Could not reach the weather service. Check the network connection and try again.", {
      cause: error,
    });
  }

  const rawBody = await response.text().catch((error: unknown) => {
    throw new WeatherError("The weather service closed the connection before sending a full response.", {
      cause: error,
    });
  });

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch (error) {
    log.error(`${label}: body was not JSON (${rawBody.slice(0, 200)})`);
    throw new WeatherError("The weather service returned a malformed response. Try again in a moment.", {
      cause: error,
    });
  }

  if (!response.ok) {
    const reason = extractUpstreamReason(parsedBody);
    log.error(`${label}: HTTP ${response.status} ${reason ?? rawBody.slice(0, 200)}`);
    throw new WeatherError(
      reason
        ? `The weather service rejected the request: ${reason}`
        : `The weather service returned an error (HTTP ${response.status}). Try again in a moment.`,
    );
  }

  const result = schema.safeParse(parsedBody);
  if (!result.success) {
    log.error(`${label}: unexpected response shape — ${describeUnknownError(result.error)}`);
    throw new WeatherError(
      "The weather service returned data in an unexpected format. This usually means the upstream API changed.",
      { cause: result.error },
    );
  }

  return result.data;
}
