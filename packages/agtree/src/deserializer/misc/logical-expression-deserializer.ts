/* eslint-disable no-param-reassign */
import {
    BinaryTypeMap,
    type AnyExpressionNode,
    type ExpressionParenthesisNode,
    type ExpressionVariableNode,
    type ExpressionOperatorNode,
    type OperatorValue,
} from '../../nodes';
import {
    KNOWN_VARIABLES_MAP,
    LOGICAL_EXPRESSION_OPERATOR_MARSHALLING_MAP,
    OperatorNodeBinaryPropMarshallingMap,
    ParenthesisNodeBinaryPropMarshallingMap,
    VariableNodeBinaryPropMarshallingMap,
} from '../../serialization-utils/misc/logical-expression-common';
import { NodeType } from '../../serializer/misc/logical-expression-serializer';
import { NULL } from '../../utils/constants';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BaseDeserializer } from '../base-deserializer';

let LOGICAL_EXPRESSION_OPERATOR_MARSHALLING_MAP_REVERSE: Map<number, OperatorValue>;

const getOperatorBinaryMapReverse = () => {
    if (!LOGICAL_EXPRESSION_OPERATOR_MARSHALLING_MAP_REVERSE) {
        LOGICAL_EXPRESSION_OPERATOR_MARSHALLING_MAP_REVERSE = new Map<number, OperatorValue>(
            Array.from(LOGICAL_EXPRESSION_OPERATOR_MARSHALLING_MAP).map(([key, value]) => [value, key]),
        );
    }
    return LOGICAL_EXPRESSION_OPERATOR_MARSHALLING_MAP_REVERSE;
};

/**
 * Gets the string representation of the operator from the binary representation.
 *
 * @param binary Binary representation of the operator
 * @returns String representation of the operator
 * @throws If the operator is unknown
 */
const getOperatorOrFail = (binary: number): OperatorValue => {
    const operator = getOperatorBinaryMapReverse().get(binary);
    if (isUndefined(operator)) {
        throw new Error(`Unknown operator: ${binary}`);
    }
    return operator;
};

/**
 * Deserialization map for known variables.
 */
let KNOWN_VARIABLES_MAP_REVERSE: Map<number, string>;
const getKnownVariablesMapReverse = () => {
    if (!KNOWN_VARIABLES_MAP_REVERSE) {
        KNOWN_VARIABLES_MAP_REVERSE = new Map<number, string>(
            Array.from(KNOWN_VARIABLES_MAP).map(([key, value]) => [value, key]),
        );
    }
    return KNOWN_VARIABLES_MAP_REVERSE;
};

/**
 * Gets the frequent name of the variable from the binary representation.
 *
 * @param binary Binary representation of the variable
 * @returns Frequent name of the variable
 * @throws If the variable is unknown
 */
// FIXME: maybe not needed or not here
export const getFrequentNameOrFail = (binary: number): string => {
    const name = getKnownVariablesMapReverse().get(binary);
    if (isUndefined(name)) {
        throw new Error(`Unknown frequent name: ${binary}`);
    }
    return name;
};

/**
 * `LogicalExpressionDeserializer` is responsible for deserializing logical expressions.
 *
 * @example
 * From the following rule:
 * ```adblock
 * !#if (adguard_ext_android_cb || adguard_ext_safari)
 * ```
 * this parser will parse the expression `(adguard_ext_android_cb || adguard_ext_safari)`.
 */
// TODO: Refactor this class
export class LogicalExpressionDeserializer extends BaseDeserializer {
    /**
     * Deserializes a variable node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    private static deserializeVariableNode(buffer: InputByteBuffer, node: Partial<ExpressionVariableNode>): void {
        buffer.assertUint8(BinaryTypeMap.ExpressionVariableNode);

        node.type = NodeType.Variable;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case VariableNodeBinaryPropMarshallingMap.Name:
                    node.name = buffer.readString();
                    break;

                case VariableNodeBinaryPropMarshallingMap.FrequentName:
                    node.name = getFrequentNameOrFail(buffer.readUint8());
                    break;

                case VariableNodeBinaryPropMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case VariableNodeBinaryPropMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes a parenthesis node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    private static deserializeParenthesisNode(buffer: InputByteBuffer, node: Partial<ExpressionParenthesisNode>): void {
        buffer.assertUint8(BinaryTypeMap.ExpressionParenthesisNode);

        node.type = NodeType.Parenthesis;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ParenthesisNodeBinaryPropMarshallingMap.Expression:
                    LogicalExpressionDeserializer.deserialize(buffer, node.expression = {} as AnyExpressionNode);
                    break;

                case ParenthesisNodeBinaryPropMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ParenthesisNodeBinaryPropMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes an operator node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    private static deserializeOperatorNode(buffer: InputByteBuffer, node: Partial<ExpressionOperatorNode>): void {
        buffer.assertUint8(BinaryTypeMap.ExpressionOperatorNode);

        node.type = NodeType.Operator;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case OperatorNodeBinaryPropMarshallingMap.Operator:
                    node.operator = getOperatorOrFail(buffer.readUint8());
                    break;

                case OperatorNodeBinaryPropMarshallingMap.Left:
                    LogicalExpressionDeserializer.deserialize(buffer, node.left = {} as AnyExpressionNode);
                    break;

                case OperatorNodeBinaryPropMarshallingMap.Right:
                    LogicalExpressionDeserializer.deserialize(buffer, node.right = {} as AnyExpressionNode);
                    break;

                case OperatorNodeBinaryPropMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case OperatorNodeBinaryPropMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes a logical expression node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<AnyExpressionNode>): void {
        // note: we just do a simple lookahead here, because advancing the buffer is done in the
        // 'sub-deserialize' methods
        let type = buffer.peekUint8();
        while (type !== NULL) {
            switch (type) {
                case BinaryTypeMap.ExpressionVariableNode:
                    LogicalExpressionDeserializer.deserializeVariableNode(
                        buffer,
                        node as Partial<ExpressionVariableNode>,
                    );
                    break;

                case BinaryTypeMap.ExpressionOperatorNode:
                    LogicalExpressionDeserializer.deserializeOperatorNode(
                        buffer,
                        node as Partial<ExpressionOperatorNode>,
                    );
                    break;

                case BinaryTypeMap.ExpressionParenthesisNode:
                    LogicalExpressionDeserializer.deserializeParenthesisNode(
                        buffer,
                        node as Partial<ExpressionParenthesisNode>,
                    );
                    break;

                default:
                    throw new Error(`Unexpected node type: ${type}`);
            }

            type = buffer.peekUint8();
        }

        // consume NULL
        buffer.readUint8();
    }
}
