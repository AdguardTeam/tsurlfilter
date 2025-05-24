import { type ScriptletInjectionRuleBody } from '../../../nodes/index.js';
import { type OutputByteBuffer } from '../../../utils/output-byte-buffer.js';
import { BaseSerializer } from '../../base-serializer.js';
import { ScriptletBodySerializer } from './scriptlet-body-serializer.js';
import {
    FREQUENT_ABP_SNIPPET_ARGS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/body/abp-snippet-injection-body-common.js';

/**
 * `AbpSnippetInjectionBodySerializer` is responsible for serializing the body of an Adblock Plus-style snippet rule.
 *
 * Please note that the serializer will serialize any scriptlet rule if it is syntactically correct.
 * For example, it will serialize this:
 * ```adblock
 * example.com#$#snippet0 arg0
 * ```
 *
 * but it doesn't check if the scriptlet `snippet0` is actually supported by any adblocker.
 *
 * @see {@link https://help.eyeo.com/adblockplus/snippet-filters-tutorial}
 */
export class AbpSnippetInjectionBodySerializer extends BaseSerializer {
    /**
     * Serializes a scriptlet call body node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: ScriptletInjectionRuleBody, buffer: OutputByteBuffer): void {
        ScriptletBodySerializer.serialize(node, buffer, FREQUENT_ABP_SNIPPET_ARGS_SERIALIZATION_MAP);
    }
}
