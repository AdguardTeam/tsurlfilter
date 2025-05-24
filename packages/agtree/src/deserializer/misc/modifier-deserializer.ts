/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants.js';
import { type Value, type Modifier } from '../../nodes/index.js';
import { ValueDeserializer } from './value-deserializer.js';
import { BaseDeserializer } from '../base-deserializer.js';
import {
    FREQUENT_MODIFIERS_SERIALIZATION_MAP,
    FREQUENT_REDIRECT_MODIFIERS_SERIALIZATION_MAP,
    ModifierNodeMarshallingMap,
} from '../../marshalling-utils/misc/modifier-common.js';
import { type InputByteBuffer } from '../../utils/input-byte-buffer.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * @note Only 256 values can be represented this way.
 */
let frequentModifiersDeserializationMap: Map<number, string>;
const getFrequentModifiersDeserializationMap = () => {
    if (!frequentModifiersDeserializationMap) {
        frequentModifiersDeserializationMap = new Map<number, string>(
            Array.from(FREQUENT_MODIFIERS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }
    return frequentModifiersDeserializationMap;
};

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let frequentValuesDeserializationMaps: Map<string, Map<number, string>>;
const getFrequentValuesDeserializationMaps = () => {
    if (!frequentValuesDeserializationMaps) {
        frequentValuesDeserializationMaps = new Map<string, Map<number, string>>(
            Array.from(
                FREQUENT_REDIRECT_MODIFIERS_SERIALIZATION_MAP,
                ([modifier, valueMap]) => [modifier, new Map(Array.from(valueMap, ([key, value]) => [value, key]))],
            ),
        );
    }
    return frequentValuesDeserializationMaps;
};

/**
 * `ModifierDeserializer` is responsible for deserializing modifiers.
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
        buffer.assertUint8(BinaryTypeMarshallingMap.ModifierNode);

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
