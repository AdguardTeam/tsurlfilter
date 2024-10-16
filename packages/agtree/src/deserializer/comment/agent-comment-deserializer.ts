/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import {
    type Agent,
    type AgentCommentRule,
    BinaryTypeMap,
    CommentRuleType,
    RuleCategory,
} from '../../nodes';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { AdblockSyntax } from '../../utils/adblockers';
import { BaseDeserializer } from '../base-deserializer';
import { AgentRuleSerializationMap } from '../../serialization-utils/comment/agent-comment-common';
import { AgentDeserializer } from './agent-deserializer';

/**
 * `AgentCommentDeserializer` is responsible for deserializing an Adblock agent comments.
 * Adblock agent comment marks that the filter list is supposed to
 * be used by the specified ad blockers.
 *
 * @example
 *  - ```adblock
 *    [AdGuard]
 *    ```
 *  - ```adblock
 *    [Adblock Plus 2.0]
 *    ```
 *  - ```adblock
 *    [uBlock Origin]
 *    ```
 *  - ```adblock
 *    [uBlock Origin 1.45.3]
 *    ```
 *  - ```adblock
 *    [Adblock Plus 2.0; AdGuard]
 *    ```
 */
export class AgentCommentDeserializer extends BaseDeserializer {
    /**
     * Deserializes an agent list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<AgentCommentRule>): void {
        buffer.assertUint8(BinaryTypeMap.AgentRuleNode);

        node.type = CommentRuleType.AgentCommentRule;
        node.syntax = AdblockSyntax.Common;
        node.category = RuleCategory.Comment;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case AgentRuleSerializationMap.Children:
                    node.children = new Array(buffer.readUint8());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        AgentDeserializer.deserialize(buffer, node.children[i] = {} as Agent);
                    }
                    break;

                case AgentRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case AgentRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
