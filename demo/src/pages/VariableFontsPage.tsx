import { useEffect, useMemo, useState } from "react";
import { SfntTag, type Typeface } from "tehreer";
import { PageHeader, WhenReady } from "../components/Page";
import { FontSelect } from "../components/FontSelect";
import { Select } from "../components/Select";
import { VARIABLE_FONTS, useFontFile } from "../lib/fonts";
import { TLabel } from "tehreer/react";

const PREVIEW_LINES = ["ABCDEFGHIJK", "LMNOPQRSTU", "VWXYZ", "0123456789"];

const toHex = (color: number) => `#${(color & 0xffffff).toString(16).toUpperCase().padStart(6, "0")}`;

interface Instance {
  readonly typeface: Typeface;
  readonly owned: readonly Typeface[];
}

export function VariableFontsPage() {
  const [fontId, setFontId] = useState("rocher");
  const font = useFontFile(fontId);
  const file = font.value;

  const [instanceIndex, setInstanceIndex] = useState(0);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [edited, setEdited] = useState<readonly number[] | undefined>();

  const base = file?.typefaces.at(instanceIndex) ?? file?.typefaces.get(0);
  const axes = useMemo(
    () => (base ? base.variationAxes.toArray().map((axis, index) => ({ axis, index })).filter(({ axis }) => !axis.isHidden) : []),
    [base],
  );
  const palettes = useMemo(
    () => (base ? base.predefinedPalettes.toArray().map((palette) => ({ name: palette.name, colors: palette.colors.toArray() })) : []),
    [base],
  );
  const coordinates = edited ?? (base ? base.variationCoordinates.toArray() : []);

  const instance = useMemo<Instance | undefined>(() => {
    if (base === undefined) {
      return undefined;
    }
    const owned: Typeface[] = [];
    let typeface = base;
    if (edited !== undefined) {
      const varied = typeface.getVariationInstance(edited);
      if (varied !== undefined) {
        owned.push(varied);
        typeface = varied;
      }
    }
    const palette = palettes[paletteIndex];
    if (palette !== undefined && paletteIndex > 0) {
      const colored = typeface.getColorInstance(palette.colors);
      if (colored !== undefined) {
        owned.push(colored);
        typeface = colored;
      }
    }
    return { typeface, owned };
  }, [base, edited, palettes, paletteIndex]);

  useEffect(() => () => instance?.owned.forEach((typeface) => typeface.dispose()), [instance]);

  const changeFont = (id: string) => {
    setFontId(id);
    setInstanceIndex(0);
    setPaletteIndex(0);
    setEdited(undefined);
  };

  const changeInstance = (index: number) => {
    setInstanceIndex(index);
    setPaletteIndex(0);
    setEdited(undefined);
  };

  const setCoordinate = (axisIndex: number, value: number) => {
    const next = [...coordinates];
    next[axisIndex] = value;
    setEdited(next);
  };

  const typeface = instance?.typeface;

  const shownPalette = palettes[paletteIndex] ?? palettes[0];

  return (
    <>
      <PageHeader title="Variable Fonts" summary="Adjust axes, pick instances and swap colour palettes." />

      <WhenReady ready={file !== undefined && typeface !== undefined} error={font.error} what="the font">
        <div className="row vf-row">
          <section aria-labelledby="ctl-h" className="card controls">
            <h2 id="ctl-h">Controls</h2>
            <FontSelect id="face" label="Typeface" options={VARIABLE_FONTS} value={fontId} onChange={changeFont} />

            <div className="field">
              <label htmlFor="inst">Instance</label>
              <Select id="inst" value={instanceIndex} onChange={(value) => changeInstance(Number(value))}>
                {file?.typefaces.toArray().map((candidate, index) => (
                  <option key={index} value={index}>{candidate.styleName ?? `Instance ${index + 1}`}</option>
                ))}
              </Select>
            </div>

            {palettes.length > 0 && (
              <div className="field">
                <span id="pal-l" className="field-label">Palette</span>
                {palettes.length > 1 && (
                  <Select label="Palette" value={paletteIndex} onChange={(value) => setPaletteIndex(Number(value))}>
                    {palettes.map((palette, index) => (
                      <option key={index} value={index}>{palette.name ?? `Palette ${index + 1}`}</option>
                    ))}
                  </Select>
                )}
                <ul aria-labelledby="pal-l" className="swatches">
                  {shownPalette?.colors.map((color, index) => (
                    <li key={index}>
                      <span className="swatch-chip" style={{ background: toHex(color) }} />
                      <span>{toHex(color).slice(1)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {axes.map(({ axis, index }) => {
              const id = `axis-${SfntTag.toString(axis.tag).trim()}`;
              const value = coordinates[index] ?? axis.defaultValue;
              return (
                <div className="axis" key={`${fontId}-${instanceIndex}-${id}`}>
                  <div className="axis-head">
                    <label htmlFor={id}>{axis.name ?? SfntTag.toString(axis.tag)}</label>
                    <span className="meta">{value.toFixed(1)}</span>
                  </div>
                  <input
                    id={id}
                    type="range"
                    min={axis.minValue}
                    max={axis.maxValue}
                    step={0.1}
                    value={value}
                    onChange={(event) => setCoordinate(index, Number(event.target.value))}
                  />
                  <div className="axis-range"><span>{axis.minValue.toFixed(1)}</span><span>{axis.maxValue.toFixed(1)}</span></div>
                </div>
              );
            })}
          </section>

          <section aria-label="Preview" className="card preview">
            {PREVIEW_LINES.map((line) => (
              <TLabel key={line} text={line} typeface={typeface} textSize={68} textColor="#171915" lineHeightMultiplier={1.1} />
            ))}
          </section>
        </div>
      </WhenReady>
    </>
  );
}
