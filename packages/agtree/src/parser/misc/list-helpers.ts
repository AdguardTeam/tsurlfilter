/* eslint-disable no-param-reassign */
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import {
    COMMA,
    EMPTY,
    NEGATION_MARKER,
    NULL,
} from '../../utils/constants';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { StringUtils } from '../../utils/string';
import { isUndefined } from '../../utils/type-guards';
import { ListItemNodeType, type ListItem, BinaryTypeMap } from '../../nodes';
import { defaultParserOptions } from '../options';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the binary schema version
 *
 * @note Only 256 values can be represented this way.
 */
const enum ListItemSerializationMap {
    Exception = 1,
    Value,
    Start,
    End,
}

/**
 * Prefixes for error messages which are used for parsing of value lists.
 */
export const LIST_PARSE_ERROR_PREFIX = {
    EMPTY_ITEM: 'Empty value specified in the list',
    NO_MULTIPLE_NEGATION: 'Exception marker cannot be followed by another exception marker',
    NO_SEPARATOR_AFTER_NEGATION: 'Exception marker cannot be followed by a separator',
    NO_SEPARATOR_AT_THE_BEGINNING: 'Value list cannot start with a separator',
    NO_SEPARATOR_AT_THE_END: 'Value list cannot end with a separator',
    NO_WHITESPACE_AFTER_NEGATION: 'Exception marker cannot be followed by whitespace',
};

/**
 * Parses a `raw` modifier value which may be represented as a list of items separated by `separator`.
 * Needed for $app, $denyallow, $domain, $method.
 *
 * @param raw Raw input to parse.
 * @param options Global parser options.
 * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
 * @param separator Separator character (default: comma)
 * @param type Type of the list items (default: {@link ListItemNodeType.Domain}).
 * @template T Type of the list items.
 *
 * @returns List of parsed items.
 * @throws An {@link AdblockSyntaxError} if the list is syntactically invalid
 *
 * @example
 * - parses an app list — `com.example.app|Example.exe`
 * - parses a domain list — `example.com,example.org,~example.org` or `example.com|~example.org`
 * - parses a method list — `~post|~put`
 */
export const parseListItems = <T extends ListItemNodeType>(
    raw: string,
    options = defaultParserOptions,
    baseOffset = 0,
    separator = COMMA,
    type: T = ListItemNodeType.Unknown as T,
): ListItem<T>[] => {
    // Function body here
    const rawListItems: ListItem<T>[] = [];

    let offset = 0;

    // Skip whitespace before the list
    offset = StringUtils.skipWS(raw, offset);

    // If the first character is a separator, then the list is invalid
    // and no need to continue parsing
    if (raw[offset] === separator) {
        throw new AdblockSyntaxError(
            LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_BEGINNING,
            baseOffset + offset,
            baseOffset + raw.length,
        );
    }

    // If the last character is a separator, then the list item is invalid
    // and no need to continue parsing
    const realEndIndex = StringUtils.skipWSBack(raw);

    if (raw[realEndIndex] === separator) {
        throw new AdblockSyntaxError(
            LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
            baseOffset + realEndIndex,
            baseOffset + realEndIndex + 1,
        );
    }

    // Split list items by unescaped separators
    while (offset < raw.length) {
        // Skip whitespace before the list item
        offset = StringUtils.skipWS(raw, offset);

        let itemStart = offset;

        // Find the index of the first unescaped separator character
        const separatorStartIndex = StringUtils.findNextUnescapedCharacter(raw, separator, offset);

        const itemEnd = separatorStartIndex === -1
            ? StringUtils.skipWSBack(raw) + 1
            : StringUtils.skipWSBack(raw, separatorStartIndex - 1) + 1;

        const exception = raw[itemStart] === NEGATION_MARKER;

        // Skip the exception marker
        if (exception) {
            itemStart += 1;

            const item = raw[itemStart];

            // Exception marker cannot be followed by another exception marker
            if (item === NEGATION_MARKER) {
                throw new AdblockSyntaxError(
                    LIST_PARSE_ERROR_PREFIX.NO_MULTIPLE_NEGATION,
                    baseOffset + itemStart,
                    baseOffset + itemStart + 1,
                );
            }

            // Exception marker cannot be followed by a separator
            if (item === separator) {
                throw new AdblockSyntaxError(
                    LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AFTER_NEGATION,
                    baseOffset + itemStart,
                    baseOffset + itemStart + 1,
                );
            }

            // Exception marker cannot be followed by whitespace
            if (StringUtils.isWhitespace(item)) {
                throw new AdblockSyntaxError(
                    LIST_PARSE_ERROR_PREFIX.NO_WHITESPACE_AFTER_NEGATION,
                    baseOffset + itemStart,
                    baseOffset + itemStart + 1,
                );
            }
        }

        // List item can't be empty
        // Note we use '<=' instead of '===' because we have bidirectional trim
        // This is needed to handle cases like 'example.com, ,example.org'
        if (itemEnd <= itemStart) {
            throw new AdblockSyntaxError(
                LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                baseOffset + itemStart,
                baseOffset + raw.length,
            );
        }

        const listItem: ListItem<T> = {
            type,
            value: raw.slice(itemStart, itemEnd),
            exception,
        };

        if (options.isLocIncluded) {
            listItem.start = baseOffset + itemStart;
            listItem.end = baseOffset + itemEnd;
        }

        // Collect list item
        rawListItems.push(listItem);

        // Increment the offset to the next list item (or the end of the string)
        offset = separatorStartIndex === -1 ? raw.length : separatorStartIndex + 1;
    }

    return rawListItems;
};

