import * as v from 'valibot';

import { getErrorMessage } from '../utils/error';

/**
 * Interface that contains the index number of
 * the source rule and the filter id of the rule.
 */
export interface SourceRuleIdxAndFilterId {
    /**
     * Index number of the source rule in the original filter list.
     */
    sourceRuleIndex: number;

    /**
     * Filter ID of the source rule.
     */
    filterId: number;
}

/**
 * Interface that contains the relationship between the original rules
 * (filter id with rule index) and the converted rules (declarative rule id).
 */
export interface Source extends SourceRuleIdxAndFilterId {
    /**
     * Declarative rule ID of the converted rule.
     */
    declarativeRuleId: number;
}

/**
 * Interface for source map operations.
 */
export interface ISourceMap {
    /**
     * Returns source filter id and source text rule id
     * for provided declarative rule id.
     *
     * @param ruleId Converted rule id.
     *
     * @returns List of pairs: source filter id and source rule id.
     */
    getByDeclarativeRuleId(ruleId: number): SourceRuleIdxAndFilterId[];

    /**
     * Returns ids of converted declarative rules for provided pairs of source
     * filter id and source text rule.
     *
     * @param source Pair of source rule and filter id.
     *
     * @returns List of ids of converted declarative rules.
     */
    getBySourceRuleIndex(source: SourceRuleIdxAndFilterId): number[];

    /**
     * Serializes source map to JSON string.
     *
     * @returns JSON string.
     */
    serialize(): string;
}

/**
 * Base64 alphabet used by the standard source-map VLQ encoding.
 */
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Number of data bits carried by a single VLQ base64 digit.
 */
const VLQ_BASE_SHIFT = 5;

/**
 * Mask for the data bits of a single VLQ digit.
 */
const VLQ_BASE_MASK = (1 << VLQ_BASE_SHIFT) - 1;

/**
 * Continuation bit: set on a VLQ digit when more digits follow.
 */
const VLQ_CONTINUATION_BIT = 1 << VLQ_BASE_SHIFT;

/**
 * Encodes a single non-negative integer as a base64 VLQ string (standard
 * source-map VLQ). A sign bit is used (bit 0 of the first decoded value), but
 * all source-map values are non-negative, so the sign bit is always 0.
 *
 * Arithmetic (not bitwise) is used for the magnitude to support values up to
 * 2^31-1 (declarative rule IDs are text hashes) without 32-bit overflow.
 *
 * Note: every value is non-negative, so an unsigned VLQ variant (without the
 * sign bit) would save one bit per value. We keep the standard, well-understood
 * source-map codec for interoperability and readability rather than shaving a
 * marginal amount of size.
 *
 * @param value Non-negative integer to encode.
 *
 * @returns Base64 VLQ string for the value.
 */
const encodeVlq = (value: number): string => {
    let result = '';
    // source-map VLQ sign convention: bit 0 = sign, remaining bits = magnitude.
    // Use arithmetic to avoid 32-bit overflow for values >= 2^30.
    let vlq = value < 0 ? ((-value) * 2) + 1 : value * 2;
    do {
        let digit = vlq % 32;
        vlq = Math.floor(vlq / 32);
        if (vlq > 0) {
            digit |= VLQ_CONTINUATION_BIT;
        }
        result += BASE64_CHARS[digit];
    } while (vlq > 0);
    return result;
};

/**
 * Encodes an array of `[declarativeRuleId, sourceRuleIndex, filterId]` triples
 * as a base64 VLQ string. Each triple is one comma-separated segment (mirroring
 * the source-map "mappings" format); values within a segment are concatenated
 * without a separator because VLQ is self-delimiting.
 *
 * @param triples Array of integer triples to encode.
 *
 * @returns VLQ-encoded string.
 */
const encodeSourceMapVlq = (triples: number[][]): string => triples
    .map(([id, index, filterId]) => encodeVlq(id) + encodeVlq(index) + encodeVlq(filterId))
    .join(',');

