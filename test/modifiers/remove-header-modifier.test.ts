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
    let headers: { name: string; value: string }[] = [];

    beforeEach(() => {
        headers = [
            {
                name: 'test_name',
                value: 'test_value',
            },
            {
                name: 'origin',
                value: 'forbidden_header',
            },
        ];
    });

    it('checks simple case', () => {
        const modifier = new RemoveHeaderModifier('test_name', false);

        const result = modifier.apply(headers, false);
        expect(result).toBeTruthy();
        expect(headers).toHaveLength(1);
        expect(headers.find((x) => x.name === 'test_name')).not.toBeDefined();
    });

    it('respects request/response flag', () => {
        let modifier = new RemoveHeaderModifier('test_name', false);

        let result = modifier.apply(headers, true);
        expect(result).toBeFalsy();
        expect(headers).toHaveLength(2);
        expect(headers.find((x) => x.name === 'test_name')).toBeDefined();

        modifier = new RemoveHeaderModifier('request:test_name', false);

        result = modifier.apply(headers, true);
        expect(result).toBeTruthy();
        expect(headers).toHaveLength(1);
        expect(headers.find((x) => x.name === 'test_name')).not.toBeDefined();
    });

    it('respects forbidden headers', () => {
        const modifier = new RemoveHeaderModifier('origin', false);

        const result = modifier.apply(headers, false);
        expect(result).toBeFalsy();
        expect(headers).toHaveLength(2);
        expect(headers.find((x) => x.name === 'origin')).toBeDefined();
    });
});
