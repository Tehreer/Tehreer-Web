// Starts the built server over stdio and calls a few tools once.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("../build/server.js", import.meta.url));
const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [server] }));

console.log("tools:", (await client.listTools()).tools.map((t) => t.name).join(", "));
const text = process.argv[2] ?? "یہ Tehreer کا ورژن 3 ہے";
for (const [name, args] of [
  ["unicode_script_runs", { text }],
  ["bidi_analyze", { text }],
  ["bidi_levels", { text }],
  ["bidi_visual_order", { text }],
]) {
  const result = await client.callTool({ name, arguments: args });
  console.log(`\n== ${name}${result.isError ? " (error)" : ""}\n` + result.content[0].text);
}
await client.close();
