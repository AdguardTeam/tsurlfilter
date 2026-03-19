import { describe, expect, test } from 'vitest';

import { DomainListParser } from '../../../src/parser-new/misc/domain-list';
import { createPreparserContext, domainRecordsOffset, initPreparserContext } from '../../../src/preparser/context';
import { DomainListPreparser } from '../../../src/preparser/misc/domain-list';
import { TokenType } from '../../../src/tokenizer/token-types';
import { tokenizeLine } from '../../../src/tokenizer/tokenizer';

describe('DomainListParser', () => {
    const createTokensAndContext = (source: string) => {
        const tokens = {
            tokenCount: 0,
            types: new Uint8Array(1024),
            ends: new Uint32Array(1024),
            actualEnd: 0,
            overflowed: 0 as 0 | 1,
        };

        tokenizeLine(source, 0, tokens);

        const ctx = createPreparserContext();
        initPreparserContext(ctx, source, tokens);

        return { tokens, ctx };
    };

    describe('parse (with location)', () => {
        test('single domain', () => {
            const source = 'example.com';
            const { ctx } = createTokensAndContext(source);

            const domainCount = DomainListPreparser.preparse(
                ctx,
                0,
                ctx.tokenCount,
                TokenType.Comma,
            );

            const domainList = DomainListParser.parse(
                source,
                ctx.data,
                domainCount,
                domainRecordsOffset(ctx),
                ',',
                true,
            );

            expect(domainList).toBeDefined();
            expect(domainList!).toMatchObject({
                type: 'DomainList',
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        value: 'example.com',
                        exception: false,
                        start: 0,
                        end: 11,
                    },
                ],
                start: 0,
                end: 11,
            });
        });

        test('multiple domains separated by comma', () => {
            const source = 'example.com,test.org,foo.net';
            const { ctx } = createTokensAndContext(source);

            const domainCount = DomainListPreparser.preparse(
                ctx,
                0,
                ctx.tokenCount,
                TokenType.Comma,
            );

            const domainList = DomainListParser.parse(
                source,
                ctx.data,
                domainCount,
                domainRecordsOffset(ctx),
                ',',
                true,
            );

            expect(domainList).toBeDefined();
            expect(domainList!).toMatchObject({
                type: 'DomainList',
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        value: 'example.com',
                        exception: false,
                        start: 0,
                        end: 11,
                    },
                    {
                        type: 'Domain',
                        value: 'test.org',
                        exception: false,
                        start: 12,
                        end: 20,
                    },
                    {
                        type: 'Domain',
                        value: 'foo.net',
                        exception: false,
                        start: 21,
                        end: 28,
                    },
                ],
                start: 0,
                end: 28,
            });
        });

        test('domains with exception prefix ~', () => {
            const source = 'example.com,~test.org,foo.net';
            const { ctx } = createTokensAndContext(source);

            const domainCount = DomainListPreparser.preparse(
                ctx,
                0,
                ctx.tokenCount,
                TokenType.Comma,
            );

            const domainList = DomainListParser.parse(
                source,
                ctx.data,
                domainCount,
                domainRecordsOffset(ctx),
                ',',
                true,
            );

            expect(domainList).toBeDefined();
            expect(domainList!).toMatchObject({
                type: 'DomainList',
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        value: 'example.com',
                        exception: false,
                    },
                    {
                        type: 'Domain',
                        value: 'test.org',
                        exception: true,
                        start: 13,
                        end: 21,
                    },
                    {
                        type: 'Domain',
                        value: 'foo.net',
                        exception: false,
                    },
                ],
            });
        });

        test('domains separated by pipe', () => {
            const source = 'example.com|test.org';
            const { ctx } = createTokensAndContext(source);

            const domainCount = DomainListPreparser.preparse(
                ctx,
                0,
                ctx.tokenCount,
                TokenType.Pipe,
            );

            const domainList = DomainListParser.parse(
                source,
                ctx.data,
                domainCount,
                domainRecordsOffset(ctx),
                '|',
                true,
            );

            expect(domainList).toBeDefined();
            expect(domainList!).toMatchObject({
                type: 'DomainList',
                separator: '|',
                children: [
                    {
                        type: 'Domain',
                        value: 'example.com',
                        exception: false,
                    },
                    {
                        type: 'Domain',
                        value: 'test.org',
                        exception: false,
                    },
                ],
            });
        });

        test('regex domain', () => {
            const source = '/example\\.com/';
            const { ctx } = createTokensAndContext(source);

            const domainCount = DomainListPreparser.preparse(
                ctx,
                0,
                ctx.tokenCount,
                TokenType.Comma,
            );

            const domainList = DomainListParser.parse(
                source,
                ctx.data,
                domainCount,
                domainRecordsOffset(ctx),
                ',',
                true,
            );

            expect(domainList).toBeDefined();
            expect(domainList!).toMatchObject({
                type: 'DomainList',
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        value: '/example\\.com/',
                        exception: false,
                        start: 0,
                        end: 14,
                    },
                ],
            });
        });

        test('regex domain with embedded comma', () => {
            const source = '/example\\.(com|org)/,test.net';
            const { ctx } = createTokensAndContext(source);

            const domainCount = DomainListPreparser.preparse(
                ctx,
                0,
                ctx.tokenCount,
                TokenType.Comma,
            );

            const domainList = DomainListParser.parse(
                source,
                ctx.data,
                domainCount,
                domainRecordsOffset(ctx),
                ',',
                true,
            );

            expect(domainList).toBeDefined();
            expect(domainList!).toMatchObject({
                type: 'DomainList',
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        value: '/example\\.(com|org)/',
                        exception: false,
                    },
                    {
                        type: 'Domain',
                        value: 'test.net',
                        exception: false,
                    },
                ],
            });

            expect(domainList!.children).toHaveLength(2);
        });

        test('domains with whitespace', () => {
            const source = ' example.com , test.org ';
            const { ctx } = createTokensAndContext(source);

            const domainCount = DomainListPreparser.preparse(
                ctx,
                0,
                ctx.tokenCount,
                TokenType.Comma,
            );

            const domainList = DomainListParser.parse(
                source,
                ctx.data,
                domainCount,
                domainRecordsOffset(ctx),
                ',',
                true,
            );

            expect(domainList).toBeDefined();
            expect(domainList!).toMatchObject({
                type: 'DomainList',
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        value: 'example.com',
                        exception: false,
                    },
                    {
                        type: 'Domain',
                        value: 'test.org',
                        exception: false,
                    },
                ],
            });
        });

        test('empty domain list', () => {
            const source = '';
            const { ctx } = createTokensAndContext(source);

            const domainCount = DomainListPreparser.preparse(
                ctx,
                0,
                ctx.tokenCount,
                TokenType.Comma,
            );

            const domainList = DomainListParser.parse(
                source,
                ctx.data,
                domainCount,
                domainRecordsOffset(ctx),
                ',',
                true,
            );

            // Empty domain list returns undefined
            expect(domainList).toBeUndefined();
        });

        test('all exception domains', () => {
            const source = '~example.com,~test.org';
            const { ctx } = createTokensAndContext(source);

            const domainCount = DomainListPreparser.preparse(
                ctx,
                0,
                ctx.tokenCount,
                TokenType.Comma,
            );

            const domainList = DomainListParser.parse(
                source,
                ctx.data,
                domainCount,
                domainRecordsOffset(ctx),
                ',',
                true,
            );

            expect(domainList).toBeDefined();
            expect(domainList!.children).toHaveLength(2);
            expect(domainList!.children[0]).toMatchObject({
                type: 'Domain',
                value: 'example.com',
                exception: true,
            });
            expect(domainList!.children[1]).toMatchObject({
                type: 'Domain',
                value: 'test.org',
                exception: true,
            });
        });
    });

    describe('parse (without location)', () => {
        test('domains without location info', () => {
            const source = 'example.com,~test.org';
            const { ctx } = createTokensAndContext(source);

            const domainCount = DomainListPreparser.preparse(
                ctx,
                0,
                ctx.tokenCount,
                TokenType.Comma,
            );

            const domainList = DomainListParser.parse(
                source,
                ctx.data,
                domainCount,
                domainRecordsOffset(ctx),
                ',',
                false,
            );

            expect(domainList).toBeDefined();
            expect(domainList!).toMatchObject({
                type: 'DomainList',
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        value: 'example.com',
                        exception: false,
                    },
                    {
                        type: 'Domain',
                        value: 'test.org',
                        exception: true,
                    },
                ],
            });

            expect(domainList!).not.toHaveProperty('start');
            expect(domainList!).not.toHaveProperty('end');
            expect(domainList!.children[0]).not.toHaveProperty('start');
            expect(domainList!.children[0]).not.toHaveProperty('end');
        });
    });

    describe('edge cases', () => {
        test('unicode in domain', () => {
            const source = 'пример.рф,test.com';
            const { ctx } = createTokensAndContext(source);

            const domainCount = DomainListPreparser.preparse(
                ctx,
                0,
                ctx.tokenCount,
                TokenType.Comma,
            );

            const domainList = DomainListParser.parse(
                source,
                ctx.data,
                domainCount,
                domainRecordsOffset(ctx),
                ',',
                false,
            );

            expect(domainList).toBeDefined();
            expect(domainList!.children).toHaveLength(2);
            expect(domainList!.children[0].value).toBe('пример.рф');
            expect(domainList!.children[1].value).toBe('test.com');
        });

        test('complex regex with nested structures', () => {
            const source = '/example\\.(com|org|net)$/,test.io';
            const { ctx } = createTokensAndContext(source);

            const domainCount = DomainListPreparser.preparse(
                ctx,
                0,
                ctx.tokenCount,
                TokenType.Comma,
            );

            const domainList = DomainListParser.parse(
                source,
                ctx.data,
                domainCount,
                domainRecordsOffset(ctx),
                ',',
                false,
            );

            expect(domainList).toBeDefined();
            expect(domainList!.children).toHaveLength(2);
            expect(domainList!.children[0].value).toBe('/example\\.(com|org|net)$/');
            expect(domainList!.children[1].value).toBe('test.io');
        });

        test('mixed regex and regular domains', () => {
            const source = 'example.com,/test\\d+\\.org/,~foo.net';
            const { ctx } = createTokensAndContext(source);

            const domainCount = DomainListPreparser.preparse(
                ctx,
                0,
                ctx.tokenCount,
                TokenType.Comma,
            );

            const domainList = DomainListParser.parse(
                source,
                ctx.data,
                domainCount,
                domainRecordsOffset(ctx),
                ',',
                false,
            );

            expect(domainList).toBeDefined();
            expect(domainList!.children).toHaveLength(3);
            expect(domainList!.children[0]).toMatchObject({
                value: 'example.com',
                exception: false,
            });
            expect(domainList!.children[1]).toMatchObject({
                value: '/test\\d+\\.org/',
                exception: false,
            });
            expect(domainList!.children[2]).toMatchObject({
                value: 'foo.net',
                exception: true,
            });
        });
    });
});
