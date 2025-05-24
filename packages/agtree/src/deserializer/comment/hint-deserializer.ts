/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants.js';
import { type ParameterList, type Value, type Hint } from '../../nodes/index.js';
import { BaseDeserializer } from '../base-deserializer.js';
import { type InputByteBuffer } from '../../utils/input-byte-buffer.js';
import {
    FREQUENT_HINTS_SERIALIZATION_MAP,
    FREQUENT_PLATFORMS_SERIALIZATION_MAP,
    HintNodeMarshallingMap,
} from '../../marshalling-utils/comment/hint-common.js';
import { ValueDeserializer } from '../misc/value-deserializer.js';
import { ParameterListDeserializer } from '../misc/parameter-list-deserializer.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let frequentHintsDeserializationMap: Map<number, string>;
const getFrequentHintsDeserializationMap = () => {
    if (!frequentHintsDeserializationMap) {
        frequentHintsDeserializationMap = new Map<number, string>(
            Array.from(FREQUENT_HINTS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return frequentHintsDeserializationMap;
};

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let frequentPlatformsDeserializationMap: Map<number, string>;
export const getFrequentPlatformsDeserializationMap = () => {
    if (!frequentPlatformsDeserializationMap) {
        frequentPlatformsDeserializationMap = new Map<number, string>(
            Array.from(FREQUENT_PLATFORMS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return frequentPlatformsDeserializationMap;
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
        buffer.assertUint8(BinaryTypeMarshallingMap.HintNode);

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
