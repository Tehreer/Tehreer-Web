import { useMemo } from "react";
import { TextAlignment } from "tehreer";
import { TLabel } from "tehreer/react";
import { WhenReady } from "../components/Page";
import { StickyHeader } from "../components/Sticky";
import { useFontFile } from "../lib/fonts";
import { SCREENS, hrefOf } from "../screens";

export function OverviewPage() {
  const font = useFontFile("mehr");
  const typeface = useMemo(() => font.value?.typefaces.get(0), [font.value]);

  return (
    <>
      <StickyHeader className="overview-hero">
        <div className="page-title">
          <h1>Tehreer Demo</h1>
          <p>Explore the text engine behind Tehreer in the browser: bidirectional resolution, glyph access, OpenType shaping and variable fonts.</p>
        </div>
        <div className="hero-word" aria-hidden="true">
          <WhenReady ready={typeface !== undefined} error={font.error} what="font">
            <TLabel
              text="تحریر"
              typeface={typeface}
              textSize={84}
              textColor="#00A100"
              textAlignment={TextAlignment.Center}
              lineHeightMultiplier={1.15}
              lang="ur"
              dir="rtl"
            />
          </WhenReady>
        </div>
      </StickyHeader>

      <section aria-label="Demo screens" className="screen-list">
        {SCREENS.filter((screen) => screen.path !== "").map((screen, index) => (
          <a key={screen.path} className="screen-row" href={hrefOf(screen.path)}>
            <span className="screen-number">{String(index + 1).padStart(2, "0")}</span>
            <span className="screen-title">{screen.title}</span>
            <span className="screen-summary">{screen.summary}</span>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10h12M11 5l5 5-5 5" />
            </svg>
          </a>
        ))}
      </section>
    </>
  );
}
