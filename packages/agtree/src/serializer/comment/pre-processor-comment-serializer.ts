import { NULL } from '../../utils/constants';
import type { PreProcessorCommentRule } from '../../nodes';
import { BinaryTypeMap, getSyntaxSerializationMap } from '../../nodes';
import { LogicalExpressionSerializer } from '../misc/logical-expression-serializer';
import { ParameterListSerializer } from '../misc/parameter-list-serializer';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueSerializer } from '../misc/value-serializer';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';
import { BaseSerializer } from '../base-serializer';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum PreProcessorRuleSerializationMap {
    Name = 1,
    Params,
    Syntax,
    Start,
    End,
}

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#preprocessor-directives}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#pre-parsing-directives}
 */
const FREQUENT_DIRECTIVES_SERIALIZATION_MAP = new Map<string, number>([
    ['if', 0],
    ['else', 1],
    ['endif', 2],
    ['include', 3],
    ['safari_cb_affinity', 4],
]);

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const FREQUENT_PARAMS_SERIALIZATION_MAP = new Map<string, number>([
    // safari_cb_affinity parameters
    ['general', 0],
    ['privacy', 1],
    ['social', 2],
    ['security', 3],
    ['other', 4],
    ['custom', 5],
    ['all', 6],
]);

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

        buffer.writeUint8(PreProcessorRuleSerializationMap.Name);
        ValueSerializer.serialize(node.name, buffer, FREQUENT_DIRECTIVES_SERIALIZATION_MAP);

        buffer.writeUint8(PreProcessorRuleSerializationMap.Syntax);
        buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);

        if (!isUndefined(node.params)) {
            buffer.writeUint8(PreProcessorRuleSerializationMap.Params);

            if (node.params.type === 'Value') {
                ValueSerializer.serialize(node.params, buffer);
            } else if (node.params.type === 'ParameterList') {
                ParameterListSerializer.serialize(node.params, buffer, FREQUENT_PARAMS_SERIALIZATION_MAP, true);
            } else {
                LogicalExpressionSerializer.serialize(node.params, buffer);
            }
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(PreProcessorRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(PreProcessorRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
