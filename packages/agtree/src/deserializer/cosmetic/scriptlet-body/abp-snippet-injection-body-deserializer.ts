import { type ScriptletInjectionRuleBody } from '../../../nodes/index.js';
import { BaseDeserializer } from '../../base-deserializer.js';
import { ScriptletBodyDeserializer } from './scriptlet-body-deserializer.js';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer.js';
import {
    FREQUENT_ABP_SNIPPET_ARGS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/body/abp-snippet-injection-body-common.js';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let frequentAbpSnippetArgsDeserializationMap: Map<number, string>;
const getFrequentAbpSnippetArgsDeserializationMap = () => {
    if (!frequentAbpSnippetArgsDeserializationMap) {
        frequentAbpSnippetArgsDeserializationMap = new Map<number, string>(
            Array.from(FREQUENT_ABP_SNIPPET_ARGS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return frequentAbpSnippetArgsDeserializationMap;
};

/**
 * Deserializer for ABP snippet injection rule body nodes.
 * Converts binary data into a structured format using a map of frequently used arguments.
 */
export class AbpSnippetInjectionBodyDeserializer extends BaseDeserializer {
    /**
     * Deserializes a scriptlet call body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<ScriptletInjectionRuleBody>): void {
        ScriptletBodyDeserializer.deserialize(buffer, node, getFrequentAbpSnippetArgsDeserializationMap());
    }
}
