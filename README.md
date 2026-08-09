# open-meteo-mcp

An MCP server that gives any MCP client weather forecasts and current conditions for any city, backed by the free [Open-Meteo](https://open-meteo.com/en/docs) API — no API key, no account.

## Install

Requires Node 18 or newer. Nothing else — there is no API key and no configuration.

```bash
git clone <this-repo-url>
cd open-meteo-mcp
npm install
npm run build
```

## Run

Connect it to Claude Code (run from the repo root, so `$(pwd)` resolves to the checkout):

```bash
claude mcp add weather -- node "$(pwd)/dist/index.js"
```

Check it registered with `claude mcp list`, then ask: *"What's the weather in Lisbon this week?"*

For any other MCP client, add it to that client's config with an absolute path:

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/absolute/path/to/open-meteo-mcp/dist/index.js"]
    }
  }
}
```

To run the server directly — it speaks JSON-RPC over stdin/stdout and will sit there waiting for a client, which is the expected behaviour:

```bash
npm start          # run the built server
npm run dev        # run from source, restarts on save
```

## Example

`examples/forecast.mjs` starts the server and calls both tools:

```js
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

await client.close();
```

```console
$ node examples/forecast.mjs
3-day forecast for Lisbon, Lisbon District, Portugal (times in Europe/Lisbon)

Sun 9 Aug — Partly cloudy
  High 28.8°C / Low 21.0°C · Rain 0% chance, 0.0 mm · Wind up to 17.7 km/h
Mon 10 Aug — Partly cloudy
  High 28.6°C / Low 20.5°C · Rain 0% chance, 0.0 mm · Wind up to 18.2 km/h
Tue 11 Aug — Partly cloudy
  High 29.0°C / Low 20.6°C · Rain 0% chance, 0.0 mm · Wind up to 17.4 km/h
```

And `get_current` returns:

```console
Current conditions in Lisbon, Lisbon District, Portugal
As of Sun 9 Aug, 07:30 local time (Europe/Lisbon)

Partly cloudy, 21.1°C
Feels like:    24.2°C
Humidity:      90%
Wind:          3.6 km/h from the W
Precipitation: 0.0 mm in the last hour
Daylight:      yes
```

## What's included

Two tools:

| Tool | Arguments | Returns |
| --- | --- | --- |
| `get_forecast` | `city: string`, `days: 1–7` | One entry per day: conditions, high/low, chance and amount of rain, peak wind |
| `get_current` | `city: string` | Conditions, temperature, feels-like, humidity, wind, recent precipitation |

Both accept a plain city name and resolve it through Open-Meteo's geocoder, so `"New York"` and `"Springfield, United States"` both work.

```
src/
  index.ts              server setup, stdio transport, signal handling
  format.ts             WMO weather codes and readable text output
  logger.ts             stderr-only logging
  api/
    client.ts           fetch with a 10s timeout, schema validation, error mapping
    open-meteo.ts       geocoding and forecast endpoints, response schemas
    errors.ts           WeatherError, the one error type raised on purpose
  tools/
    get-forecast.ts     tool definition and Zod input schema
    get-current.ts      tool definition and Zod input schema
    tool-result.ts      turns any failure into readable tool content
examples/
  forecast.mjs          the example above
```

Every failure — an unknown city, a timeout, an upstream outage, a response whose shape changed — comes back as readable text with `isError` set, never as an empty result or a thrown exception. All logging goes to stderr, because stdout is the transport.

## Why this exists

Most MCP examples are either a toy that echoes a string or a large server where the protocol is buried under application code. This is meant to be the thing in between: small enough to read in one sitting, complete enough to copy from. It wraps a real API with real failure modes, so the error handling, input validation, and output formatting are the parts worth stealing.

## Limitations

These are deliberate. The server does not:

- **Support any unit but metric.** Temperatures are °C, wind is km/h, precipitation is mm. There is no unit parameter.
- **Disambiguate city names.** The geocoder's top match wins, which is usually the most populous. Ask for `"Springfield, United States"` if the bare name is ambiguous — the resolved location is always named in the output, so you can tell when it guessed wrong.
- **Forecast beyond 7 days.** Open-Meteo itself offers up to 16; this caps at 7.
- **Provide hourly data.** Forecasts are daily aggregates. Current conditions are a single reading, and its precipitation figure covers the preceding hour.
- **Cache anything.** Every tool call hits the network. Open-Meteo's free tier is generous but rate-limited and non-commercial — check their [terms](https://open-meteo.com/en/terms) before putting this in front of real traffic.
- **Retry failed requests.** One attempt, 10-second timeout, then an error explaining what happened. Retrying is the caller's decision.
- **Geocode in languages other than English.** The geocoder is queried with `language=en`.
- **Speak any transport but stdio.** No HTTP or SSE.

Also out of scope on purpose: authentication, Docker, a test suite, and a Python port.

## License

MIT — see [LICENSE](LICENSE).
