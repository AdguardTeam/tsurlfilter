import { type ScriptletInjectionRuleBody } from '../../../nodes';
import { BaseDeserializer } from '../../base-deserializer';
import { ScriptletBodyDeserializer } from './scriptlet-body-deserializer';
import {
    FREQUENT_ADG_SCRIPTLET_ARGS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/body/adg-scriptlet-injection-body-common';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let FREQUENT_ADG_SCRIPTLET_ARGS_DESERIALIZATION_MAP: Map<number, string>;

export const getFrequentPlatformsDeserializationMap = () => {
    if (!FREQUENT_ADG_SCRIPTLET_ARGS_DESERIALIZATION_MAP) {
        FREQUENT_ADG_SCRIPTLET_ARGS_DESERIALIZATION_MAP = new Map<number, string>(
            Array.from(FREQUENT_ADG_SCRIPTLET_ARGS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return FREQUENT_ADG_SCRIPTLET_ARGS_DESERIALIZATION_MAP;
};

export class AdgScriptletInjectionBodyDeserializer extends BaseDeserializer {
    /**
     * Deserializes a scriptlet call body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<ScriptletInjectionRuleBody>): void {
        ScriptletBodyDeserializer.deserialize(buffer, node, FREQUENT_ADG_SCRIPTLET_ARGS_DESERIALIZATION_MAP);
    }
}
