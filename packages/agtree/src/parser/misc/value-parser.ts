import { defaultParserOptions } from '../options.js';
import { BaseParser } from '../base-parser.js';
import { type Value } from '../../nodes/index.js';

/**
 * Value parser.
 * This parser is very simple, it just exists to provide a consistent interface for parsing.
 */
export class ValueParser extends BaseParser {
    /**
     * Parses a value.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Value node.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): Value {
        const result: Value = {
            type: 'Value',
            value: raw,
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }
}
