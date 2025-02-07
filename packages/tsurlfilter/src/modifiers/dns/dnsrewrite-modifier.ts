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
    constructor(value: string) {
        this.value = value;
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
