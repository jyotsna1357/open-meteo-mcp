import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { fetchCurrentConditions, geocodeCity } from "../api/open-meteo.js";
import { formatCurrentConditions } from "../format.js";
import { runTool } from "./tool-result.js";

const TOOL_NAME = "get_current";

const inputSchema = {
  city: z
    .string()
    .trim()
    .min(1)
    .describe(
      'The city to look up, written the way a person would say it — "Lisbon", "New York", or "Springfield, United States" when the name alone is ambiguous.',
    ),
};

export function registerGetCurrent(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Get current weather",
      description:
        "Find out what the weather is like in a city right now. Use this for questions about the present moment " +
        "— whether it is raining, how warm it is, whether someone needs a jacket before heading out. You get the " +
        "conditions, temperature and what it feels like, humidity, wind, and recent precipitation, measured at the " +
        "city's local time. If you need tomorrow or the days after, use get_forecast instead.",
      inputSchema,
    },
    async ({ city }) =>
      runTool(TOOL_NAME, async () => {
        const place = await geocodeCity(city);
        const current = await fetchCurrentConditions(place);
        return formatCurrentConditions(place, current);
      }),
  );
}
