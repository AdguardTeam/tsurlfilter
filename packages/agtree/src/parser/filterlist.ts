/* eslint-disable no-param-reassign */
import {
    BinaryTypeMap,
    type AnyRule,
    type FilterList,
    type NewLine,
} from '../nodes';
import { RuleParser } from './rule-parser';
import {
    CR,
    CRLF,
    EMPTY,
    LF,
    NULL,
} from '../utils/constants';
import { StringUtils } from '../utils/string';
import { defaultParserOptions } from './options';
import { BaseParser } from './interface';
import { type InputByteBuffer } from '../utils/input-byte-buffer';
import { BINARY_SCHEMA_VERSION } from '../utils/binary-schema-version';
import { RuleGenerator } from '../generator';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum FilterListNodeSerializationMap {
    Children = 1,
    Start,
    End,
}

/**
 * `FilterListParser` is responsible for parsing a whole adblock filter list (list of rules).
 * It is a wrapper around `RuleParser` which parses each line separately.
 */
export class FilterListParser extends BaseParser {
    /**
     * Parses a whole adblock filter list (list of rules).
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns AST of the source code (list of rules)
     * @example
     * ```js
     * import { readFileSync } from 'fs';
     * import { FilterListParser } from '@adguard/agtree';
     *
     * // Read filter list content from file
     * const content = readFileSync('your-adblock-filter-list.txt', 'utf-8');
     *
     * // Parse the filter list content, then do something with the AST
     * const ast = FilterListParser.parse(content);
     * ```
     * @throws If one of the rules is syntactically invalid (if `tolerant` is `false`)
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): FilterList {
        // Actual position in the source code
        let offset = 0;

        // Collect adblock rules here
        const rules: AnyRule[] = [];

        // Start offset of the current line (initially it's 0)
        let lineStartOffset = offset;

        while (offset < raw.length) {
            // Check if we found a new line
            if (StringUtils.isEOL(raw[offset])) {
                // Rule text
                const text = raw.slice(lineStartOffset, offset);

                // Parse the rule
                const rule = RuleParser.parse(text, options, lineStartOffset);

                // Get newline type (possible values: 'crlf', 'lf', 'cr' or undefined if no newline found)
                let nl: NewLine | undefined;

                if (raw[offset] === CR) {
                    if (raw[offset + 1] === LF) {
                        nl = 'crlf';
                    } else {
                        nl = 'cr';
                    }
                } else if (raw[offset] === LF) {
                    nl = 'lf';
                }

                // Add newline type to the rule (rule parser already added raws.text)
                if (!rule.raws) {
                    rule.raws = {
                        text,
                        nl,
                    };
                } else {
                    rule.raws.nl = nl;
                }

                // Add the rule to the list
                rules.push(rule);

                // Update offset: add 2 if we found CRLF, otherwise add 1
                offset += nl === 'crlf' ? 2 : 1;

                // Update line start offset
                lineStartOffset = offset;
            } else {
                // No new line found, just increase offset
                offset += 1;
            }
        }

        // Parse the last rule (it doesn't end with a new line)
        rules.push(
            RuleParser.parse(raw.slice(lineStartOffset, offset), options, baseOffset + lineStartOffset),
        );

        // Return the list of rules (FilterList node)
        const result: FilterList = {
            type: 'FilterList',
            children: rules,
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }

    /**
     * Serializes a whole adblock filter list (list of rules).
     *
     * @param ast AST to generate
     * @param preferRaw If `true`, then the parser will use `raws.text` property of each rule
     * if it is available. Default is `false`.
     * @returns Serialized filter list
     */
    public static generate(ast: FilterList, preferRaw = false): string {
        let result = EMPTY;

        for (let i = 0; i < ast.children.length; i += 1) {
            const rule = ast.children[i];

            if (preferRaw && rule.raws?.text) {
                result += rule.raws.text;
            } else {
                result += RuleGenerator.generate(rule);
            }

            switch (rule.raws?.nl) {
                case 'crlf':
                    result += CRLF;
                    break;
                case 'cr':
                    result += CR;
                    break;
                case 'lf':
                    result += LF;
                    break;
                default:
                    if (i !== ast.children.length - 1) {
                        result += LF;
                    }
                    break;
            }
        }

        return result;
    }

    /**
     * Deserializes a filter list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<FilterList>): void {
        buffer.assertUint8(BinaryTypeMap.FilterListNode);

        node.type = 'FilterList';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case FilterListNodeSerializationMap.Children:
                    node.children = new Array(buffer.readUint32());
                    for (let i = 0; i < node.children.length; i += 1) {
                        RuleParser.deserialize(buffer, node.children[i] = {} as AnyRule);
                    }
                    break;

                case FilterListNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case FilterListNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Helper method to jump to the children of the filter list node.
     *
     * Filter lists serialized in binary format are structured as follows:
     * - `FilterListNode` filter list node indicator (1 byte)
     * - Properties:
     *      - `Children` (1 byte) - children count, followed by children nodes
     *      - `Start` (1 byte) - start offset, if present, followed by the value
     *      - `End` (1 byte) - end offset, if present, followed by the value
     *      - `NULL` (1 byte) - closing indicator
     *
     * This method skips indicators, reads the children count and returns it.
     * This way the buffer is positioned at the beginning of the children nodes.
     *
     * @param buffer Reference to the input byte buffer.
     * @returns Number of children nodes.
     */
    public static jumpToChildren(buffer: InputByteBuffer): number {
        buffer.assertUint8(BinaryTypeMap.FilterListNode); // filter list indicator
        let prop = buffer.readUint8();

        while (prop) {
            switch (prop) {
                case FilterListNodeSerializationMap.Children:
                    return buffer.readUint32();

                case FilterListNodeSerializationMap.Start:
                case FilterListNodeSerializationMap.End:
                    buffer.readUint32(); // ignore value
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }

        return 0;
    }
}
