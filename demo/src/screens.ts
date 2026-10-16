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

import type { ComponentType } from "react";
import { BidiPage } from "./pages/BidiPage";
import { CustomLabelPage } from "./pages/CustomLabelPage";
import { CustomTextViewPage } from "./pages/CustomTextViewPage";
import { GlyphsPage } from "./pages/GlyphsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ShapingPage } from "./pages/ShapingPage";
import { TypefaceInfoPage } from "./pages/TypefaceInfoPage";
import { VariableFontsPage } from "./pages/VariableFontsPage";

export interface Screen {
  readonly path: string;
  readonly title: string;
  readonly summary: string;
  readonly component: ComponentType;
}

export const SCREENS: readonly Screen[] = [
  {
    path: "",
    title: "Overview",
    summary: "Explore the text engine behind Tehreer in the browser.",
    component: OverviewPage,
  },
  {
    path: "bidi",
    title: "Bidirectional Algorithm",
    summary: "Resolve embedding levels and visual runs of mixed-direction text.",
    component: BidiPage,
  },
  {
    path: "typeface-info",
    title: "Typeface Information",
    summary: "Read the names and metrics of a loaded typeface.",
    component: TypefaceInfoPage,
  },
  {
    path: "glyphs",
    title: "Typeface Glyphs",
    summary: "Browse every glyph in a typeface by its glyph ID.",
    component: GlyphsPage,
  },
  {
    path: "shaping",
    title: "OpenType Shaping",
    summary: "Shape text with script and language tags, then inspect each glyph's ID, offset and advance.",
    component: ShapingPage,
  },
  {
    path: "label",
    title: "Custom Label",
    summary: "A label that lays out styled, mixed-script text.",
    component: CustomLabelPage,
  },
  {
    path: "text-view",
    title: "Custom Text View",
    summary: "A text view for long, colour-annotated Arabic text with adjustable size.",
    component: CustomTextViewPage,
  },
  {
    path: "variable-fonts",
    title: "Variable Fonts",
    summary: "Adjust axes, pick instances and swap colour palettes.",
    component: VariableFontsPage,
  },
];

export const hrefOf = (path: string) => `#/${path}`;
