// Minimal MCP client that starts the server and calls both tools.
// Run `npm run build` first, then: node examples/forecast.mjs
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));

const client = new Client({ name: "forecast-example", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: "node", args: [serverPath] }));

const forecast = await client.callTool({
  name: "get_forecast",
  arguments: { city: "Lisbon", days: 3 },
});
console.log(forecast.content[0].text);

const current = await client.callTool({
  name: "get_current",
  arguments: { city: "Lisbon" },
});
console.log(`\n${current.content[0].text}`);

await client.close();
