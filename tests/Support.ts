import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FontFile, initialize } from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const core = resolve(process.env["TEHREER_CORE"] ?? join(root, "../Tehreer-Core"));

/** Loads the module, and the font of Core's tests with the name. */
export async function ready(): Promise<void> {
  await initialize();
}

export function loadFont(name: string): FontFile {
  return new FontFile(readFileSync(join(core, "Tests/Fonts", name)));
}

export const ROBOTO = "Roboto-Regular.abc.ttf";
export const ROBOTO_NAMES = "Roboto-Regular.names.ttf";
export const ROBOTO_VARIABLE = "Roboto-Variable.abc.ttf";
export const ROBOTO_HIDDEN = "Roboto-Variable.hidden.ttf";
export const ROCHER_COLOR = "RocherColorGX.abc.ttf";
export const NASTALIQ = "NotoNastaliqUrdu-Regular.ttf";
export const EMOJI = "NotoColorEmoji-CBDT.flags.ttf";

/** A 2D context that records what is done to it, as far as the library uses it. */
export class RecordingContext {
  readonly calls: [string, ...unknown[]][] = [];
  #fillStyle = "";
  shadowColor = "";
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;

  get fillStyle(): string {
    return this.#fillStyle;
  }

  set fillStyle(value: string) {
    this.#fillStyle = value;
    this.calls.push(["fillStyle", value]);
  }

  save(): void {
    this.calls.push(["save"]);
  }

  restore(): void {
    this.calls.push(["restore"]);
  }

  beginPath(): void {
    this.calls.push(["beginPath"]);
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.calls.push(["rect", x, y, width, height]);
  }

  clip(): void {
    this.calls.push(["clip"]);
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.calls.push(["fillRect", x, y, width, height, this.#fillStyle]);
  }

  drawImage(...args: unknown[]): void {
    this.calls.push(["drawImage", ...args.slice(1)]);
  }

  count(name: string): number {
    return this.calls.filter(([call]) => call === name).length;
  }

  of(name: string): [string, ...unknown[]][] {
    return this.calls.filter(([call]) => call === name);
  }

  /** The context as the type that the library asks for. */
  get asContext(): never {
    return this as never;
  }
}