/**
 * Decodes a base64 VLQ string starting at the given index, returning the
 * decoded integer and the next index to read.
 *
 * Arithmetic (not bitwise) is used for the magnitude to support values up to
 * 2^31-1 (declarative rule IDs are text hashes) without 32-bit overflow.
 *
 * @param str VLQ string.
 * @param pos Index to start decoding at.
 *
 * @returns Tuple of the decoded integer and the next unread index.
 *
 * @throws Error When a character is not a valid base64 VLQ digit.
 */
const decodeVlq = (str: string, pos: number): [number, number] => {
    let result = 0;
    let shift = 1;
    let next = pos;
    let continuation = true;
    do {
        const ch = str.charCodeAt(next);
        next += 1;
        const base64Digit = BASE64_CHARS.indexOf(String.fromCharCode(ch));
        if (base64Digit === -1) {
            throw new Error('Invalid base64 VLQ digit');
        }
        const digit = base64Digit & VLQ_BASE_MASK;
        result += digit * shift;
        shift *= 32;
        continuation = (base64Digit & VLQ_CONTINUATION_BIT) !== 0;
    } while (continuation);
    const negate = (result % 2) === 1;
    const value = Math.floor(result / 2);
    return [negate ? -value : value, next];
};

/**
 * Decodes a VLQ-encoded source-map string into an array of triples.
 *
 * @param str VLQ string (comma-separated segments).
 *
 * @returns Array of `[declarativeRuleId, sourceRuleIndex, filterId]` triples.
 *
 * @throws Error When the VLQ string is malformed or a segment does not contain
 * exactly 3 values.
 */
const decodeSourceMapVlq = (str: string): number[][] => {
    if (str.length === 0) {
        return [];
    }
    return str.split(',').map((segment) => {
        const triple: number[] = [];
        let pos = 0;
        for (let i = 0; i < 3; i += 1) {
            const [value, next] = decodeVlq(segment, pos);
            triple.push(value);
            pos = next;
        }
        // Reject trailing data after exactly 3 values so malformed/crafted
        // segments cannot decode to silently-wrong data. This hardens the
        // deserialization contract documented above.
        if (pos !== segment.length) {
            throw new Error('Invalid VLQ segment: trailing data after 3 values');
        }
        return triple;
    });
};

/**
 * Validator for a single serialized source-map entry.
 *
 * Each entry is a strict triple of non-negative integers in the order
 * [declarativeRuleId, sourceRuleIndex, filterId].
 *
 * After the VLQ adoption, this validator is applied to each decoded triple to
 * ensure values are non-negative integers (the VLQ decoder can produce negative
 * values from a crafted malicious string).
 */
const SourceMapItemValidator = v.strictTuple([
    v.pipe(v.number(), v.integer(), v.minValue(0)),
    v.pipe(v.number(), v.integer(), v.minValue(0)),
    v.pipe(v.number(), v.integer(), v.minValue(0)),
]);

/**
 * Validator for a serialized source map: an array of
 * [declarativeRuleId, sourceRuleIndex, filterId] triples.
 */
const SourceMapValidator = v.array(SourceMapItemValidator);

/**
 * Contains a list of records with source rule ID, converted rule ID
 * and filter ID.
 * Can return the source filter and rule for the provided conversion rule ID.
 */
export class SourceMap implements ISourceMap {
    /**
     * List of sources.
     */
    private sources: Source[] = [];

    /**
     * Needs for fast search for source rule.
     */
    private ruleIdMap: Map<number, SourceRuleIdxAndFilterId[]> = new Map();

    /**
     * Needs for fast search for source rule.
     */
    private declarativeIdMap: Map<string, number[]> = new Map();

