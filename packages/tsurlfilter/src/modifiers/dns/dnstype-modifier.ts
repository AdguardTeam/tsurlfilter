import { type ModifierValue } from '@adguard/agtree';
import { isString } from '../../utils/string-utils';
import { BaseValuesModifier } from '../values-modifier';

/**
 * The `$dnstype` modifier allows specifying DNS request type on which this rule will be triggered.
 */
export class DnsTypeModifier extends BaseValuesModifier {
    /**
     * Constructor.
     *
     * @param value The value used to initialize the modifier.
     */
    constructor(value: string | ModifierValue) {
        let rawValue;

        if (isString(value)) {
            rawValue = value;
        } else if (value.type === 'Value') {
            rawValue = value.value;
        } else {
            throw new Error('Invalid $client rule: value must be a value');
        }

        super(rawValue);

        if (this.permitted) {
            this.restricted = null;
        }
    }
}
