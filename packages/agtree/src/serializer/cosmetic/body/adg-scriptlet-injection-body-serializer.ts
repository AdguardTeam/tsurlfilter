import { type OutputByteBuffer } from '../../../utils/output-byte-buffer';
import { type ScriptletInjectionRuleBody } from '../../../nodes';
import { BaseSerializer } from '../../base-serializer';
import { ScriptletBodySerializer } from './scriptlet-body-serializer';
import {
    FREQUENT_ADG_SCRIPTLET_ARGS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/body/adg-scriptlet-injection-body-common';

/**
 * `AdgScriptletInjectionBodyParser` is responsible for parsing the body of an AdGuard-style scriptlet rule.
 *
 * Please note that the parser will parse any scriptlet rule if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * example.com#%#//scriptlet('scriptlet0', 'arg0')
 * ```
 *
 * but it didn't check if the scriptlet `scriptlet0` actually supported by any adblocker.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#scriptlets}
 */
export class AdgScriptletInjectionBodySerializer extends BaseSerializer {
    /**
     * Serializes a scriptlet call body node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: ScriptletInjectionRuleBody, buffer: OutputByteBuffer): void {
        ScriptletBodySerializer.serialize(node, buffer, FREQUENT_ADG_SCRIPTLET_ARGS_SERIALIZATION_MAP);
    }
}