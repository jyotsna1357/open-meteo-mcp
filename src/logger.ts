/**
 * stdout is the MCP transport — anything written there corrupts the protocol
 * stream. Every diagnostic in this server goes to stderr through these helpers,
 * and `console.log` is never used anywhere in `src/`.
 */

function write(level: "info" | "error", message: string): void {
  process.stderr.write(`[${new Date().toISOString()}] ${level.toUpperCase()} ${message}\n`);
}

export const log = {
  info: (message: string): void => write("info", message),
  error: (message: string): void => write("error", message),
};
