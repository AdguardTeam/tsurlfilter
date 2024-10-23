/* eslint-disable no-param-reassign */
import { type ParameterList, type Value } from '../../nodes';
import { NULL } from '../../utils/constants';
import { ValueDeserializer } from './value-deserializer';
import { BaseDeserializer } from '../base-deserializer';
import { ParameterListNodeMarshallingMap } from '../../serialization-utils/misc/parameter-list-common';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { BinaryTypeMarshallingMap } from '../../common/marshalling-common';

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
        buffer.assertUint8(BinaryTypeMarshallingMap.ParameterListNode);

        node.type = 'ParameterList';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ParameterListNodeMarshallingMap.Children:
                    node.children = new Array(buffer.readUint32());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        switch (buffer.peekUint8()) {
                            case BinaryTypeMarshallingMap.Null:
                                buffer.readUint8();
                                node.children[i] = null;
                                break;

                            case BinaryTypeMarshallingMap.ValueNode:
                                // eslint-disable-next-line max-len
                                ValueDeserializer.deserialize(buffer, node.children[i] = {} as Value, frequentValuesMap);
                                break;

                            default:
                                throw new Error(`Invalid child type: ${buffer.peekUint8()}`);
                        }
                    }
                    break;

                case ParameterListNodeMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ParameterListNodeMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
