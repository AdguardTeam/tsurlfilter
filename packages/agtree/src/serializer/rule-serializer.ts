import { type AnyRule, RuleCategory, NetworkRuleType } from '../nodes';
import { type OutputByteBuffer } from '../utils/output-byte-buffer';
import { BaseSerializer } from './base-serializer';
import { CommentRuleSerializer } from './comment/comment-rule-serializer';
import { CosmeticRuleSerializer } from './cosmetic/cosmetic-rule-serializer';
import { HostRuleSerializer } from './network/host-rule-serializer';
import { NetworkRuleSerializer } from './network/network-rule-serializer';
import { EmptyRuleSerializer } from './empty-rule-serializer';
import { InvalidRuleSerializer } from './invalid-rule-serializer';

/**
 * `RuleSerializer` is responsible for serializing the rules.
 *
 * It automatically determines the category and syntax of the rule, so you can pass any kind of rule to it.
 */
export class RuleSerializer extends BaseSerializer {
    /**
     * Serializes a rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: AnyRule, buffer: OutputByteBuffer): void {
        switch (node.category) {
            case RuleCategory.Comment:
                CommentRuleSerializer.serialize(node, buffer);
                break;

            case RuleCategory.Cosmetic:
                CosmeticRuleSerializer.serialize(node, buffer);
                break;

            case RuleCategory.Network:
                switch (node.type) {
                    case NetworkRuleType.HostRule:
                        HostRuleSerializer.serialize(node, buffer);
                        break;
                    case NetworkRuleType.NetworkRule:
                        NetworkRuleSerializer.serialize(node, buffer);
                        break;
                    default:
                        throw new Error('Unknown network rule type');
                }
                break;

            case RuleCategory.Empty:
                EmptyRuleSerializer.serialize(node, buffer);
                break;

            case RuleCategory.Invalid:
                InvalidRuleSerializer.serialize(node, buffer);
                break;

            default:
                throw new Error('Unknown rule category');
        }
    }
}
