import { NetworkRule } from '../../../src/rules/network-rule';
import { DnsRewriteModifier } from '../../../src/modifiers/dns/dnsrewrite-modifier';

describe('NetworkRule - dnsrewrite rules', () => {
    it('works if dnsrewrite modifier is correctly parsed', () => {
        let rule = new NetworkRule('||example.com^$dnsrewrite=1.2.3.4', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsRewriteModifier);
        expect(rule.getAdvancedModifierValue()).toBe('1.2.3.4');

        rule = new NetworkRule('||example.com^$dnsrewrite=abcd::1234', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsRewriteModifier);
        expect(rule.getAdvancedModifierValue()).toBe('abcd::1234');

        rule = new NetworkRule('||example.com^$dnsrewrite=NOERROR;CNAME;example.net', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsRewriteModifier);
        expect(rule.getAdvancedModifierValue()).toBe('NOERROR;CNAME;example.net');

        rule = new NetworkRule('||example.com^$dnsrewrite=REFUSED;;', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsRewriteModifier);
        expect(rule.getAdvancedModifierValue()).toBe('REFUSED;;');
    });
});
