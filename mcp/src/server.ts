#!/usr/bin/env node
/**
 * MCP server over Tehreer-Web (Tehreer Core compiled to WebAssembly).
 * Talks to the client over stdio, so nothing but protocol messages may be written to stdout.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getVersion, initialize } from "tehreer";
import { registerBidiTools } from "./tools/bidi.js";
import { registerFontTools } from "./tools/fonts.js";
import { registerLayoutTools } from "./tools/layout.js";
import { registerRenderTools } from "./tools/render.js";
import { registerShapingTools } from "./tools/shaping.js";
import { registerUnicodeTools } from "./tools/unicode.js";

await initialize();

const server = new McpServer({ name: "tehreer", version: "0.1.0" });
registerFontTools(server);
registerUnicodeTools(server);
registerShapingTools(server);
registerLayoutTools(server);
registerRenderTools(server);
registerBidiTools(server);

await server.connect(new StdioServerTransport());
console.error(`tehreer MCP server ready (Tehreer Core ${getVersion()})`);
