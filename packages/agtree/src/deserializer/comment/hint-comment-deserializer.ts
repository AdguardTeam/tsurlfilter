/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import {
    type HintCommentRule,
    BinaryTypeMap,
    CommentRuleType,
    getSyntaxDeserializationMap,
    type Hint,
    RuleCategory,
} from '../../nodes';
import { HintDeserializer } from './hint-deserializer';
import { AdblockSyntax } from '../../utils/adblockers';
import { BaseDeserializer } from '../base-deserializer';
import { HintRuleMarshallingMap } from '../../serialization-utils/comment/hint-comment-common';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';

/**
 * `HintCommentDeserializer` is responsible for deserializing AdGuard hint rules.
 *
 * @example
 * The following hint rule
 * ```adblock
 * !+ NOT_OPTIMIZED PLATFORM(windows)
 * ```
 * contains two hints: `NOT_OPTIMIZED` and `PLATFORM`.
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#hints}
 */
export class HintCommentDeserializer extends BaseDeserializer {
    /**
     * Deserializes a hint rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<HintCommentRule>): void {
        buffer.assertUint8(BinaryTypeMap.HintRuleNode);

        node.category = RuleCategory.Comment;
        node.type = CommentRuleType.HintCommentRule;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HintRuleMarshallingMap.Syntax:
                    node.syntax = getSyntaxDeserializationMap().get(buffer.readUint8()) ?? AdblockSyntax.Common;
                    break;

                case HintRuleMarshallingMap.Children:
                    node.children = new Array(buffer.readUint8());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        HintDeserializer.deserialize(buffer, node.children[i] = {} as Hint);
                    }
                    break;

                case HintRuleMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case HintRuleMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
