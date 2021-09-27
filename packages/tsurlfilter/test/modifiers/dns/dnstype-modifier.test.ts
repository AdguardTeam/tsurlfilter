import { NetworkRule } from '../../../src/rules/network-rule';
import { DnsTypeModifier } from '../../../src/modifiers/dns/dnstype-modifier';

describe('NetworkRule - dnstype rules', () => {
    it('works if dnstype modifier is correctly parsed', () => {
        let rule = new NetworkRule('||example.org^$dnstype=value1|value2', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsTypeModifier);
        let modifier = rule.getAdvancedModifier() as DnsTypeModifier;
        expect(modifier.getPermitted()).toHaveLength(2);
        expect(modifier.getPermitted()).toContain('value1');
        expect(modifier.getPermitted()).toContain('value2');
        expect(modifier.getRestricted()).toBeNull();

        rule = new NetworkRule('||example.org^$dnstype=~value1|~value2', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsTypeModifier);
        modifier = rule.getAdvancedModifier() as DnsTypeModifier;
        expect(modifier.getPermitted()).toBeNull();
        expect(modifier.getRestricted()).toHaveLength(2);
        expect(modifier.getRestricted()).toContain('value1');
        expect(modifier.getRestricted()).toContain('value2');

        rule = new NetworkRule('||example.org^$dnstype=~value1|value2', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsTypeModifier);
        modifier = rule.getAdvancedModifier() as DnsTypeModifier;
        expect(modifier.getPermitted()).toHaveLength(1);
        expect(modifier.getPermitted()).toContain('value2');
        expect(modifier.getRestricted()).toBeNull();
    });
});
