/**
 * @file You can specify the tokenizers to benchmark in this file
 *
 * @see {@link https://github.com/stylelint/css-parser/issues/1}
 */

import * as CssTree from 'css-tree';
import * as CssToolsCssTokenizer from '@csstools/css-tokenizer';
import * as CssToolsTokenizer from '@csstools/tokenizer';
// Note: this module has no types
import * as parseCss from 'parse-css/parse-css';
// Note: this is an ESM package, but we use esbuild to make a bundle on the fly before running the benchmark
// so it works fine
import * as cssLex from 'csslex';

// eslint-disable-next-line import/no-relative-packages, import/extensions
import * as AdGuardCssTokenizer from '../../dist/csstokenizer';
import { type TokenizerConfigs } from '../common/interfaces';

// Add `tokenize` function to the `CssTree` module
declare module 'css-tree' {
    export function tokenize(css: string, callback: (token: number, start: number, end: number) => void): void;
}

/**
 * Tokenizers to benchmark.
 *
 * @note `tokenize` function should return the number of tokens.
 */
export const tokenizerConfigs: TokenizerConfigs = {
    '@adguard/css-tokenizer': {
        url: 'https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer',
        tokenize: (css: string) => {
            let count = 0;
            AdGuardCssTokenizer.tokenize(css, () => { count += 1; });
            return count;
        },
    },
    // TODO: Benchmark extended tokenizer
    // Note: do not run both @adguard/css-tokenizer and @adguard/css-tokenizer (extended) at the same time
    // '@adguard/css-tokenizer (extended)': {
    //     url: 'https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer',
    //     tokenize: (css: string) => {
    //         let count = 0;
    //         AdGuardCssTokenizer.tokenizeExtended(css, () => { count += 1; });
    //         return count;
    //     },
    // },
    'css-tree': {
        url: 'https://github.com/csstree/csstree',
        tokenize: (css: string) => {
            let count = 0;
            CssTree.tokenize(css, () => { count += 1; });
            return count;
        },
    },
    '@csstools/tokenizer': {
        url: 'https://github.com/csstools/tokenizer',
        tokenize: (css: string) => {
            let count = 1; // first token
            const tokenizer = CssToolsTokenizer.tokenize(css);

            while (!tokenizer().done) {
                count += 1;
            }

            return count;
        },
    },
    '@csstools/css-tokenizer': {
        url: 'https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer',
        tokenize: (css: string) => {
            return CssToolsCssTokenizer.tokenize({ css }).length;
        },
    },
    'parse-css': {
        url: 'https://github.com/tabatkins/parse-css',
        tokenize: (css: string) => {
            // This tokenizer uses console.log while consuming numbers
            const { log } = console;
            // eslint-disable-next-line no-console
            console.log = () => {};

            let tokens = 0;

            try {
                // Run the tokenizer
                tokens = parseCss.tokenize(css).length;
            } finally {
                // Restore console.log
                // eslint-disable-next-line no-console
                console.log = log;
            }

            return tokens;
        },
    },
    csslex: {
        url: 'https://github.com/keithamus/csslex',
        tokenize: (css: string) => {
            return Array.from(cssLex.lex(css)).length;
        },
    },
};
