/*
 * Copyright (C) 2026 Muhammad Tayyab Akram
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { forwardRef, useMemo, useState } from "react";
import { TLabel, type TLabelHandle, type TLabelProps } from "tehreer/react";

/** A link of the text: the code units it covers and the page it opens. */
export interface LabelLink {
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly href: string;
}

export interface LinkableLabelProps extends Omit<TLabelProps, "highlights" | "onHoverChange" | "onPressChange" | "onTap"> {
  readonly links: readonly LabelLink[];
  /** The color that covers a link while it is pressed or the pointer is over it. */
  readonly linkHighlightColor?: number;
}

const DEFAULT_HIGHLIGHT = 0xffccccee;

/**
 * A `TLabel` whose links open when they are clicked, like `LinkableLabel` of the Android demo. It only
 * keeps which link is hovered or pressed in its state, and gives the label that link as a highlight;
 * laying out and drawing are the label's.
 */
export const LinkableLabel = forwardRef<TLabelHandle, LinkableLabelProps>(function LinkableLabel(props, ref) {
  const { links, linkHighlightColor = DEFAULT_HIGHLIGHT, style, ...labelProps } = props;
  const [hovered, setHovered] = useState<number | undefined>();
  const [pressed, setPressed] = useState<number | undefined>();

  const linkAt = (index: number | undefined) =>
    index === undefined ? undefined : links.find((link) => index >= link.fromIndex && index < link.toIndex);

  const activeLink = linkAt(pressed) ?? linkAt(hovered);
  const highlights = useMemo(
    () => (activeLink === undefined ? [] : [{ fromIndex: activeLink.fromIndex, toIndex: activeLink.toIndex, color: linkHighlightColor }]),
    [activeLink, linkHighlightColor],
  );

  const text = props.attributedText?.string ?? props.text ?? "";

  return (
    <>
      <TLabel
        ref={ref}
        {...labelProps}
        style={{ ...style, cursor: activeLink === undefined ? undefined : "pointer" }}
        highlights={highlights}
        onHoverChange={setHovered}
        onPressChange={setPressed}
        onTap={(index) => {
          const link = linkAt(index);
          if (link !== undefined) {
            window.open(link.href, "_blank", "noopener,noreferrer");
          }
        }}
      />
      <ul className="visually-hidden">
        {links.map((link) => (
          <li key={link.fromIndex}>
            <a href={link.href} target="_blank" rel="noopener noreferrer">{text.slice(link.fromIndex, link.toIndex)}</a>
          </li>
        ))}
      </ul>
    </>
  );
});
