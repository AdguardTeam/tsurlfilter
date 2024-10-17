/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import { BinaryTypeMap, type Value, type Modifier } from '../../nodes';
import { ValueDeserializer } from './value-deserializer';
import { BaseDeserializer } from '../base-deserializer';
import {
    FREQUENT_MODIFIERS_SERIALIZATION_MAP,
    FREQUENT_VALUES_SERIALIZATION_MAPS,
    ModifierNodeMarshallingMap,
} from '../../serialization-utils/misc/modifier-common';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * @note Only 256 values can be represented this way.
 */
let FREQUENT_MODIFIERS_DESERIALIZATION_MAP: Map<number, string>;
const getFrequentModifiersDeserializationMap = () => {
    if (!FREQUENT_MODIFIERS_DESERIALIZATION_MAP) {
        FREQUENT_MODIFIERS_DESERIALIZATION_MAP = new Map<number, string>(
            Array.from(FREQUENT_MODIFIERS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }
    return FREQUENT_MODIFIERS_DESERIALIZATION_MAP;
};

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let FREQUENT_VALUES_DESERIALIZATION_MAPS: Map<string, Map<number, string>>;
const getFrequentValuesDeserializationMaps = () => {
    if (!FREQUENT_VALUES_DESERIALIZATION_MAPS) {
        FREQUENT_VALUES_DESERIALIZATION_MAPS = new Map<string, Map<number, string>>(
            Array.from(
                FREQUENT_VALUES_SERIALIZATION_MAPS,
                ([modifier, valueMap]) => [modifier, new Map(Array.from(valueMap, ([key, value]) => [value, key]))],
            ),
        );
    }
    return FREQUENT_VALUES_DESERIALIZATION_MAPS;
};

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
                case ModifierNodeMarshallingMap.Name:
                    // eslint-disable-next-line max-len
                    ValueDeserializer.deserialize(buffer, node.name = {} as Value, getFrequentModifiersDeserializationMap());
                    break;

                case ModifierNodeMarshallingMap.Value:
                    if (node.name) {
                        // eslint-disable-next-line max-len
                        ValueDeserializer.deserialize(buffer, node.value = {} as Value, getFrequentValuesDeserializationMaps().get(node.name.value));
                    } else {
                        ValueDeserializer.deserialize(buffer, node.value = {} as Value);
                    }
                    break;

                case ModifierNodeMarshallingMap.Exception:
                    node.exception = buffer.readUint8() === 1;
                    break;

                case ModifierNodeMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ModifierNodeMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }
}
