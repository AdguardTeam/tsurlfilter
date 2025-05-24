/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants.js';
import {
    type ConfigCommentRule,
    type ConfigNode,
    CommentRuleType,
    RuleCategory,
    type ParameterList,
    type Value,
} from '../../nodes/index.js';
import { BaseDeserializer } from '../base-deserializer.js';
import { type InputByteBuffer } from '../../utils/input-byte-buffer.js';
import {
    ConfigCommentRuleMarshallingMap,
    ConfigNodeMarshallingMap,
    FREQUENT_COMMANDS_SERIALIZATION_MAP,
} from '../../marshalling-utils/comment/config-comment-common.js';
import { AdblockSyntax } from '../../utils/adblockers.js';
import { ValueDeserializer } from '../misc/value-deserializer.js';
import { ParameterListDeserializer } from '../misc/parameter-list-deserializer.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let frequentCommandsDeserializationMap: Map<number, string>;
const getFrequentCommandsDeserializationMap = () => {
    if (!frequentCommandsDeserializationMap) {
        frequentCommandsDeserializationMap = new Map<number, string>(
            Array.from(FREQUENT_COMMANDS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return frequentCommandsDeserializationMap;
};

/**
 * `ConfigCommentDeserializer` is responsible for deserializing inline AGLint configuration rules.
 * Generally, the idea is inspired by ESLint inline configuration comments.
 *
 * @see {@link https://eslint.org/docs/latest/user-guide/configuring/rules#using-configuration-comments}
 */
export class ConfigCommentDeserializer extends BaseDeserializer {
    /**
     * Deserializes a metadata comment node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    private static deserializeConfigNode(buffer: InputByteBuffer, node: Partial<ConfigNode>): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.ConfigNode);

        node.type = 'ConfigNode';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ConfigNodeMarshallingMap.Value:
                    // note: it is safe to use JSON.parse here, because we serialized it with JSON.stringify
                    node.value = JSON.parse(buffer.readString());
                    break;

                case ConfigNodeMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ConfigNodeMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes a metadata comment node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<ConfigCommentRule>): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.ConfigCommentRuleNode);

        node.type = CommentRuleType.ConfigCommentRule;
        node.category = RuleCategory.Comment;
        node.syntax = AdblockSyntax.Common;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ConfigCommentRuleMarshallingMap.Marker:
                    ValueDeserializer.deserialize(buffer, node.marker = {} as Value);
                    break;

                case ConfigCommentRuleMarshallingMap.Command:
                    // eslint-disable-next-line max-len
                    ValueDeserializer.deserialize(buffer, node.command = {} as Value, getFrequentCommandsDeserializationMap());
                    break;

                case ConfigCommentRuleMarshallingMap.Params:
                    if (buffer.peekUint8() === BinaryTypeMarshallingMap.ConfigNode) {
                        ConfigCommentDeserializer.deserializeConfigNode(buffer, node.params = {} as ConfigNode);
                    } else {
                        ParameterListDeserializer.deserialize(buffer, node.params = {} as ParameterList);
                    }
                    break;

                case ConfigCommentRuleMarshallingMap.Comment:
                    ValueDeserializer.deserialize(buffer, node.comment = {} as Value);
                    break;

                case ConfigCommentRuleMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ConfigCommentRuleMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
