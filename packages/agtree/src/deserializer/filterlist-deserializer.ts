/* eslint-disable no-param-reassign */
import { type AnyRule, type FilterList } from '../nodes/index.js';
import { NULL } from '../utils/constants.js';
import { BaseDeserializer } from './base-deserializer.js';
import { RuleDeserializer } from './rule-deserializer.js';
import { type InputByteBuffer } from '../utils/input-byte-buffer.js';
import { FilterListNodeMarshallingMap } from '../marshalling-utils/filter-list-common.js';
import { BinaryTypeMarshallingMap } from '../marshalling-utils/misc/binary-type-common.js';

/**
 * Deserializer for filter lists.
 * Converts binary data into filter list nodes.
 */
export class FilterListDeserializer extends BaseDeserializer {
    /**
     * Deserializes a filter list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<FilterList>): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.FilterListNode);

        node.type = 'FilterList';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case FilterListNodeMarshallingMap.Children:
                    node.children = new Array(buffer.readUint32());
                    for (let i = 0; i < node.children.length; i += 1) {
                        RuleDeserializer.deserialize(buffer, node.children[i] = {} as AnyRule);
                    }
                    break;

                case FilterListNodeMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case FilterListNodeMarshallingMap.End:
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
        buffer.assertUint8(BinaryTypeMarshallingMap.FilterListNode); // filter list indicator
        let prop = buffer.readUint8();

        while (prop) {
            switch (prop) {
                case FilterListNodeMarshallingMap.Children:
                    return buffer.readUint32();

                case FilterListNodeMarshallingMap.Start:
                case FilterListNodeMarshallingMap.End:
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
