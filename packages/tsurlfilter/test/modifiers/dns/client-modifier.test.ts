import { describe, expect, it } from 'vitest';

import { ClientModifier } from '../../../src/modifiers/dns/client-modifier';
import { createNetworkRule } from '../../helpers/rule-creator';

describe('NetworkRule - client rules', () => {
    it('works if client modifier is correctly parsed', () => {
        let rule = createNetworkRule('@@||*^$client=127.0.0.1', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(ClientModifier);
        let modifier = rule.getAdvancedModifier() as ClientModifier;
        expect(modifier.getPermitted()).toHaveLength(1);
        expect(modifier.getPermitted()).toContain('127.0.0.1');

        rule = createNetworkRule("||example.org^$client='Frank\\'s laptop'", 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(ClientModifier);
        modifier = rule.getAdvancedModifier() as ClientModifier;
        expect(modifier.getPermitted()).toHaveLength(1);
        expect(modifier.getPermitted()).toContain("Frank's laptop");

        rule = createNetworkRule("||example.org^$client=~'Mary\\'s\\, John\\'s\\, and Boris\\'s laptops'", 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(ClientModifier);
        modifier = rule.getAdvancedModifier() as ClientModifier;
        expect(modifier.getPermitted()).toBeNull();
        expect(modifier.getRestricted()).toHaveLength(1);
        expect(modifier.getRestricted()).toContain("Mary's, John's, and Boris's laptops");

        rule = createNetworkRule('||example.org^$client=~Mom|~Dad|Kids', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(ClientModifier);
        modifier = rule.getAdvancedModifier() as ClientModifier;
        expect(modifier.getPermitted()).toHaveLength(1);
        expect(modifier.getPermitted()).toContain('Kids');
        expect(modifier.getRestricted()).toHaveLength(2);
        expect(modifier.getRestricted()).toContain('Mom');
        expect(modifier.getRestricted()).toContain('Dad');

        rule = createNetworkRule("||example.org^$client=~'Mom'|~'Dad'|'Kids'", 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(ClientModifier);
        modifier = rule.getAdvancedModifier() as ClientModifier;
        expect(modifier.getPermitted()).toHaveLength(1);
        expect(modifier.getPermitted()).toContain('Kids');
        expect(modifier.getRestricted()).toHaveLength(2);
        expect(modifier.getRestricted()).toContain('Mom');
        expect(modifier.getRestricted()).toContain('Dad');

        rule = createNetworkRule('||example.org^$client=192.168.0.0/24', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(ClientModifier);
        modifier = rule.getAdvancedModifier() as ClientModifier;
        expect(modifier.getPermitted()).toHaveLength(1);
        expect(modifier.getPermitted()).toContain('192.168.0.0/24');

        rule = createNetworkRule('||example.org^$client=fe80::/10', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(ClientModifier);
        modifier = rule.getAdvancedModifier() as ClientModifier;
        expect(modifier.getPermitted()).toHaveLength(1);
        expect(modifier.getPermitted()).toContain('fe80::/10');
    });
});
