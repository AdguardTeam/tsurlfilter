import { describe, expect, it } from 'vitest';

import { type DomainItem } from '@adguard/agtree';

import { COMMA_SEPARATOR, DomainModifier } from '../../src/modifiers/domain-modifier';

describe('DomainModifier from DomainItem[]', () => {
    it('splits permitted and restricted, lowercased', () => {
        const items: DomainItem[] = [
            { value: 'Example.ORG', exception: false },
            { value: 'sub.example.org', exception: true },
        ];
        const m = new DomainModifier(items, COMMA_SEPARATOR);
        expect(m.permittedDomains).toEqual(['example.org']);
        expect(m.restrictedDomains).toEqual(['sub.example.org']);
    });

    it('matches the string constructor for the same input', () => {
        const fromString = new DomainModifier('example.org,~sub.example.org', COMMA_SEPARATOR);
        const fromItems = new DomainModifier(
            [{ value: 'example.org', exception: false }, { value: 'sub.example.org', exception: true }],
            COMMA_SEPARATOR,
        );
        expect(fromItems.permittedDomains).toEqual(fromString.permittedDomains);
        expect(fromItems.restrictedDomains).toEqual(fromString.restrictedDomains);
    });

    it('rejects non-tld wildcards like the AST path', () => {
        expect(() => new DomainModifier([{ value: 'exa*ple.org', exception: false }], COMMA_SEPARATOR))
            .toThrow(/Wildcards are only supported/);
    });
});
