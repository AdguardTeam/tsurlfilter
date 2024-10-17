import { NULL } from '../../utils/constants';
import type { PreProcessorCommentRule } from '../../nodes';
import { BinaryTypeMap, getSyntaxSerializationMap } from '../../nodes';
import { LogicalExpressionSerializer } from '../misc/logical-expression-serializer';
import { ParameterListSerializer } from '../misc/parameter-list-serializer';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueSerializer } from '../misc/value-serializer';
import { isUndefined } from '../../utils/type-guards';
import { BaseSerializer } from '../base-serializer';
import {
    FREQUENT_DIRECTIVES_SERIALIZATION_MAP,
    FREQUENT_PARAMS_SERIALIZATION_MAP,
    PreProcessorRuleMarshallingMap,
} from '../../serialization-utils/comment/pre-processor-comment-common';

/**
 * `PreProcessorSerializer` is responsible for serializing preprocessor rules.
 * Pre-processor comments are special comments that are used to control the behavior of the filter list processor.
 * Please note that this parser only handles general syntax for now, and does not validate the parameters at
 * the parsing stage.
 *
 * @example
 * If your rule is
 * ```adblock
 * !#if (adguard)
 * ```
 * then the directive's name is `if` and its value is `(adguard)`, but the parameter list
 * is not parsed / validated further.
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#pre-processor-directives}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#pre-parsing-directives}
 */
export class PreProcessorCommentSerializer extends BaseSerializer {
    /**
     * Serializes a pre-processor comment node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: PreProcessorCommentRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.PreProcessorCommentRuleNode);

        buffer.writeUint8(PreProcessorRuleMarshallingMap.Name);
        ValueSerializer.serialize(node.name, buffer, FREQUENT_DIRECTIVES_SERIALIZATION_MAP);

        buffer.writeUint8(PreProcessorRuleMarshallingMap.Syntax);
        buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);

        if (!isUndefined(node.params)) {
            buffer.writeUint8(PreProcessorRuleMarshallingMap.Params);

            if (node.params.type === 'Value') {
                ValueSerializer.serialize(node.params, buffer);
            } else if (node.params.type === 'ParameterList') {
                ParameterListSerializer.serialize(node.params, buffer, FREQUENT_PARAMS_SERIALIZATION_MAP, true);
            } else {
                LogicalExpressionSerializer.serialize(node.params, buffer);
            }
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(PreProcessorRuleMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(PreProcessorRuleMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
