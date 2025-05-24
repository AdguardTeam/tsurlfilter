import {
    type AnyRule,
    type AnyCommentRule,
    type AnyCosmeticRule,
    type NetworkRule,
    type HostRule,
    type EmptyRule,
    type InvalidRule,
} from '../nodes/index.js';
import { BaseDeserializer } from './base-deserializer.js';
import { CommentRuleDeserializer } from './comment/comment-rule-deserializer.js';
import { CosmeticRuleDeserializer } from './cosmetic/cosmetic-rule-deserializer.js';
import { HostRuleDeserializer } from './network/host-rule-deserializer.js';
import { NetworkRuleDeserializer } from './network/network-rule-deserializer.js';
import { EmptyRuleDeserializer } from './empty-rule-deserializer.js';
import { InvalidRuleDeserializer } from './invalid-rule-deserializer.js';
import { type InputByteBuffer } from '../utils/input-byte-buffer.js';
import { BinaryTypeMarshallingMap } from '../marshalling-utils/misc/binary-type-common.js';

/**
 * `RuleDeserializer` is responsible for deserializing the rules.
 *
 * It automatically determines the category and syntax of the rule, so you can pass any kind of rule to it.
 */
export class RuleDeserializer extends BaseDeserializer {
    /**
     * Deserializes a rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<AnyRule>): void {
        // lookup instead of storing +1 byte
        const type = buffer.peekUint8();
        switch (type) {
            case BinaryTypeMarshallingMap.AgentRuleNode:
            case BinaryTypeMarshallingMap.HintRuleNode:
            case BinaryTypeMarshallingMap.PreProcessorCommentRuleNode:
            case BinaryTypeMarshallingMap.MetadataCommentRuleNode:
            case BinaryTypeMarshallingMap.ConfigCommentRuleNode:
            case BinaryTypeMarshallingMap.CommentRuleNode:
                CommentRuleDeserializer.deserialize(buffer, node as AnyCommentRule);
                break;

            case BinaryTypeMarshallingMap.ElementHidingRule:
            case BinaryTypeMarshallingMap.CssInjectionRule:
            case BinaryTypeMarshallingMap.ScriptletInjectionRule:
            case BinaryTypeMarshallingMap.HtmlFilteringRule:
            case BinaryTypeMarshallingMap.JsInjectionRule:
                CosmeticRuleDeserializer.deserialize(buffer, node as AnyCosmeticRule);
                break;

            case BinaryTypeMarshallingMap.NetworkRuleNode:
                NetworkRuleDeserializer.deserialize(buffer, node as NetworkRule);
                break;

            case BinaryTypeMarshallingMap.HostRuleNode:
                HostRuleDeserializer.deserialize(buffer, node as HostRule);
                break;

            case BinaryTypeMarshallingMap.EmptyRule:
                EmptyRuleDeserializer.deserialize(buffer, node as EmptyRule);
                break;

            case BinaryTypeMarshallingMap.InvalidRule:
                InvalidRuleDeserializer.deserialize(buffer, node as InvalidRule);
                break;

            default:
                throw new Error('Unknown rule category');
        }
    }
}