    /**
     * Creates new SourceMap from provided list of sources.
     *
     * @param sources List of sources.
     */
    constructor(sources: Source[]) {
        this.sources = sources;

        // For fast search
        this.sources.forEach((item) => {
            const { sourceRuleIndex, filterId, declarativeRuleId } = item;

            // Fill source rules map.
            const existingSourcePairs = this.ruleIdMap.get(declarativeRuleId);
            const value: SourceRuleIdxAndFilterId = {
                sourceRuleIndex,
                filterId,
            };
            const newSourceValue = existingSourcePairs
                ? existingSourcePairs.concat(value)
                : [value];

            this.ruleIdMap.set(declarativeRuleId, newSourceValue);

            // Fill declarative IDs map.
            const key = SourceMap.getKeyFromSource(value);
            const existingDeclarativeIdsPairs = this.declarativeIdMap.get(key);
            const newDeclarativeIdsValue = existingDeclarativeIdsPairs
                ? existingDeclarativeIdsPairs.concat(declarativeRuleId)
                : [declarativeRuleId];
            this.declarativeIdMap.set(key, newDeclarativeIdsValue);
        });
    }

    /**
     * Creates unique key for provided pair of source rule and filter id.
     *
     * @param source Pair of source rule and filter id.
     *
     * @returns Unique key for dictionary.
     */
    public static getKeyFromSource(source: SourceRuleIdxAndFilterId): string {
        return `${source.filterId}_${source.sourceRuleIndex}`;
    }

    /** @inheritdoc */
    public getByDeclarativeRuleId(ruleId: number): SourceRuleIdxAndFilterId[] {
        return this.ruleIdMap.get(ruleId) || [];
    }

    /** @inheritdoc */
    public getBySourceRuleIndex(source: SourceRuleIdxAndFilterId): number[] {
        const key = SourceMap.getKeyFromSource(source);

        return this.declarativeIdMap.get(key) || [];
    }

    /**
     * Deserializes array of sources from a VLQ-encoded string.
     *
     * The serialized source map uses base64 VLQ encoding (standard source-map
     * VLQ) to compactly represent `[declarativeRuleId, sourceRuleIndex,
     * filterId]` integer triples. Each triple is one comma-separated segment;
     * values within a segment are concatenated without a separator because VLQ
     * is self-delimiting. Decoded triples are validated to ensure all values
     * are non-negative integers.
     *
     * @param sourceString VLQ-encoded source-map string (produced by
     * `serialize()`).
     *
     * @returns List of sources.
     *
     * @throws Error When `sourceString` is not valid VLQ or contains negative
     * values. The thrown error carries a descriptive message.
     */
    public static deserializeSources(sourceString: string): Source[] {
        try {
            const triples = decodeSourceMapVlq(sourceString);
            const arr = v.parse(SourceMapValidator, triples);

            return arr.map((item) => ({
                declarativeRuleId: item[0],
                sourceRuleIndex: item[1],
                filterId: item[2],
            }));
        } catch (e) {
            throw new Error(`Cannot deserialize source map, got error: ${getErrorMessage(e)}`);
        }
    }

    /**
     * Serializes source map to a base64 VLQ string.
     *
     * A base64 VLQ encoding was evaluated against the previous compact JSON
     * format on a representative 100k+ line ruleset (EasyList + EasyPrivacy,
     * 109,517 triples) and the full chromium-mv3 rule set (50 rulesets,
     * 316,742 triples). VLQ reduced the source-map size by 38.51% (2,426,515 B
     * → 1,492,126 B, saving 912 KB) on the single-filter sample and by 39.25%
     * (7,171,443 B → 4,356,603 B, saving 2.68 MB) across the full set. The
     * substantial absolute savings (multi-MB at scale) justify the custom
     * codec and the shift away from human-readable JSON arrays. The format
     * change requires no migration (lockstep serialization — the generator and
     * reader always ship together). The measurement is recorded in
     * `benchmarks/vlq-results.md` and is reproducible via `pnpm bench:vlq`.
     *
     * @returns VLQ-encoded string.
     */
    public serialize(): string {
        const plainArray = this.sources.map(({
            declarativeRuleId,
            sourceRuleIndex,
            filterId,
        }) => ([declarativeRuleId, sourceRuleIndex, filterId]));
        return encodeSourceMapVlq(plainArray);
    }
}
