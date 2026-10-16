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

import { useMemo } from "react";
import { DrawStyle, TextAlignment } from "tehreer";
import { LinkableLabel } from "../components/LinkableLabel";
import { PageHeader, WhenReady } from "../components/Page";
import { ARTICLE_REFERENCE, ARTICLE_SEGMENTS, ARTICLE_TITLE } from "../data/article";
import { useFontFile } from "../lib/fonts";
import { useSegmentText } from "../lib/styledText";

/** The links of the article with the code units they cover. */
const LINKS = (() => {
  const links: { fromIndex: number; toIndex: number; href: string }[] = [];
  let index = 0;
  for (const segment of ARTICLE_SEGMENTS) {
    if (segment.href !== undefined) {
      links.push({ fromIndex: index, toIndex: index + segment.text.length, href: segment.href });
    }
    index += segment.text.length;
  }
  return links;
})();


export function CustomLabelPage() {
  const font = useFontFile("taj");
  const typeface = useMemo(() => font.value?.typefaces.get(0), [font.value]);
  const article = useSegmentText(ARTICLE_SEGMENTS);

  return (
    <>
      <PageHeader title="Custom Label" summary="A label that lays out styled, mixed-script text." />
      <article className="card article">
        <h2 className="article-title">{ARTICLE_TITLE}</h2>
        <WhenReady ready={typeface !== undefined && article !== undefined} error={font.error} what="the typeface">
          <LinkableLabel
            links={LINKS}
            attributedText={article}
            typeface={typeface}
            textSize={34}
            textColor="#1E5A3C"
            textAlignment={TextAlignment.Right}
            drawStyle={DrawStyle.FillStroke}
            strokeColor="#FF7F00"
            strokeRadius={0.25}
            lineHeightMultiplier={1.15}
            aria-label="Article"
            lang="ur"
            dir="rtl"
          />
        </WhenReady>
        <a className="source-link" href={ARTICLE_REFERENCE} target="_blank" rel="noopener noreferrer">{ARTICLE_REFERENCE}</a>
      </article>
    </>
  );
}
