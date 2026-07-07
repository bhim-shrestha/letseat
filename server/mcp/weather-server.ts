import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * MCP Server Implementation
 * 
 * This file demonstrates the implementation of the Model Context Protocol (MCP).
 * By exposing a local MCP server, we allow our Concierge Agents to dynamically 
 * fetch live weather contexts.
 * 
 * Design:
 * - Uses @modelcontextprotocol/sdk to construct the server.
 * - Registers a strongly-typed tool validation schema using Zod.
 * - Exposes real-time Open-Meteo context for the LLM's consumption.
 */
export const weatherServer = new McpServer({
  name: "weather-mcp-server",
  version: "1.0.0",
});

export async function getWeatherForLocationTool({ lat, lng }: { lat: number, lng: number }) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&timezone=auto`;
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(data.current_weather),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        { type: "text" as const, text: `Error fetching weather: ${error.message}` }
      ],
      isError: true,
    };
  }
}

// Register the tool
weatherServer.tool(
  "get_weather_for_location",
  "Fetches the local weather for an accurate food recommendation context.",
  {
    lat: z.number().describe("Latitude of the location"),
    lng: z.number().describe("Longitude of the location"),
  },
  getWeatherForLocationTool
);

/**
 * MCP Server Connection & Compliance
 * 
 * To ensure absolute compliance with the MCP standard:
 * 1. We support standard Stdio transport to allow external LLM clients to connect to this server.
 * 2. We execute this connection dynamically if the script is run directly or if the START_MCP env flag is set.
 * 3. Within our primary full-stack Express architecture, the Concierge Agent calls the tool in-process 
 *    to avoid standard input/output interference in the container, optimizing speed and reliability.
 */
if (typeof process !== "undefined" && (process.argv[1]?.includes("weather-server") || process.env.START_MCP === "true")) {
  console.log("[MCP] Starting standalone weather-mcp-server via StdioServerTransport...");
  const transport = new StdioServerTransport();
  weatherServer.connect(transport).then(() => {
    console.log("[MCP] Standalone weather-mcp-server successfully connected via stdio.");
  }).catch((err) => {
    console.error("[MCP] Failed to connect weather-mcp-server:", err);
  });
}
