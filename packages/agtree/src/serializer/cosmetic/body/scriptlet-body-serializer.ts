import { type ScriptletInjectionRuleBody } from '../../../nodes';
import { type OutputByteBuffer } from '../../../utils/output-byte-buffer';
import { NULL, UINT8_MAX } from '../../../utils/constants';
import { ParameterListSerializer } from '../../misc/parameter-list-serializer';
import { isUndefined } from '../../../utils/type-guards';
import { BaseSerializer } from '../../base-serializer';
import {
    AbpSnippetBodyMarshallingMap,
} from '../../../serialization-utils/cosmetic/body/abp-snippet-injection-body-common';
import { BinaryTypeMarshallingMap } from '../../../common/marshalling-common';

export class ScriptletBodySerializer extends BaseSerializer {
    /**
     * Serializes a hint rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     * @param frequentScriptletArgs Map of frequently used scriptlet names / arguments
     * and their serialization index (optional).
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
