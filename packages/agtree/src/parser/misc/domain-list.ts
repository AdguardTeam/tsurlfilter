/* eslint-disable no-param-reassign */
import { COMMA, PIPE, NULL } from '../../utils/constants';
import {
    type DomainList,
    ListNodeType,
    ListItemNodeType,
    BinaryTypeMap,
    type DomainListSeparator,
} from '../../nodes';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { deserializeListItems, parseListItems, serializeListItems } from './list-helpers';
import { defaultParserOptions } from '../options';
import { BaseParser } from '../interface';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the binary schema version
 *
 * @note Only 256 values can be represented this way.
 */
const enum DomainListSerializationMap {
    Separator = 1,
    Children,
    Start,
    End,
}

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const SEPARATOR_SERIALIZATION_MAP = new Map<string, number>([
    [COMMA, 0],
    [PIPE, 1],
]);

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let SEPARATOR_DESERIALIZATION_MAP:Map<number, string>;
const getSeparatorDeserializationMap = () => {
    if (!SEPARATOR_DESERIALIZATION_MAP) {
        SEPARATOR_DESERIALIZATION_MAP = new Map<number, string>(
            Array.from(SEPARATOR_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }
    return SEPARATOR_DESERIALIZATION_MAP;
};

/**
 * `DomainListParser` is responsible for parsing a domain list.
 *
 * @example
 * - If the rule is `example.com,~example.net##.ads`, the domain list is `example.com,~example.net`.
 * - If the rule is `ads.js^$script,domains=example.com|~example.org`, the domain list is `example.com|~example.org`.
 * This parser is responsible for parsing these domain lists.
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#elemhide_domains}
 */
export class DomainListParser extends BaseParser {
    /**
     * Parses a domain list, eg. `example.com,example.org,~example.org`
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @param separator Separator character (default: comma)
     *
     * @returns Domain list AST.
     * @throws An {@link AdblockSyntaxError} if the domain list is syntactically invalid.
     * @throws An {@link Error} if the options are invalid.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0, separator = COMMA): DomainList {
        if (separator !== COMMA && separator !== PIPE) {
            throw new Error(`Invalid separator: ${separator}`);
        }

        const result: DomainList = {
            type: ListNodeType.DomainList,
            separator,
            children: parseListItems(raw, options, baseOffset, separator, ListItemNodeType.Domain),
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }

    /**
     * Serializes a domain list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: DomainList, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.DomainListNode);

        const separator = SEPARATOR_SERIALIZATION_MAP.get(node.separator);
        if (isUndefined(separator)) {
            throw new Error(`Invalid separator: ${node.separator}`);
        }
        buffer.writeUint8(DomainListSerializationMap.Separator);
        buffer.writeUint8(separator);

        buffer.writeUint8(DomainListSerializationMap.Children);
        serializeListItems(node.children, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(DomainListSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(DomainListSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes a modifier list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: DomainList): void {
        buffer.assertUint8(BinaryTypeMap.DomainListNode);

        node.type = ListNodeType.DomainList;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case DomainListSerializationMap.Separator:
                    // eslint-disable-next-line max-len
                    node.separator = (getSeparatorDeserializationMap().get(buffer.readUint8()) ?? COMMA) as DomainListSeparator;
                    break;

                case DomainListSerializationMap.Children:
                    deserializeListItems(buffer, node.children = []);
                    break;

                case DomainListSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case DomainListSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }
}
