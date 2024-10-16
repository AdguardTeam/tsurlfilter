/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import { BinaryTypeMap, type Value, type Modifier } from '../../nodes';
import { ValueDeserializer } from './value-deserializer';
import { BaseDeserializer } from '../base-deserializer';
import {
    FREQUENT_MODIFIERS_SERIALIZATION_MAP,
    FREQUENT_VALUES_SERIALIZATION_MAPS,
    ModifierNodeSerializationMap,
} from '../../serialization-utils/misc/modifier-common';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * @note Only 256 values can be represented this way.
 */
// FIXME
const FREQUENT_MODIFIERS_DESERIALIZATION_MAP = new Map<number, string>(
    Array.from(FREQUENT_MODIFIERS_SERIALIZATION_MAP, ([key, value]) => [value, key]),
);

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
// FIXME
const FREQUENT_VALUES_DESERIALIZATION_MAPS = new Map<string, Map<number, string>>(
    Array.from(
        FREQUENT_VALUES_SERIALIZATION_MAPS,
        ([modifier, valueMap]) => [modifier, new Map(Array.from(valueMap, ([key, value]) => [value, key]))],
    ),
);

/**
 * `ModifierSerializer` is responsible for serializing modifiers.
 *
 * @example
 * `match-case`, `~third-party`, `domain=example.com|~example.org`
 */
export class ModifierDeserializer extends BaseDeserializer {
    /**
     * Deserializes a modifier node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<Modifier>): void {
        buffer.assertUint8(BinaryTypeMap.ModifierNode);

        node.type = 'Modifier';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ModifierNodeSerializationMap.Name:
                    // eslint-disable-next-line max-len
                    ValueDeserializer.deserialize(buffer, node.name = {} as Value, FREQUENT_MODIFIERS_DESERIALIZATION_MAP);
                    break;

                case ModifierNodeSerializationMap.Value:
                    if (node.name) {
                        // eslint-disable-next-line max-len
                        ValueDeserializer.deserialize(buffer, node.value = {} as Value, FREQUENT_VALUES_DESERIALIZATION_MAPS.get(node.name.value));
                    } else {
                        ValueDeserializer.deserialize(buffer, node.value = {} as Value);
                    }
                    break;

                case ModifierNodeSerializationMap.Exception:
                    node.exception = buffer.readUint8() === 1;
                    break;

                case ModifierNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ModifierNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }
}
