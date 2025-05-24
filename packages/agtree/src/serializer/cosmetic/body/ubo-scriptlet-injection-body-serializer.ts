import { type ScriptletInjectionRuleBody } from '../../../nodes/index.js';
import { type OutputByteBuffer } from '../../../utils/output-byte-buffer.js';
import { ScriptletBodySerializer } from './scriptlet-body-serializer.js';
import { BaseSerializer } from '../../base-serializer.js';
import {
    FREQUENT_UBO_SCRIPTLET_ARGS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/body/ubo-scriptlet-injection-body-common.js';

/**
 * `UboScriptletInjectionBodySerializer` is responsible for serializing the body of a uBlock-style scriptlet rule.
 *
 * Please note that the parser will parse any scriptlet rule if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * example.com##+js(scriptlet0, arg0)
 * ```
 *
 * but it didn't check if the scriptlet `scriptlet0` actually supported by any adblocker.
 *
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#scriptlet-injection}
 */
export class UboScriptletInjectionBodySerializer extends BaseSerializer {
    /**
     * Serializes a scriptlet call body node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: ScriptletInjectionRuleBody, buffer: OutputByteBuffer): void {
        ScriptletBodySerializer.serialize(node, buffer, FREQUENT_UBO_SCRIPTLET_ARGS_SERIALIZATION_MAP);
    }
}
