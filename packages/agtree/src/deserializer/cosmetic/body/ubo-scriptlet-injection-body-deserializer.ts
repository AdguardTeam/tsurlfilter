import { type ScriptletInjectionRuleBody } from '../../../nodes';
import { BaseDeserializer } from '../../base-deserializer';
import { ScriptletBodyDeserializer } from './scriptlet-body-deserializer';
import {
    FREQUENT_UBO_SCRIPTLET_ARGS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/body/ubo-scriptlet-injection-body-common';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let frequentUboScriptletArgsDeserializationMap: Map<number, string>;
// FIXME write documentation to all such functions that we use them this way to avoid side effects
export const getFrequentPlatformsDeserializationMap = () => {
    if (!frequentUboScriptletArgsDeserializationMap) {
        frequentUboScriptletArgsDeserializationMap = new Map<number, string>(
            Array.from(FREQUENT_UBO_SCRIPTLET_ARGS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return frequentUboScriptletArgsDeserializationMap;
};

export class UboScriptletInjectionBodyDeserializer extends BaseDeserializer {
    /**
     * Deserializes a scriptlet call body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<ScriptletInjectionRuleBody>): void {
        ScriptletBodyDeserializer.deserialize(buffer, node, getFrequentPlatformsDeserializationMap());
    }
}
