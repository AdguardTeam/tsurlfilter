import { COMMA, PIPE, NULL } from '../../utils/constants';
import { type DomainList } from '../../nodes';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';
import { BaseSerializer } from '../base-serializer';
import { ListItemsSerializer } from './list-items-serializer';
import { DomainListMarshallingMap } from '../../serialization-utils/misc/domain-list-common';
import { BinaryTypeMarshallingMap } from '../../common/marshalling-common';

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
 * `DomainListParser` is responsible for parsing a domain list.
 *
 * @example
 * - If the rule is `example.com,~example.net##.ads`, the domain list is `example.com,~example.net`.
 * - If the rule is `ads.js^$script,domains=example.com|~example.org`, the domain list is `example.com|~example.org`.
 * This parser is responsible for parsing these domain lists.
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#elemhide_domains}
 */
export class DomainListSerializer extends BaseSerializer {
    /**
     * Serializes a domain list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: DomainList, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.DomainListNode);

        const separator = SEPARATOR_SERIALIZATION_MAP.get(node.separator);
        if (isUndefined(separator)) {
            throw new Error(`Invalid separator: ${node.separator}`);
        }
        buffer.writeUint8(DomainListMarshallingMap.Separator);
        buffer.writeUint8(separator);

        buffer.writeUint8(DomainListMarshallingMap.Children);
        ListItemsSerializer.serialize(node.children, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(DomainListMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(DomainListMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
