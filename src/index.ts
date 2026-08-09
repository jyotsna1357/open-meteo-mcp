#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { describeUnknownError } from "./api/errors.js";
import { log } from "./logger.js";
import { registerGetCurrent } from "./tools/get-current.js";
import { registerGetForecast } from "./tools/get-forecast.js";

const server = new McpServer({
  name: "open-meteo-weather",
  version: "1.0.0",
});

registerGetForecast(server);
registerGetCurrent(server);

async function main(): Promise<void> {
  // stdio transport: the client speaks JSON-RPC over this process's stdin and
  // stdout, which is why every log line in this server goes to stderr.
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("open-meteo-weather MCP server ready on stdio");
}

// A shutdown signal means the client is gone; close the transport so the
// process exits cleanly instead of being killed.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log.info(`received ${signal}, shutting down`);
    void server.close().finally(() => process.exit(0));
  });
}

main().catch((error: unknown) => {
  log.error(`fatal: ${describeUnknownError(error)}`);
  process.exit(1);
});
