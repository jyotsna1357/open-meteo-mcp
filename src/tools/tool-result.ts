import { WeatherError, describeUnknownError } from "../api/errors.js";
import { log } from "../logger.js";

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
}

export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/**
 * Runs a tool body and guarantees a non-empty result.
 *
 * A tool that throws or returns nothing leaves the caller with no idea what
 * happened, so every failure is turned into readable text with `isError` set:
 * `WeatherError` messages are already written for a human, and anything else is
 * a bug in this server — logged in full to stderr, reported briefly to the user.
 */
export async function runTool(toolName: string, body: () => Promise<string>): Promise<ToolResult> {
  try {
    const text = await body();
    return text.trim().length > 0
      ? textResult(text)
      : errorResult(`${toolName} produced no output. This is a bug in the weather server.`);
  } catch (error) {
    if (error instanceof WeatherError) {
      log.error(`${toolName}: ${describeUnknownError(error)}`);
      return errorResult(error.message);
    }

    log.error(`${toolName}: unhandled error — ${describeUnknownError(error)}`);
    return errorResult(
      `${toolName} failed unexpectedly: ${describeUnknownError(error)}. This is a bug in the weather server.`,
    );
  }
}
