export type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

export const json = (value: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});

const failure = (error: unknown): ToolResult => ({
  isError: true,
  content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
});

/** Runs a tool body and turns its value into JSON, or its error into an error result. */
export function guarded(work: () => unknown): ToolResult {
  try {
    return json(work());
  } catch (error) {
    return failure(error);
  }
}

export async function guardedAsync(work: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return json(await work());
  } catch (error) {
    return failure(error);
  }
}

export const hex = (codePoint: number): string => "U+" + codePoint.toString(16).toUpperCase().padStart(4, "0");

/** A result with several text items, such as metadata followed by a document. */
export function texts(...items: string[]): ToolResult {
  return { content: items.map((text) => ({ type: "text" as const, text })) };
}
