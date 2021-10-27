import { NetworkRule } from '../../src';
import { RemoveHeaderModifier } from '../../src/modifiers/remove-header-modifier';

describe('NetworkRule - removeheader rules', () => {
    it('works if removeheader modifier is correctly parsed', () => {
        let rule = new NetworkRule('||example.org^$removeheader=header-name', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RemoveHeaderModifier);
        expect(rule.getAdvancedModifierValue()).toBe('header-name');

        rule = new NetworkRule('||example.org^$removeheader=request:header-name', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RemoveHeaderModifier);
        expect(rule.getAdvancedModifierValue()).toBe('request:header-name');

        rule = new NetworkRule('@@||example.org^$removeheader', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RemoveHeaderModifier);
        expect(rule.getAdvancedModifierValue()).toBe('');

        rule = new NetworkRule('@@||example.org^$removeheader=header', 0);
        expect(rule.getAdvancedModifier()).toBeInstanceOf(RemoveHeaderModifier);
        expect(rule.getAdvancedModifierValue()).toBe('header');

        expect(() => {
            new NetworkRule('||example.org^$removeheader', 0);
        }).toThrow(new SyntaxError('Invalid $removeheader rule, removeheader value must not be empty'));
    });
});

describe('Removeheader modifier - apply to headers', () => {
    it('checks simple case', () => {
        const modifier = new RemoveHeaderModifier('test_name', false);

        const result = modifier.getApplicableHeaderName(false);
        expect(result).toBe('test_name');
    });

    it('respects request/response flag', () => {
        let modifier = new RemoveHeaderModifier('test_name', false);

        let result = modifier.getApplicableHeaderName(true);
        expect(result).toBeNull();

        modifier = new RemoveHeaderModifier('request:test_name', false);

        result = modifier.getApplicableHeaderName(true);
        expect(result).toBe('test_name');
    });

    it('respects forbidden headers', () => {
        const modifier = new RemoveHeaderModifier('origin', false);

        const result = modifier.getApplicableHeaderName(false);
        expect(result).toBeNull();
    });
});
