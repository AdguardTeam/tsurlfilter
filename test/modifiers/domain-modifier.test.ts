import { DomainModifier } from '../../src/modifiers/domain-modifier';

describe('Domain modifier', () => {
    it('works in common cases', () => {
        expect(DomainModifier.isDomainOrSubdomainOfAny('example.org', ['example.org'])).toBeTruthy();

        expect(DomainModifier.isDomainOrSubdomainOfAny('example.com', ['example.org'])).toBeFalsy();
        expect(DomainModifier.isDomainOrSubdomainOfAny('', ['example.org'])).toBeFalsy();
        expect(DomainModifier.isDomainOrSubdomainOfAny('example.org', [])).toBeFalsy();
    });

    it('works in wildcard cases', () => {
        expect(DomainModifier.isDomainOrSubdomainOfAny('example.org', ['example.*', 'test.com'])).toBeTruthy();
        expect(DomainModifier.isDomainOrSubdomainOfAny('sub.example.org', ['example.*', 'test.com'])).toBeTruthy();
        expect(DomainModifier.isDomainOrSubdomainOfAny('example.org', ['one.*', 'example.*', 'test.com'])).toBeTruthy();

        expect(DomainModifier.isDomainOrSubdomainOfAny('example.com', ['test.*'])).toBeFalsy();
        expect(DomainModifier.isDomainOrSubdomainOfAny('subexample.org', ['example.*'])).toBeFalsy();
        expect(DomainModifier.isDomainOrSubdomainOfAny('example.eu.uk', ['example.*'])).toBeFalsy();
        expect(DomainModifier.isDomainOrSubdomainOfAny('example.org', ['sub.example.*', 'test.com'])).toBeFalsy();
        expect(DomainModifier.isDomainOrSubdomainOfAny('', ['example.*', 'test.com'])).toBeFalsy();
    });
});