/**
 * Generates a string representation of a list item.
 *
 * @param item List item to generate.
 * @template T Type of the list item.
 *
 * @returns String representation of the list item.
 */
const generateListItem = <T extends ListItemNodeType>(item: ListItem<T>): string => {
    return `${item.exception ? NEGATION_MARKER : EMPTY}${item.value}`;
};

/**
 * Generates a string representation of a list of items.
 *
 * @param items List of items to generate.
 * @param separator Separator character.
 * @template T Type of the list items.
 *
 * @returns String representation of the list of items.
 */
export const generateListItems = <T extends ListItemNodeType>(items: ListItem<T>[], separator: string): string => {
    return items.map(generateListItem).join(separator);
};

/**
 * Serializes a list item to binary format.
 *
 * @param item List item to serialize.
 * @param buffer Output byte buffer.
 * @template T Type of the list item.
 */
const serializeListItem = <T extends ListItemNodeType>(item: ListItem<T>, buffer: OutputByteBuffer): void => {
    switch (item.type) {
        case ListItemNodeType.App:
            buffer.writeUint8(BinaryTypeMap.AppNode);
            break;

        case ListItemNodeType.Domain:
            buffer.writeUint8(BinaryTypeMap.DomainNode);
            break;

        case ListItemNodeType.Method:
            buffer.writeUint8(BinaryTypeMap.MethodNode);
            break;

        case ListItemNodeType.StealthOption:
            buffer.writeUint8(BinaryTypeMap.StealthOptionNode);
            break;

        default:
            throw new Error(`Invalid list item type: ${item.type}`);
    }

    buffer.writeUint8(ListItemSerializationMap.Exception);
    buffer.writeUint8(item.exception ? 1 : 0);

    buffer.writeUint8(ListItemSerializationMap.Value);
    buffer.writeString(item.value);

    if (!isUndefined(item.start)) {
        buffer.writeUint8(ListItemSerializationMap.Start);
        buffer.writeUint32(item.start);
    }

    if (!isUndefined(item.end)) {
        buffer.writeUint8(ListItemSerializationMap.End);
        buffer.writeUint32(item.end);
    }

    buffer.writeUint8(NULL);
};

/**
 * Deserializes a list item from binary format.
 *
 * @param buffer Input byte buffer.
 * @param node Partial list item to deserialize.
 * @template T Type of the list item.
 */
const deserializeListItem = <T extends ListItemNodeType>(buffer: InputByteBuffer, node: Partial<ListItem<T>>): void => {
    const type = buffer.readUint8();

    switch (type) {
        case BinaryTypeMap.AppNode:
            node.type = ListItemNodeType.App as T;
            break;

        case BinaryTypeMap.DomainNode:
            node.type = ListItemNodeType.Domain as T;
            break;

        case BinaryTypeMap.MethodNode:
            node.type = ListItemNodeType.Method as T;
            break;

        case BinaryTypeMap.StealthOptionNode:
            node.type = ListItemNodeType.StealthOption as T;
            break;

        default:
            throw new Error(`Invalid list item type: ${type}`);
    }

    let prop = buffer.readUint8();
    while (prop !== NULL) {
        switch (prop) {
            case ListItemSerializationMap.Exception:
                node.exception = buffer.readUint8() === 1;
                break;

            case ListItemSerializationMap.Value:
                node.value = buffer.readString();
                break;

            case ListItemSerializationMap.Start:
                node.start = buffer.readUint32();
                break;

            case ListItemSerializationMap.End:
                node.end = buffer.readUint32();
                break;

            default:
                throw new Error(`Invalid property: ${type}`);
        }

        prop = buffer.readUint8();
    }
};

/**
 * Serializes a list of items to binary format.
 *
 * @param items List of items to serialize.
 * @param buffer Output byte buffer.
 * @template T Type of the list items.
 */
export const serializeListItems = <T extends ListItemNodeType>(
    items: ListItem<T>[],
    buffer: OutputByteBuffer,
): void => {
    const { length } = items;
    buffer.writeUint16(length);

    for (let i = 0; i < length; i += 1) {
        serializeListItem(items[i], buffer);
    }
};

/**
 * Deserializes a list of items from binary format.
 *
 * @param buffer Input byte buffer.
 * @param items Partial list of items to deserialize.
 * @template T Type of the list items.
 */
export const deserializeListItems = <T extends ListItemNodeType>(
    buffer: InputByteBuffer,
    items: Partial<ListItem<T>>[],
): void => {
    const length = buffer.readUint16();
    items.length = length;

    for (let i = 0; i < length; i += 1) {
        deserializeListItem(buffer, items[i] = {});
    }
};
