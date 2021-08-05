import { BaseValuesModifier } from '../values-modifier';

/**
 * The dnstype modifier allows specifying DNS request type on which this rule will be triggered.
 */
export class DnsTypeModifier extends BaseValuesModifier {
    /**
     * Constructor
     *
     * @param value
     */
    constructor(value: string) {
        super(value);

        if (this.permitted) {
            this.restricted = null;
        }
    }
}
