import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { fetchForecast, geocodeCity } from "../api/open-meteo.js";
import { formatForecast } from "../format.js";
import { runTool } from "./tool-result.js";

const TOOL_NAME = "get_forecast";

const inputSchema = {
  city: z
    .string()
    .trim()
    .min(1)
    .describe(
      'The city to look up, written the way a person would say it — "Lisbon", "New York", or "Springfield, United States" when the name alone is ambiguous.',
    ),
  days: z
    .number()
    .int()
    .min(1)
    .max(7)
    .describe(
      "How many days to forecast, counting today as day one. Open-Meteo covers up to 7 days; ask for 1 if only " +
        "today matters, 3 for a general outlook, 7 for the full range.",
    ),
};

export function registerGetForecast(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Get weather forecast",
      description:
        "Look up the daily weather forecast for a city, for anywhere from 1 to 7 days ahead. Use this when the " +
        "question is about the future — what tomorrow looks like, whether the weekend will be dry, whether to pack " +
        "for rain. You get one entry per day with the expected conditions, high and low temperature, chance and " +
        "amount of rain, and peak wind speed. For conditions at this exact moment, use get_current instead.",
      inputSchema,
    },
    async ({ city, days }) =>
      runTool(TOOL_NAME, async () => {
        const place = await geocodeCity(city);
        const forecast = await fetchForecast(place, days);
        return formatForecast(place, forecast);
      }),
  );
}
