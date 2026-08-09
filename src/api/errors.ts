/**
 * The one error type this server raises on purpose.
 *
 * `message` is written to be read by whoever asked the question, so it says
 * what went wrong and what to try next rather than naming an HTTP status. The
 * native `cause` carries the underlying failure for the stderr log.
 */
export class WeatherError extends Error {
  override readonly name = "WeatherError";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** Narrows anything thrown into a string safe to log. */
export function describeUnknownError(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause === undefined ? "" : ` (cause: ${String(error.cause)})`;
    return `${error.name}: ${error.message}${cause}`;
  }
  return String(error);
}
