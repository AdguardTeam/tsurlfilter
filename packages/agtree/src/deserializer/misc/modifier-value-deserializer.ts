/* eslint-disable no-param-reassign */
import { type Value, type DomainList, type ModifierValue } from '../../nodes';
import { ValueDeserializer } from './value-deserializer';
import { BaseDeserializer } from '../base-deserializer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';
import { DomainListDeserializer } from './domain-list-deserializer';

/**
 * `ModifierValueDeserializer` is responsible for deserializing modifiers.
 */
export class ModifierValueDeserializer extends BaseDeserializer {
    /**
     * Deserializes a modifier value node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentValuesMap Optional map of frequent values.
     */
    public static deserialize(
        buffer: InputByteBuffer,
        node: Partial<ModifierValue>,
        frequentValuesMap?: Map<number, string>,
    ): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.ModifierValueNode);

        const type = buffer.peekUint8();

        switch (type) {
            case BinaryTypeMarshallingMap.DomainListNode: {
                DomainListDeserializer.deserialize(
                    buffer,
                    node as DomainList,
                );
                break;
            }

            case BinaryTypeMarshallingMap.ValueNode: {
                ValueDeserializer.deserialize(
                    buffer,
                    node as Value,
                    frequentValuesMap,
                );
                break;
            }

            default: {
                throw new Error(`Unsupported modifier value type: ${type}`);
            }
        }
    }
}
