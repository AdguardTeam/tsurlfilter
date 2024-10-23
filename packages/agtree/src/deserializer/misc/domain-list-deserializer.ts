/* eslint-disable no-param-reassign */
import { COMMA, NULL } from '../../utils/constants';
import { type DomainList, type DomainListSeparator, ListNodeType } from '../../nodes';
import { BaseDeserializer } from '../base-deserializer';
import { DomainListMarshallingMap, SEPARATOR_SERIALIZATION_MAP } from '../../marshalling-utils/misc/domain-list-common';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { ListItemsDeserializer } from './list-items-deserializer';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';

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
 * `DomainListDeserializer` is responsible for deserializing a domain list.
 */
export class DomainListDeserializer extends BaseDeserializer {
    /**
     * Deserializes a modifier list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: DomainList): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.DomainListNode);

        node.type = ListNodeType.DomainList;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case DomainListMarshallingMap.Separator:
                    // eslint-disable-next-line max-len
                    node.separator = (getSeparatorDeserializationMap().get(buffer.readUint8()) ?? COMMA) as DomainListSeparator;
                    break;

                case DomainListMarshallingMap.Children:
                    ListItemsDeserializer.deserialize(buffer, node.children = []);
                    break;

                case DomainListMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case DomainListMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }
}
