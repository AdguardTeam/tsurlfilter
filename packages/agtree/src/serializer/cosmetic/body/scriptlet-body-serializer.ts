import { type ScriptletInjectionRuleBody } from '../../../nodes/index.js';
import { type OutputByteBuffer } from '../../../utils/output-byte-buffer.js';
import { NULL, UINT8_MAX } from '../../../utils/constants.js';
import { ParameterListSerializer } from '../../misc/parameter-list-serializer.js';
import { isUndefined } from '../../../utils/type-guards.js';
import { BaseSerializer } from '../../base-serializer.js';
import {
    AbpSnippetBodyMarshallingMap,
} from '../../../marshalling-utils/cosmetic/body/abp-snippet-injection-body-common.js';
import { BinaryTypeMarshallingMap } from '../../../marshalling-utils/misc/binary-type-common.js';

/**
 * Serializer for scriptlet injection rule body nodes.
 */
export class ScriptletBodySerializer extends BaseSerializer {
    /**
     * Serializes a scriptlet injection rule body node into a compact binary format.
     *
     * @param node The ScriptletInjectionRuleBody node to serialize.
     * @param buffer The OutputByteBuffer used for writing the binary data.
     * @param frequentScriptletArgs An optional map of frequently used scriptlet names and their arguments,
     * along with their corresponding serialization index.
     */
    public static serialize = (
        node: ScriptletInjectionRuleBody,
        buffer: OutputByteBuffer,
        frequentScriptletArgs?: Map<string, number>,
    ): void => {
        buffer.writeUint8(BinaryTypeMarshallingMap.ScriptletInjectionRuleBodyNode);

        const { length } = node.children;
        buffer.writeUint8(AbpSnippetBodyMarshallingMap.Children);

        // note: we store the count, because re-construction of the array is faster if we know the length
        if (length > UINT8_MAX) {
            throw new Error(`Too many scriptlet children: ${length}, the limit is ${UINT8_MAX}`);
        }
        buffer.writeUint8(length);
        for (let i = 0; i < length; i += 1) {
            ParameterListSerializer.serialize(node.children[i], buffer, frequentScriptletArgs);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(AbpSnippetBodyMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(AbpSnippetBodyMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    };
}
