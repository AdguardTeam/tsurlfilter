import { describe, expect, it } from 'vitest';

import { DnsTypeModifier } from '../../../src/modifiers/dns/dnstype-modifier';
import { createNetworkRule } from '../../helpers/rule-creator';

describe('NetworkRule - dnstype rules', () => {
    it('works if dnstype modifier is correctly parsed', () => {
        let rule = createNetworkRule('||example.org^$dnstype=value1|value2', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsTypeModifier);
        let modifier = rule.getAdvancedModifier() as DnsTypeModifier;
        expect(modifier.getPermitted()).toHaveLength(2);
        expect(modifier.getPermitted()).toContain('value1');
        expect(modifier.getPermitted()).toContain('value2');
        expect(modifier.getRestricted()).toBeNull();

        rule = createNetworkRule('||example.org^$dnstype=~value1|~value2', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsTypeModifier);
        modifier = rule.getAdvancedModifier() as DnsTypeModifier;
        expect(modifier.getPermitted()).toBeNull();
        expect(modifier.getRestricted()).toHaveLength(2);
        expect(modifier.getRestricted()).toContain('value1');
        expect(modifier.getRestricted()).toContain('value2');

        rule = createNetworkRule('||example.org^$dnstype=~value1|value2', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsTypeModifier);
        modifier = rule.getAdvancedModifier() as DnsTypeModifier;
        expect(modifier.getPermitted()).toHaveLength(1);
        expect(modifier.getPermitted()).toContain('value2');
        expect(modifier.getRestricted()).toBeNull();
    });
});
