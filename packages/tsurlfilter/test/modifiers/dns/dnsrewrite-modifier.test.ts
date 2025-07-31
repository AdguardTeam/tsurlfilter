import { describe, expect, it } from 'vitest';

import { DnsRewriteModifier } from '../../../src/modifiers/dns/dnsrewrite-modifier';
import { createNetworkRule } from '../../helpers/rule-creator';

describe('NetworkRule - dnsrewrite rules', () => {
    it('works if dnsrewrite modifier is correctly parsed', () => {
        let rule = createNetworkRule('||example.com^$dnsrewrite=1.2.3.4', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsRewriteModifier);
        expect(rule.getAdvancedModifierValue()).toBe('1.2.3.4');

        rule = createNetworkRule('||example.com^$dnsrewrite=abcd::1234', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsRewriteModifier);
        expect(rule.getAdvancedModifierValue()).toBe('abcd::1234');

        rule = createNetworkRule('||example.com^$dnsrewrite=NOERROR;CNAME;example.net', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsRewriteModifier);
        expect(rule.getAdvancedModifierValue()).toBe('NOERROR;CNAME;example.net');

        rule = createNetworkRule('||example.com^$dnsrewrite=REFUSED;;', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(DnsRewriteModifier);
        expect(rule.getAdvancedModifierValue()).toBe('REFUSED;;');
    });
});
