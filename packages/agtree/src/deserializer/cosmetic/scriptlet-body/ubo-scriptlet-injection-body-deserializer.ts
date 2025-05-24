import { type ScriptletInjectionRuleBody } from '../../../nodes/index.js';
import { BaseDeserializer } from '../../base-deserializer.js';
import { ScriptletBodyDeserializer } from './scriptlet-body-deserializer.js';
import {
    FREQUENT_UBO_SCRIPTLET_ARGS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/body/ubo-scriptlet-injection-body-common.js';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer.js';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let frequentUboScriptletArgsDeserializationMap: Map<number, string>;
export const getFrequentPlatformsDeserializationMap = () => {
    if (!frequentUboScriptletArgsDeserializationMap) {
        frequentUboScriptletArgsDeserializationMap = new Map<number, string>(
            Array.from(FREQUENT_UBO_SCRIPTLET_ARGS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return frequentUboScriptletArgsDeserializationMap;
};

/**
 * Deserializes uBlock Origin scriptlet injection body nodes from binary data.
 */
export class UboScriptletInjectionBodyDeserializer extends BaseDeserializer {
    /**
     * Deserializes a scriptlet call body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node to populate with deserialized data.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<ScriptletInjectionRuleBody>): void {
        ScriptletBodyDeserializer.deserialize(buffer, node, getFrequentPlatformsDeserializationMap());
    }
}
