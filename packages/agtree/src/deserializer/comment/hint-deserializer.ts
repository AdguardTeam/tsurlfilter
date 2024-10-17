/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import {
    BinaryTypeMap,
    type ParameterList,
    type Value,
    type Hint,
} from '../../nodes';
import { BaseDeserializer } from '../base-deserializer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import {
    FREQUENT_HINTS_SERIALIZATION_MAP,
    FREQUENT_PLATFORMS_SERIALIZATION_MAP,
    HintNodeMarshallingMap,
} from '../../serialization-utils/comment/hint-common';
import { ValueDeserializer } from '../misc/value-deserializer';
import { ParameterListDeserializer } from '../misc/parameter-list-deserializer';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let FREQUENT_HINTS_DESERIALIZATION_MAP: Map<number, string>;
export const getFrequentHintsDeserializationMap = () => {
    if (!FREQUENT_HINTS_DESERIALIZATION_MAP) {
        FREQUENT_HINTS_DESERIALIZATION_MAP = new Map<number, string>(
            Array.from(FREQUENT_HINTS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return FREQUENT_HINTS_DESERIALIZATION_MAP;
};

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let FREQUENT_PLATFORMS_DESERIALIZATION_MAP: Map<number, string>;
export const getFrequentPlatformsDeserializationMap = () => {
    if (!FREQUENT_PLATFORMS_DESERIALIZATION_MAP) {
        FREQUENT_PLATFORMS_DESERIALIZATION_MAP = new Map<number, string>(
            Array.from(FREQUENT_PLATFORMS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return FREQUENT_PLATFORMS_DESERIALIZATION_MAP;
};

/**
 * `HintDeserializer` is responsible for deserializing AdGuard hints.
 *
 * @example
 * If the hint rule is
 * ```adblock
 * !+ NOT_OPTIMIZED PLATFORM(windows)
 * ```
 * then the hints are `NOT_OPTIMIZED` and `PLATFORM(windows)`, and this
 * class is responsible for parsing them. The rule itself is parsed by
 * the `HintRuleParser`, which uses this class to parse single hints.
 */
export class HintDeserializer extends BaseDeserializer {
    /**
     * Deserializes a hint node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<Hint>): void {
        buffer.assertUint8(BinaryTypeMap.HintNode);

        node.type = 'Hint';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HintNodeMarshallingMap.Name:
                    // eslint-disable-next-line max-len
                    ValueDeserializer.deserialize(buffer, node.name = {} as Value, getFrequentHintsDeserializationMap());
                    break;

                case HintNodeMarshallingMap.Params:
                    // eslint-disable-next-line max-len
                    ParameterListDeserializer.deserialize(buffer, node.params = {} as ParameterList, getFrequentPlatformsDeserializationMap());
                    break;

                case HintNodeMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case HintNodeMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
