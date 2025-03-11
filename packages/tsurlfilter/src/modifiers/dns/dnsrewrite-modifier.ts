import { type ModifierValue } from '@adguard/agtree';
import { isString } from '../../utils/string-utils';
import { type IAdvancedModifier } from '../advanced-modifier';

/**
 * The dnsrewrite response modifier allows replacing the content of the response
 * to the DNS request for the matching hosts.
 *
 * TODO: This modifier is not yet implemented.
 *
 * @see {@link https://github.com/AdguardTeam/AdGuardHome/wiki/Hosts-Blocklists#dnsrewrite}
 */
export class DnsRewriteModifier implements IAdvancedModifier {
    /**
     * Value.
     */
    private readonly value: string;

    /**
     * Constructor.
     *
     * @param value Modifier value.
     */
    constructor(value: string | ModifierValue) {
        if (isString(value)) {
            this.value = value;
        } else if (value.type === 'Value') {
            this.value = value.value;
        } else {
            throw new Error('Invalid $client rule: value must be a value');
        }
    }

    /**
     * Modifier value.
     *
     * @returns The value of the modifier.
     */
    getValue(): string {
        return this.value;
    }
}
