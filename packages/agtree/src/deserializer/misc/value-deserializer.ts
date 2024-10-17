/* eslint-disable no-param-reassign */
import { BinaryTypeMap, type Value } from '../../nodes';
import { EMPTY, NULL } from '../../utils/constants';
import { BaseDeserializer } from '../base-deserializer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { ValueNodeMarshallingMap } from '../../serialization-utils/misc/value-common';

/**
 * Value deserializer.
 */
export class ValueDeserializer extends BaseDeserializer {
    /**
     * Deserializes a value node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentValuesMap Optional map of frequent values.
     * @throws If the binary data is malformed.
     */
    public static deserialize(
        buffer: InputByteBuffer,
        node: Partial<Value>,
        frequentValuesMap?: Map<number, string>,
    ): void {
        buffer.assertUint8(BinaryTypeMap.ValueNode);

        node.type = 'Value';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ValueNodeMarshallingMap.Value:
                    node.value = buffer.readString();
                    break;

                case ValueNodeMarshallingMap.FrequentValue:
                    node.value = frequentValuesMap?.get(buffer.readUint8()) ?? EMPTY;
                    break;

                case ValueNodeMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ValueNodeMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
