import {
    BinaryTypeMap,
    type AnyExpressionNode,
    type ExpressionParenthesisNode,
    type ExpressionVariableNode,
    type ExpressionOperatorNode,
    OperatorValue,
} from '../../nodes';
import { NULL } from '../../utils/constants';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BaseSerializer } from '../base-serializer';

/**
 * Property map for binary serialization.
 */
const enum VariableNodeBinaryPropMap {
    Name = 1,
    FrequentName,
    Start,
    End,
}

/**
 * Property map for binary serialization.
 */
const enum OperatorNodeBinaryPropMap {
    Operator = 1,
    Left,
    Right,
    Start,
    End,
}

/**
 * Property map for binary serialization.
 */
const enum ParenthesisNodeBinaryPropMap {
    Expression = 1,
    Start,
    End,
}

/**
 * Possible node types in the logical expression.
 */
export const enum NodeType {
    Variable = 'Variable',
    Operator = 'Operator',
    Parenthesis = 'Parenthesis',
}

const OPERATOR_BINARY_MAP = new Map<OperatorValue, number>([
    [OperatorValue.Not, 0],
    [OperatorValue.And, 1],
    [OperatorValue.Or, 2],
]);

/**
 * Serialization map for known variables.
 */
const KNOWN_VARIABLES_MAP = new Map<string, number>([
    ['ext_abp', 0],
    ['ext_ublock', 1],
    ['ext_ubol', 2],
    ['ext_devbuild', 3],
    ['env_chromium', 4],
    ['env_edge', 5],
    ['env_firefox', 6],
    ['env_mobile', 7],
    ['env_safari', 8],
    ['env_mv3', 9],
    ['false', 10],
    ['cap_html_filtering', 11],
    ['cap_user_stylesheet', 12],
    ['adguard', 13],
    ['adguard_app_windows', 14],
    ['adguard_app_mac', 15],
    ['adguard_app_android', 16],
    ['adguard_app_ios', 17],
    ['adguard_ext_safari', 18],
    ['adguard_ext_chromium', 19],
    ['adguard_ext_firefox', 20],
    ['adguard_ext_edge', 21],
    ['adguard_ext_opera', 22],
    ['adguard_ext_android_cb', 23],
    // TODO: Add 'adguard_ext_chromium_mv3' to the list
]);

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
        buffer.writeUint8(BinaryTypeMap.ExpressionVariableNode);

        const frequentName = KNOWN_VARIABLES_MAP.get(node.name);
        if (!isUndefined(frequentName)) {
            buffer.writeUint8(VariableNodeBinaryPropMap.FrequentName);
            buffer.writeUint8(frequentName);
        } else {
            buffer.writeUint8(VariableNodeBinaryPropMap.Name);
            buffer.writeString(node.name);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(VariableNodeBinaryPropMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(VariableNodeBinaryPropMap.End);
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
        buffer.writeUint8(BinaryTypeMap.ExpressionParenthesisNode);

        buffer.writeUint8(ParenthesisNodeBinaryPropMap.Expression);
        LogicalExpressionSerializer.serialize(node.expression, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ParenthesisNodeBinaryPropMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ParenthesisNodeBinaryPropMap.End);
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
        buffer.writeUint8(BinaryTypeMap.ExpressionOperatorNode);

        buffer.writeUint8(OperatorNodeBinaryPropMap.Operator);
        const operatorBinary = OPERATOR_BINARY_MAP.get(node.operator);
        if (isUndefined(operatorBinary)) {
            throw new Error(`Unknown operator: ${node.operator}`);
        }
        buffer.writeUint8(operatorBinary);

        buffer.writeUint8(OperatorNodeBinaryPropMap.Left);
        LogicalExpressionSerializer.serialize(node.left, buffer);

        if (node.right) {
            buffer.writeUint8(OperatorNodeBinaryPropMap.Right);
            LogicalExpressionSerializer.serialize(node.right, buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(OperatorNodeBinaryPropMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(OperatorNodeBinaryPropMap.End);
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
