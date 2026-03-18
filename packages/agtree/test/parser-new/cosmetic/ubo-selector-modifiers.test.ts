import { describe, expect, test } from 'vitest';

import { RuleParser } from '../../../src/parser-new/rule-parser';

const parser = new RuleParser();

describe('RuleParser — uBO selector modifiers (NOT YET IMPLEMENTED)', () => {
    describe('uBO pseudo-class modifiers in selector', () => {
        test.skip(':style() pseudo-class - example.com##.ads:style(display: none !important)', () => {
            // TODO: Implement uBO :style() pseudo-class detection and extraction
            // uBO modifiers are pseudo-classes within the CSS selector
            // Format: selector:modifier(value)
            
            const ast = parser.parse('example.com##.ads:style(display: none !important)');
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                body: {
                    selectorList: {
                        // When implemented, selector may be stripped of modifier
                        value: '.ads',
                    },
                    // modifiers: [
                    //     {
                    //         name: 'style',
                    //         value: 'display: none !important',
                    //     },
                    // ],
                },
            });
        });

        test.skip(':remove() pseudo-class - example.com##.banner:remove()', () => {
            // TODO: Implement uBO :remove() pseudo-class detection
            
            const ast = parser.parse('example.com##.banner:remove()');
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                body: {
                    selectorList: {
                        value: '.banner',
                    },
                    // modifiers: [
                    //     {
                    //         name: 'remove',
                    //     },
                    // ],
                },
            });
        });

        test.skip(':has-text() pseudo-class - example.com##div:has-text(advertisement)', () => {
            // TODO: Implement uBO :has-text() pseudo-class detection
            
            const ast = parser.parse('example.com##div:has-text(advertisement)');
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                body: {
                    selectorList: {
                        value: 'div',
                    },
                    // modifiers: [
                    //     {
                    //         name: 'has-text',
                    //         value: 'advertisement',
                    //     },
                    // ],
                },
            });
        });

        test.skip(':matches-css() pseudo-class - example.com##div:matches-css(display: block)', () => {
            // TODO: Implement uBO :matches-css() pseudo-class detection
            
            const ast = parser.parse('example.com##div:matches-css(display: block)');
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                body: {
                    selectorList: {
                        value: 'div',
                    },
                    // modifiers: [
                    //     {
                    //         name: 'matches-css',
                    //         value: 'display: block',
                    //     },
                    // ],
                },
            });
        });

        test.skip(':matches-path() pseudo-class - ##:matches-path(/page) .ad', () => {
            // TODO: Implement uBO :matches-path() pseudo-class detection
            // Can appear at the beginning of selector
            
            const ast = parser.parse('##:matches-path(/page) .ad');
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                body: {
                    selectorList: {
                        value: '.ad',
                    },
                    // modifiers: [
                    //     {
                    //         name: 'matches-path',
                    //         value: '/page',
                    //     },
                    // ],
                },
            });
        });

        test.skip(':matches-media() pseudo-class - ##:matches-media((min-width: 1024px)) .ad', () => {
            // TODO: Implement uBO :matches-media() pseudo-class detection
            
            const ast = parser.parse('##:matches-media((min-width: 1024px)) .ad');
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                body: {
                    selectorList: {
                        value: '.ad',
                    },
                    // modifiers: [
                    //     {
                    //         name: 'matches-media',
                    //         value: '(min-width: 1024px)',
                    //     },
                    // ],
                },
            });
        });

        test.skip('negated with :not() - ##:not(:matches-path(/exclude)) .foo', () => {
            // TODO: Implement :not() wrapper detection for uBO modifiers
            // Format: :not(:matches-path(value))
            
            const ast = parser.parse('##:not(:matches-path(/exclude)) .foo');
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                body: {
                    selectorList: {
                        value: '.foo',
                    },
                    // modifiers: [
                    //     {
                    //         name: 'matches-path',
                    //         value: '/exclude',
                    //         exception: true,  // negated
                    //     },
                    // ],
                },
            });
        });

        test.skip('multiple uBO modifiers - ##:matches-path(/page):style(color: red) .ad', () => {
            // TODO: Implement multiple uBO modifier extraction
            
            const ast = parser.parse('##:matches-path(/page):style(color: red) .ad');
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                body: {
                    selectorList: {
                        value: '.ad',
                    },
                    // modifiers: [
                    //     {
                    //         name: 'matches-path',
                    //         value: '/page',
                    //     },
                    //     {
                    //         name: 'style',
                    //         value: 'color: red',
                    //     },
                    // ],
                },
            });
        });
    });

    describe('current behavior - uBO modifiers treated as CSS pseudo-classes', () => {
        test(':style() currently parsed as part of selector', () => {
            // Current implementation treats uBO modifiers as regular CSS selector
            // This documents current behavior (will change when uBO modifier extraction is implemented)
            
            const ast = parser.parse('example.com##.ads:style(display:none)') as any;
            
            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.body.selectorList.value).toBe('.ads:style(display:none)');
            expect(ast.body).not.toHaveProperty('modifiers');
        });

        test(':remove() currently parsed as part of selector', () => {
            const ast = parser.parse('example.com##.ads:remove()') as any;
            
            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.body.selectorList.value).toBe('.ads:remove()');
            expect(ast.body).not.toHaveProperty('modifiers');
        });

        test(':has-text() currently parsed as part of selector', () => {
            const ast = parser.parse('example.com##div:has-text(advertisement)') as any;
            
            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.body.selectorList.value).toBe('div:has-text(advertisement)');
            expect(ast.body).not.toHaveProperty('modifiers');
        });

        test(':matches-path() currently parsed as part of selector', () => {
            const ast = parser.parse('##:matches-path(/page) .ad') as any;
            
            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.body.selectorList.value).toBe(':matches-path(/page) .ad');
            expect(ast.body).not.toHaveProperty('modifiers');
        });
    });
});
