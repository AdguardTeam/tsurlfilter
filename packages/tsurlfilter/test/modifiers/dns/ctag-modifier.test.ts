import { describe, expect, it } from 'vitest';

import { CtagModifier } from '../../../src/modifiers/dns/ctag-modifier';
import { createNetworkRule } from '../../helpers/rule-creator';

describe('NetworkRule - ctag rules', () => {
    it('works if ctag modifier is correctly parsed', () => {
        let rule = createNetworkRule('||example.org^$ctag=device_pc|device_phone', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(CtagModifier);
        let modifier = rule.getAdvancedModifier() as CtagModifier;
        expect(modifier.getPermitted()).toHaveLength(2);
        expect(modifier.getPermitted()).toContain('device_pc');
        expect(modifier.getPermitted()).toContain('device_phone');
        expect(modifier.getRestricted()).toBeNull();

        rule = createNetworkRule('||example.org^$ctag=~device_phone', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(CtagModifier);
        modifier = rule.getAdvancedModifier() as CtagModifier;
        expect(modifier.getPermitted()).toBeNull();
        expect(modifier.getRestricted()).toHaveLength(1);
        expect(modifier.getRestricted()).toContain('device_phone');

        rule = createNetworkRule('||example.org^$ctag=~device_phone|device_pc', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(CtagModifier);
        modifier = rule.getAdvancedModifier() as CtagModifier;
        expect(modifier.getPermitted()).toHaveLength(1);
        expect(modifier.getPermitted()).toContain('device_pc');
        expect(modifier.getRestricted()).toHaveLength(1);
        expect(modifier.getRestricted()).toContain('device_phone');

        expect(() => {
            createNetworkRule('||example.org^$ctag', 0);
        }).toThrow(new SyntaxError('Modifier cannot be empty'));

        expect(() => {
            createNetworkRule('||example.org^$ctag=|', 0);
        }).toThrow(new SyntaxError('Empty values specified in "|"'));

        expect(() => {
            createNetworkRule('||example.org^$ctag=device_phone|invalid', 0);
        }).toThrow(new Error('Invalid rule: Invalid ctag modifier'));
    });
});
