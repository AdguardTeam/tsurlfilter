import { type ScriptletInjectionRuleBody } from '../../../nodes/index.js';
import { BaseDeserializer } from '../../base-deserializer.js';
import { ScriptletBodyDeserializer } from './scriptlet-body-deserializer.js';
import {
    FREQUENT_ADG_SCRIPTLET_ARGS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/body/adg-scriptlet-injection-body-common.js';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer.js';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let frequentAdgScriptletArgsDeserializationMap: Map<number, string>;
const getFrequentAdgScriptletArgsDeserializationMap = () => {
    if (!frequentAdgScriptletArgsDeserializationMap) {
        frequentAdgScriptletArgsDeserializationMap = new Map<number, string>(
            Array.from(FREQUENT_ADG_SCRIPTLET_ARGS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return frequentAdgScriptletArgsDeserializationMap;
};

/**
 * Deserializer for AdGuard scriptlet injection body nodes.
 * Converts binary data into a structured scriptlet call body node specific to AdGuard,
 * using a predefined deserialization map for frequently used scriptlet arguments.
 */
export class AdgScriptletInjectionBodyDeserializer extends BaseDeserializer {
    /**
     * Deserializes a scriptlet call body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<ScriptletInjectionRuleBody>): void {
        ScriptletBodyDeserializer.deserialize(buffer, node, getFrequentAdgScriptletArgsDeserializationMap());
    }
}
