import {
    type AnyExpressionNode,
    type ExpressionParenthesisNode,
    type ExpressionVariableNode,
    type ExpressionOperatorNode,
} from '../../nodes';
import { NULL } from '../../utils/constants';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BaseSerializer } from '../base-serializer';
import {
    KNOWN_VARIABLES_MAP,
    LOGICAL_EXPRESSION_OPERATOR_MARSHALLING_MAP,
    OperatorNodeBinaryPropMarshallingMap,
    ParenthesisNodeBinaryPropMarshallingMap,
    VariableNodeBinaryPropMarshallingMap,
} from '../../serialization-utils/misc/logical-expression-common';
import { BinaryTypeMarshallingMap } from '../../common/marshalling-common';

/**
 * Possible node types in the logical expression.
 */
export const enum NodeType {
    Variable = 'Variable',
    Operator = 'Operator',
    Parenthesis = 'Parenthesis',
}

/**
 * `LogicalExpressionParser` is responsible for parsing logical expressions.
 *
 * @example
 * From the following rule:
 * ```adblock
 * !#if (adguard_ext_android_cb || adguard_ext_safari)
 * ```
 * this parser will parse the expression `(adguard_ext_android_cb || adguard_ext_safari)`.
 */
// TODO: Refactor this class
export class LogicalExpressionSerializer extends BaseSerializer {
    /**
     * Serializes a variable node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: create a common serialize / deserialize interface for such nodes (Variable, Value, Parameter, etc.)
    private static serializeVariableNode(node: ExpressionVariableNode, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.ExpressionVariableNode);

        const frequentName = KNOWN_VARIABLES_MAP.get(node.name);
        if (!isUndefined(frequentName)) {
            buffer.writeUint8(VariableNodeBinaryPropMarshallingMap.FrequentName);
            buffer.writeUint8(frequentName);
        } else {
            buffer.writeUint8(VariableNodeBinaryPropMarshallingMap.Name);
            buffer.writeString(node.name);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(VariableNodeBinaryPropMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(VariableNodeBinaryPropMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Serializes a parenthesis node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    private static serializeParenthesisNode(node: ExpressionParenthesisNode, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.ExpressionParenthesisNode);

        buffer.writeUint8(ParenthesisNodeBinaryPropMarshallingMap.Expression);
        LogicalExpressionSerializer.serialize(node.expression, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ParenthesisNodeBinaryPropMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ParenthesisNodeBinaryPropMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Serializes an operator node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    private static serializeOperatorNode(node: ExpressionOperatorNode, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.ExpressionOperatorNode);

        buffer.writeUint8(OperatorNodeBinaryPropMarshallingMap.Operator);
        const operatorBinary = LOGICAL_EXPRESSION_OPERATOR_MARSHALLING_MAP.get(node.operator);
        if (isUndefined(operatorBinary)) {
            throw new Error(`Unknown operator: ${node.operator}`);
        }
        buffer.writeUint8(operatorBinary);

        buffer.writeUint8(OperatorNodeBinaryPropMarshallingMap.Left);
        LogicalExpressionSerializer.serialize(node.left, buffer);

        if (node.right) {
            buffer.writeUint8(OperatorNodeBinaryPropMarshallingMap.Right);
            LogicalExpressionSerializer.serialize(node.right, buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(OperatorNodeBinaryPropMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(OperatorNodeBinaryPropMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Serializes a logical expression node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: AnyExpressionNode, buffer: OutputByteBuffer): void {
        switch (node.type) {
            case NodeType.Variable:
                LogicalExpressionSerializer.serializeVariableNode(node, buffer);
                break;
            case NodeType.Operator:
                LogicalExpressionSerializer.serializeOperatorNode(node, buffer);
                break;
            case NodeType.Parenthesis:
                LogicalExpressionSerializer.serializeParenthesisNode(node, buffer);
                break;

            default:
                throw new Error(`Unexpected node type: ${node.type}`);
        }

        buffer.writeUint8(NULL);
    }
}
