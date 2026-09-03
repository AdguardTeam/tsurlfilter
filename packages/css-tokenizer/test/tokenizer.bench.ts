// @csstools/css-tokenizer ships its types under an `exports` map only, which
// does not resolve under the classic `node` module resolution this package uses.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as CssToolsCssTokenizer from '@csstools/css-tokenizer';
import * as CssToolsTokenizer from '@csstools/tokenizer';
import * as CssTree from 'css-tree';
// csslex ships a minimal `mod.d.ts` that does not resolve through its `exports` map.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as cssLex from 'csslex';
// parse-css ships no type declarations.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as parseCss from 'parse-css/parse-css';
import { test } from 'vitest';

import { tokenize as adguardTokenize } from '../src';

// `css-tree` v3 exposes `tokenize` at runtime but ships no matching type declarations.
declare module 'css-tree' {
    export function tokenize(css: string, callback: (token: number, start: number, end: number) => void): void;
}

const CSS = 'a.button, .list > li:hover { color: #fff; margin: 0 auto; }'.repeat(200);

test('CSS tokenizer: adguard vs competitors', async ({ bench }) => {
    await bench.compare(
        bench('@adguard/css-tokenizer', () => {
            adguardTokenize(CSS, () => {});
        }),
        bench('css-tree', () => {
            CssTree.tokenize(CSS, () => {});
        }),
        bench('@csstools/css-tokenizer', () => {
            CssToolsCssTokenizer.tokenize({ css: CSS });
        }),
        bench('@csstools/tokenizer', () => {
            const tokenizer = CssToolsTokenizer.tokenize(CSS);

            while (!tokenizer().done) {
                // Consume all tokens.
            }
        }),
        bench('parse-css', () => {
            const { log } = console;
            // parse-css logs while consuming numbers; silence it for the benchmark.
            // eslint-disable-next-line no-console
            console.log = () => {};

            try {
                parseCss.tokenize(CSS);
            } finally {
                // eslint-disable-next-line no-console
                console.log = log;
            }
        }),
        bench('csslex', () => {
            Array.from(cssLex.lex(CSS));
        }),
    );
});
