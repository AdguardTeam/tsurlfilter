/* eslint-disable no-param-reassign */
import { type Value } from '../../nodes/index.js';
import { EMPTY, NULL } from '../../utils/constants.js';
import { BaseDeserializer } from '../base-deserializer.js';
import { type InputByteBuffer } from '../../utils/input-byte-buffer.js';
import { ValueNodeMarshallingMap } from '../../marshalling-utils/misc/value-common.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

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
        buffer.assertUint8(BinaryTypeMarshallingMap.ValueNode);

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
