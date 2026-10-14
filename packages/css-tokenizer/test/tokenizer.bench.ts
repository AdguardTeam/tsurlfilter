// @csstools/css-tokenizer ships its types under an `exports` map only, which
// does not resolve under the classic `node` module resolution this package uses.
// @ts-expect-error - types do not resolve under the classic `node` moduleResolution
import * as CssToolsCssTokenizer from '@csstools/css-tokenizer';
import * as CssToolsTokenizer from '@csstools/tokenizer';
import * as CssTree from 'css-tree';
// csslex ships `mod.d.ts` with a `types` field that resolves under the classic
// `node` moduleResolution, so no suppression is needed here.
import * as CssLex from 'csslex';
// @ts-expect-error - parse-css ships no type declarations
import * as ParseCss from 'parse-css/parse-css';
import { test } from 'vitest';

import { tokenize as adguardTokenize } from '../src';

// `css-tree` v3 exposes `tokenize` at runtime but ships no matching type declarations.
declare module 'css-tree' {
    export function tokenize(css: string, callback: (token: number, start: number, end: number) => void): void;
}

const CSS = 'a.button, .list > li:hover { color: #fff; margin: 0 auto; }'.repeat(200);

// Keep the timed work observable: each bench accumulates a cheap checksum here
// so the engine can't eliminate the closure, and we guard it after the run.
let resultSink = 0;

test('CSS tokenizer: adguard vs competitors', async ({ bench }) => {
    // parse-css logs while consuming numbers; silence it once outside the timed
    // region so the console stubbing isn't counted against parse-css only.
    const { log } = console;
    // eslint-disable-next-line no-console
    console.log = () => {};

    try {
        await bench.compare(
            bench('@adguard/css-tokenizer', () => {
                adguardTokenize(CSS, () => { resultSink += 1; });
            }),
            bench('css-tree', () => {
                CssTree.tokenize(CSS, () => { resultSink += 1; });
            }),
            bench('@csstools/css-tokenizer', () => {
                resultSink += CssToolsCssTokenizer.tokenize({ css: CSS }).length;
            }),
            bench('@csstools/tokenizer', () => {
                const tokenizer = CssToolsTokenizer.tokenize(CSS);

                while (!tokenizer().done) {
                    resultSink += 1;
                }
            }),
            bench('parse-css', () => {
                resultSink += ParseCss.tokenize(CSS).length;
            }),
            bench('csslex', () => {
                const iterator = CssLex.lex(CSS);

                while (!iterator.next().done) {
                    resultSink += 1;
                }
            }),
        );
    } finally {
        // eslint-disable-next-line no-console
        console.log = log;
    }

    if (resultSink === 0) {
        throw new Error('benchmark produced no observable results');
    }
});
