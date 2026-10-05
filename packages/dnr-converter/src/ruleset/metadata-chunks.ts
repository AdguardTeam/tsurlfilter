/**
 * @file Byte accounting and splitting of serialized metadata into fragments
 * that fit the per-value size bound of DNR rule metadata.
 *
 * Edge Add-ons rejects packages whose rule `metadata` values are too large.
 * A test package passed store validation with 64 KiB values and failed with
 * 128 KiB and 256 KiB values, so every emitted value is kept within that
 * bound.
 */

import { TAB } from '../utils/string';

/**
 * Maximum size in UTF-8 bytes of one serialized `metadata` value of a
 * metadata rule, including JSON escaping and the `{"chunk":...}` wrapper.
 */
export const MAX_METADATA_VALUE_BYTES = 65_536;

/**
 * Key of the fragment inside the `metadata` value of a metadata rule.
 */
export const CHUNK_KEY = 'chunk';

/**
 * Nesting depth of the `metadata` value inside a serialized ruleset file:
 * the rules array (0) contains rule objects (1) that contain the value (2).
 * Pretty printing indents every nested line by this many tabs.
 */
const METADATA_VALUE_DEPTH = 2;

/**
 * Code unit of the double quote character.
 */
const QUOTE = 0x22;

/**
 * Code unit of the backslash character.
 */
const BACKSLASH = 0x5c;

/**
 * First code unit that JSON.stringify does not escape.
 */
const SPACE = 0x20;

/**
 * First code unit of the surrogate range.
 */
const SURROGATE_START = 0xd800;

/**
 * Last code unit of the surrogate range.
 */
const SURROGATE_END = 0xdfff;

/**
 * First code point that UTF-8 encodes in two bytes.
 */
const TWO_BYTE_UTF8_START = 0x80;

/**
 * First code point that UTF-8 encodes in three bytes.
 */
const THREE_BYTE_UTF8_START = 0x800;

/**
 * Number of UTF-8 bytes of a surrogate pair.
 */
const SURROGATE_PAIR_BYTES = 4;

/**
 * Control characters that JSON.stringify writes as two-character escapes
 * (`\b`, `\t`, `\n`, `\f`, `\r`). Other control characters become `\u00XX`.
 */
const SHORT_ESCAPES = new Set([0x08, 0x09, 0x0a, 0x0c, 0x0d]);

/**
 * Shared encoder for byte measurements.
 */
const utf8Encoder = new TextEncoder();

/**
 * Byte accounting, splitting of serialized metadata into fragments and id
 * allocation for metadata rules.
 */
export class MetadataChunks {
    /**
     * Returns the size of a string in UTF-8 bytes.
     *
     * @param str String to measure.
     *
     * @returns Number of UTF-8 bytes.
     */
    public static utf8ByteLength(str: string): number {
        return utf8Encoder.encode(str).length;
    }

    /**
     * Returns the number of UTF-8 bytes that one UTF-16 code unit occupies once
     * `JSON.stringify` has escaped it inside a string literal. A code unit of a
     * surrogate pair must not be passed here: pairs cost four bytes and are
     * handled by the caller.
     *
     * @param codeUnit UTF-16 code unit.
     *
     * @returns Escaped size in bytes.
     */
    public static escapedByteCost(codeUnit: number): number {
        if (codeUnit === QUOTE || codeUnit === BACKSLASH) {
            return 2;
        }

        if (codeUnit < SPACE) {
            return SHORT_ESCAPES.has(codeUnit) ? 2 : 6;
        }

        // A lone surrogate is written as `\uXXXX`.
        if (codeUnit >= SURROGATE_START && codeUnit <= SURROGATE_END) {
            return 6;
        }

        if (codeUnit < TWO_BYTE_UTF8_START) {
            return 1;
        }

        if (codeUnit < THREE_BYTE_UTF8_START) {
            return 2;
        }

        return 3;
    }

    /**
     * Renders the `metadata` value of a metadata rule exactly as it appears in a
     * serialized ruleset file, so that its byte size can be measured.
     *
     * @param chunk Fragment stored in the value.
     * @param pretty Whether the file is pretty printed with {@link TAB} indents.
     *
     * @returns The value as written to the file.
     */
    public static renderValue(chunk: string, pretty: boolean): string {
        const chunkJson = JSON.stringify(chunk);

        if (!pretty) {
            return `{"${CHUNK_KEY}":${chunkJson}}`;
        }

        const inner = TAB.repeat(METADATA_VALUE_DEPTH + 1);
        const outer = TAB.repeat(METADATA_VALUE_DEPTH);

        return `{\n${inner}"${CHUNK_KEY}": ${chunkJson}\n${outer}}`;
    }

    /**
     * Splits a serialized payload into ordered fragments such that the
     * `metadata` value rendered from each fragment (see
     * {@link MetadataChunks.renderValue}) is at most {@link MAX_METADATA_VALUE_BYTES}.
     * Fragments are cut on code-point boundaries, so a surrogate pair is never
     * split. The result is a pure function of the input: identical payloads
     * produce identical fragments.
     *
     * @param payload Serialized metadata (JSON text).
     * @param pretty Whether the ruleset file is pretty printed.
     *
     * @returns Ordered fragments whose concatenation is `payload`.
     *
     * @throws Error if a rendered fragment exceeds the bound. This cannot happen
     * unless {@link MetadataChunks.escapedByteCost} disagrees with `JSON.stringify`.
     */
    public static split(payload: string, pretty: boolean): string[] {
        const budget = MAX_METADATA_VALUE_BYTES - MetadataChunks.utf8ByteLength(MetadataChunks.renderValue('', pretty));

        const fragments: string[] = [];
        let start = 0;
        let bytes = 0;
        let i = 0;

        // Iterating a string yields code points: a surrogate pair comes as one
        // two-unit string, a lone surrogate as one unit that `escapedByteCost`
        // prices as a `\uXXXX` escape.
        for (const char of payload) {
            const cost = char.length === 2
                ? SURROGATE_PAIR_BYTES
                : MetadataChunks.escapedByteCost(char.charCodeAt(0));

            if (bytes + cost > budget) {
                fragments.push(payload.slice(start, i));
                start = i;
                bytes = 0;
            }

            bytes += cost;
            i += char.length;
        }

        fragments.push(payload.slice(start));

        // Measure the real output as a guard against the cost table drifting
        // from the engine's escaping rules.
        for (const fragment of fragments) {
            const size = MetadataChunks.utf8ByteLength(MetadataChunks.renderValue(fragment, pretty));
            if (size > MAX_METADATA_VALUE_BYTES) {
                throw new Error(
                    `Metadata chunk of ${size} bytes exceeds ${MAX_METADATA_VALUE_BYTES} bytes `
                    + '(internal error: byte accounting disagrees with JSON.stringify)',
                );
            }
        }

        return fragments;
    }

    /**
     * Allocates ids for metadata rules: the smallest positive integers that no
     * other rule of the ruleset uses, in increasing order. Ordinary rule ids are
     * stable hashes of the rule text and are never changed to make room.
     *
     * @param count Number of ids to allocate.
     * @param usedIds Ids taken by ordinary rules and by unsafe rules stored in
     * the metadata.
     *
     * @returns Allocated ids, one per metadata rule.
     */
    public static allocateIds(count: number, usedIds: ReadonlySet<number>): number[] {
        const ids: number[] = [];
        let candidate = 1;

        while (ids.length < count) {
            if (!usedIds.has(candidate)) {
                ids.push(candidate);
            }
            candidate += 1;
        }

        return ids;
    }
}
