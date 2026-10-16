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

/*
 * Core exports every function of its public API by itself (see exports.json), so the module needs
 * no glue. The only thing it adds is the version, as `TRVersionGetString()` is declared by Core but
 * never defined.
 */

#include <emscripten.h>

#include <Tehreer/TRVersion.h>

EMSCRIPTEN_KEEPALIVE
const char *tw_version(void)
{
    return TEHREER_VERSION_STRING;
}

/*
 * The sizes and the offsets of the structs that the TypeScript wrapper reads and writes, as the
 * compiler made them. A test compares them with the layouts that are written by hand there, so a
 * field that is wrong, or a struct that changes in Core, is found.
 */

#include <stddef.h>
#include <stdio.h>

#include <SheenBidi/SheenBidi.h>

#include <Tehreer/Tehreer.h>

#define BEGIN(type)     count += snprintf(buffer + count, capacity - count, \
                            "%s\"" #type "\":{\"size\":%u", count > 1 ? "," : "", (unsigned)sizeof(type))
#define FIELD(type, name, member) \
                        count += snprintf(buffer + count, capacity - count, \
                            ",\"" #name "\":%u", (unsigned)offsetof(type, member))
#define END()           count += snprintf(buffer + count, capacity - count, "}")

EMSCRIPTEN_KEEPALIVE
int tw_layout(char *buffer, int capacity)
{
    int count = snprintf(buffer, capacity, "{");

    BEGIN(TRStringView);
    FIELD(TRStringView, buffer, buffer);
    FIELD(TRStringView, length, length);
    FIELD(TRStringView, encoding, encoding);
    END();

    BEGIN(TRPoint);
    FIELD(TRPoint, x, x);
    FIELD(TRPoint, y, y);
    END();

    BEGIN(TRSize);
    FIELD(TRSize, width, width);
    FIELD(TRSize, height, height);
    END();

    BEGIN(TRRect);
    FIELD(TRRect, x, origin.x);
    FIELD(TRRect, y, origin.y);
    FIELD(TRRect, width, size.width);
    FIELD(TRRect, height, size.height);
    END();

    BEGIN(TRAffineTransform);
    FIELD(TRAffineTransform, a, a);
    FIELD(TRAffineTransform, b, b);
    FIELD(TRAffineTransform, c, c);
    FIELD(TRAffineTransform, d, d);
    FIELD(TRAffineTransform, tx, tx);
    FIELD(TRAffineTransform, ty, ty);
    END();

    BEGIN(TRVariationAxis);
    FIELD(TRVariationAxis, name, name);
    FIELD(TRVariationAxis, tag, tag);
    FIELD(TRVariationAxis, flags, flags);
    FIELD(TRVariationAxis, minValue, minValue);
    FIELD(TRVariationAxis, maxValue, maxValue);
    FIELD(TRVariationAxis, defaultValue, defaultValue);
    END();

    BEGIN(TRBitmapStrike);
    FIELD(TRBitmapStrike, pixelWidth, pixelWidth);
    FIELD(TRBitmapStrike, pixelHeight, pixelHeight);
    END();

    BEGIN(TRNamedStyle);
    FIELD(TRNamedStyle, subfamilyName, subfamilyName);
    FIELD(TRNamedStyle, coordinatesPtr, coordinatesPtr);
    FIELD(TRNamedStyle, coordinateCount, coordinateCount);
    FIELD(TRNamedStyle, postScriptName, postScriptName);
    END();

    BEGIN(TRPaletteEntry);
    FIELD(TRPaletteEntry, name, name);
    END();

    BEGIN(TRPredefinedPalette);
    FIELD(TRPredefinedPalette, name, name);
    FIELD(TRPredefinedPalette, colorsPtr, colorsPtr);
    FIELD(TRPredefinedPalette, colorCount, colorCount);
    FIELD(TRPredefinedPalette, flags, flags);
    END();

    BEGIN(TROpenTypeFeature);
    FIELD(TROpenTypeFeature, tag, tag);
    FIELD(TROpenTypeFeature, value, value);
    END();

    BEGIN(TRAttributeValue);
    FIELD(TRAttributeValue, float, typeSize);
    FIELD(TRAttributeValue, uint, foregroundColor);
    FIELD(TRAttributeValue, boolean, underline);
    FIELD(TRAttributeValue, byte, underline);
    FIELD(TRAttributeValue, integer, foregroundColor);
    END();

    BEGIN(TRAttribute);
    FIELD(TRAttribute, type, type);
    FIELD(TRAttribute, value, value);
    END();

    BEGIN(TRReplacementRoom);
    FIELD(TRReplacementRoom, ascent, ascent);
    FIELD(TRReplacementRoom, descent, descent);
    FIELD(TRReplacementRoom, extent, extent);
    END();

    BEGIN(TRReplacementCallbacks);
    FIELD(TRReplacementCallbacks, computeRoom, computeRoom);
    FIELD(TRReplacementCallbacks, finalize, finalize);
    END();

    BEGIN(TRPathCallbacks);
    FIELD(TRPathCallbacks, moveTo, moveTo);
    FIELD(TRPathCallbacks, lineTo, lineTo);
    FIELD(TRPathCallbacks, quadTo, quadTo);
    FIELD(TRPathCallbacks, cubicTo, cubicTo);
    FIELD(TRPathCallbacks, close, close);
    END();

    BEGIN(TRDrawCallbacks);
    FIELD(TRDrawCallbacks, drawGlyphImage, drawGlyphImage);
    FIELD(TRDrawCallbacks, drawGlyphPath, drawGlyphPath);
    FIELD(TRDrawCallbacks, fillRect, fillRect);
    FIELD(TRDrawCallbacks, drawReplacement, drawReplacement);
    FIELD(TRDrawCallbacks, beginShadow, beginShadow);
    FIELD(TRDrawCallbacks, endShadow, endShadow);
    END();

    BEGIN(SBCodepointSequence);
    FIELD(SBCodepointSequence, stringEncoding, stringEncoding);
    FIELD(SBCodepointSequence, stringBuffer, stringBuffer);
    FIELD(SBCodepointSequence, stringLength, stringLength);
    END();

    BEGIN(SBRun);
    FIELD(SBRun, offset, offset);
    FIELD(SBRun, length, length);
    FIELD(SBRun, level, level);
    END();

    BEGIN(SBMirrorAgent);
    FIELD(SBMirrorAgent, index, index);
    FIELD(SBMirrorAgent, mirror, mirror);
    FIELD(SBMirrorAgent, codepoint, codepoint);
    END();

    BEGIN(SBScriptAgent);
    FIELD(SBScriptAgent, offset, offset);
    FIELD(SBScriptAgent, length, length);
    FIELD(SBScriptAgent, script, script);
    END();

    count += snprintf(buffer + count, capacity - count, "}");
    return count;
}
