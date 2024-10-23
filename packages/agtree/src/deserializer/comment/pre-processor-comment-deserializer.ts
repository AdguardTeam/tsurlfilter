/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import type {
    AnyExpressionNode,
    ParameterList,
    PreProcessorCommentRule,
    Value,
} from '../../nodes';
import { CommentRuleType, RuleCategory } from '../../nodes';
import { BaseDeserializer } from '../base-deserializer';
import {
    FREQUENT_DIRECTIVES_SERIALIZATION_MAP,
    FREQUENT_PARAMS_SERIALIZATION_MAP,
    PreProcessorRuleMarshallingMap,
} from '../../marshalling-utils/comment/pre-processor-comment-common';
import { AdblockSyntax } from '../../utils/adblockers';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { ValueDeserializer } from '../misc/value-deserializer';
import { LogicalExpressionDeserializer } from '../misc/logical-expression-deserializer';
import { ParameterListDeserializer } from '../misc/parameter-list-deserializer';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';
import { getSyntaxDeserializationMap } from '../syntax-deserialization-map';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let FREQUENT_DIRECTIVES_DESERIALIZATION_MAP: Map<number, string>;
const getFrequentDirectivesDeserializationMap = (): Map<number, string> => {
    if (!FREQUENT_DIRECTIVES_DESERIALIZATION_MAP) {
        FREQUENT_DIRECTIVES_DESERIALIZATION_MAP = new Map<number, string>(
            Array.from(FREQUENT_DIRECTIVES_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }
    return FREQUENT_DIRECTIVES_DESERIALIZATION_MAP;
};

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let FREQUENT_PARAMS_DESERIALIZATION_MAP: Map<number, string>;
const getFrequentParamsDeserializationMap = () => {
    if (!FREQUENT_PARAMS_DESERIALIZATION_MAP) {
        FREQUENT_PARAMS_DESERIALIZATION_MAP = new Map<number, string>(
            Array.from(FREQUENT_PARAMS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }
    return FREQUENT_PARAMS_DESERIALIZATION_MAP;
};

/**
 * `PreProcessorCommentDeserializer` is responsible for deserializing preprocessor rules.
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
export class PreProcessorCommentDeserializer extends BaseDeserializer {
    /**
     * Deserializes a pre-processor comment node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<PreProcessorCommentRule>): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.PreProcessorCommentRuleNode);

        node.type = CommentRuleType.PreProcessorCommentRule;
        node.category = RuleCategory.Comment;
        node.syntax = AdblockSyntax.Common;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case PreProcessorRuleMarshallingMap.Name:
                    // eslint-disable-next-line max-len
                    ValueDeserializer.deserialize(buffer, node.name = {} as Value, getFrequentDirectivesDeserializationMap());
                    break;

                case PreProcessorRuleMarshallingMap.Syntax:
                    node.syntax = getSyntaxDeserializationMap().get(buffer.readUint8()) ?? AdblockSyntax.Common;
                    break;

                case PreProcessorRuleMarshallingMap.Params:
                    switch (buffer.peekUint8()) {
                        case BinaryTypeMarshallingMap.ValueNode:
                            ValueDeserializer.deserialize(buffer, node.params = {} as Value);
                            break;

                        case BinaryTypeMarshallingMap.ParameterListNode:
                            // eslint-disable-next-line max-len
                            ParameterListDeserializer.deserialize(buffer, node.params = {} as ParameterList, getFrequentParamsDeserializationMap());
                            break;

                        case BinaryTypeMarshallingMap.ExpressionOperatorNode:
                        case BinaryTypeMarshallingMap.ExpressionParenthesisNode:
                        case BinaryTypeMarshallingMap.ExpressionVariableNode:
                            LogicalExpressionDeserializer.deserialize(buffer, node.params = {} as AnyExpressionNode);
                            break;

                        default:
                            throw new Error(`Invalid binary type: ${prop}`);
                    }
                    break;

                case PreProcessorRuleMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case PreProcessorRuleMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
