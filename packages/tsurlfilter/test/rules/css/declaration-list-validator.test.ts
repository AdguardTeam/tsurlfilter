import { validateDeclarationList } from '../../../src/rules/css/declaration-list-validator';

describe('Declaration list validator', () => {
    describe('validateDeclarationList - valid cases', () => {
        test.each([
            // [declarationList, isExtendedCss]
            ['{ padding: 0 }', false],
            ['{ padding: 0 !important; }', false],

            // complex cases
            ['{ padding: 0 !important; background: white; height: calc(1px + 2px); }', false],

            // extended CSS
            ['{ remove: true; }', true],
            ['{ padding: 0; remove: true; }', true],
        ])("should validate '%s' correctly", (declarationList, isExtendedCss) => {
            expect(validateDeclarationList(declarationList)).toEqual({
                isValid: true,
                isExtendedCss,
            });
        });
    });

    describe('validateDeclarationList - invalid cases', () => {
        // valid cases
        test.each([
            // [declarationList, isExtendedCss, errorMessage]
            // should detect forbidden functions
            ['{ background: url(http://example.org/image.png) }', false, "Using 'url()' is not allowed"],
            ['{ url(http://example.com) }', false, "Using 'url()' is not allowed"],
            ['{ url(\'http://example.com\') }', false, "Using 'url()' is not allowed"],
            ['{ url("http://example.com") }', false, "Using 'url()' is not allowed"],

            ['{ image-set(url(http://example.com) 1x) }', false, "Using 'image-set()' is not allowed"],
            ['{ image-set(url(\'http://example.com\') 1x) }', false, "Using 'image-set()' is not allowed"],
            ['{ image-set(url("http://example.com") 1x) }', false, "Using 'image-set()' is not allowed"],

            ['{ image(url(http://example.com)) }', false, "Using 'image()' is not allowed"],
            ['{ image(url(\'http://example.com\')) }', false, "Using 'image()' is not allowed"],
            ['{ image(url("http://example.com")) }', false, "Using 'image()' is not allowed"],

            // note: it detects the first forbidden function and stops
            ['{ cross-fade(url(http://example.com), url(http://example.com), 50%) }', false, "Using 'cross-fade()' is not allowed"],
            ['{ cross-fade(url(\'http://example.com\'), url(\'http://example.com\'), 50%) }', false, "Using 'cross-fade()' is not allowed"],
            ['{ cross-fade(url("http://example.com"), url("http://example.com"), 50%) }', false, "Using 'cross-fade()' is not allowed"],

            // should detect escaped hex characters
            ['{ \\75rl(http://example.com) }', false, "Using 'url()' is not allowed"],
            ['{ \\075\\072\\06C(http://example.com) }', false, "Using 'url()' is not allowed"],
            ['{ \\00075\\00072\\0006C(http://example.com) }', false, "Using 'url()' is not allowed"],

            // complicated cases
            ['{ color: red; height: calc(1px + 2px); background-image: url(http://example.net) }', false, "Using 'url()' is not allowed"],
            ['{ color: var(--test); height: calc(1px + 2px); background-image: -webkit-\\63ross-fade(url(http://example.net), url(http://example.net), 50%) }', false, "Using '-webkit-cross-fade()' is not allowed"],
        ])("should validate '%s' correctly", (declarationList, isExtendedCss, errorMessage) => {
            expect(validateDeclarationList(declarationList)).toEqual({
                isValid: false,
                isExtendedCss,
                errorMessage,
            });
        });
    });
});
