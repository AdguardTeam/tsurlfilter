/* eslint-disable no-param-reassign */
import { type ParameterList, BinaryTypeMap, type Value } from '../../nodes';
import { NULL } from '../../utils/constants';
import { ValueDeserializer } from './value-deserializer';
import { BaseDeserializer } from '../base-deserializer';
import { ParameterListNodeSerializationMap } from '../../serialization-utils/misc/parameter-list-common';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';

export class ParameterListDeserializer extends BaseDeserializer {
    /**
     * Deserializes a parameter list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentValuesMap Optional map of frequent values.
     * @throws If the binary data is malformed.
     */
    public static deserialize(
        buffer: InputByteBuffer,
        node: ParameterList,
        frequentValuesMap?: Map<number, string>,
    ): void {
        buffer.assertUint8(BinaryTypeMap.ParameterListNode);

        node.type = 'ParameterList';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ParameterListNodeSerializationMap.Children:
                    node.children = new Array(buffer.readUint32());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        switch (buffer.peekUint8()) {
                            case BinaryTypeMap.Null:
                                buffer.readUint8();
                                node.children[i] = null;
                                break;

                            case BinaryTypeMap.ValueNode:
                                // eslint-disable-next-line max-len
                                ValueDeserializer.deserialize(buffer, node.children[i] = {} as Value, frequentValuesMap);
                                break;

                            default:
                                throw new Error(`Invalid child type: ${buffer.peekUint8()}`);
                        }
                    }
                    break;

                case ParameterListNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ParameterListNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
