#!/usr/bin/env node
/**
 * MCP server over Tehreer-Web (Tehreer Core compiled to WebAssembly).
 * Talks to the client over stdio, so nothing but protocol messages may be written to stdout.
 */
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getVersion, initialize } from "@tehreer/web";
import { registerBidiTools } from "./tools/bidi.js";
import { registerFontTools } from "./tools/fonts.js";
import { registerLayoutTools } from "./tools/layout.js";
import { registerRenderTools } from "./tools/render.js";
import { registerShapingTools } from "./tools/shaping.js";
import { registerUnicodeTools } from "./tools/unicode.js";

await initialize();

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
const server = new McpServer({ name: "tehreer", version });
registerFontTools(server);
registerUnicodeTools(server);
registerShapingTools(server);
registerLayoutTools(server);
registerRenderTools(server);
registerBidiTools(server);

// The default limit of a message is 10 MiB, and a message over it closes the transport without a
// reply. A font of the largest size, as base64, has to fit with room for the rest of the request.
const MAX_MESSAGE_BYTES = 100 * 1024 * 1024;
const transport = new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: MAX_MESSAGE_BYTES });
transport.onerror = (error) => console.error(`tehreer MCP transport error: ${error.message}`);
await server.connect(transport);
console.error(`tehreer MCP server ready (Tehreer Core ${getVersion()})`);
