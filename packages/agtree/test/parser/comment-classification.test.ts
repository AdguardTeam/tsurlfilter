/**
 * @file Comment classification parity with 4.x (F-077, F-078, T-064).
 */

import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import { RuleGenerator } from '../../src/generator/rule-generator';
import { CommentRuleType } from '../../src/nodes';

const parser = new RuleParserPipeline();

describe('metadata comments need a colon after the header (F-077)', () => {
    test.each([
        '! Title of the list',
        '! Version',
        '! Version 1.0',
        '! Last Modified 2026',
        '! Titles: x',
    ])('%s stays a plain comment', (rule) => {
        const ast = parser.parse(rule);

        expect(ast.type).toBe(CommentRuleType.CommentRule);
        // The generator must not invent a `:` and change the list text.
        expect(RuleGenerator.generate(ast)).toBe(rule);
    });

    test.each([
        '! Title: of the list',
        '! Last Modified: x',
        '# Title: x',
    ])('%s is a metadata comment', (rule) => {
        const ast = parser.parse(rule);

        expect(ast.type).toBe(CommentRuleType.MetadataCommentRule);
        expect(RuleGenerator.generate(ast)).toBe(rule);
    });

    test.each(['! Title:  x', '! Title :x'])(
        '%s is a metadata comment (whitespace around the colon is normalized)',
        (rule) => {
            // 4.x parses these as metadata too and normalizes the colon
            // spacing on generation, so only the kind is asserted here.
            expect(parser.parse(rule).type).toBe(CommentRuleType.MetadataCommentRule);
        },
    );
});

describe('a `#` line with a space after the marker is a comment (F-078)', () => {
    test.each([
        '# START HOSTS LIST ###',
        '# comment ## inside',
        '# comment',
    ])('%s is a comment', (rule) => {
        const ast = parser.parse(rule);

        expect(ast.type).toBe(CommentRuleType.CommentRule);
        expect(RuleGenerator.generate(ast)).toBe(rule);
    });

    test.each([
        '##div',
        '#@#.ad',
        '#?#div',
        '###selector',
        '#comment##div',
        '####',
        '#####',
    ])('%s keeps its 4.x classification', (rule) => {
        const ast = parser.parse(rule);

        expect(RuleGenerator.generate(ast)).toBe(rule);
    });
});
