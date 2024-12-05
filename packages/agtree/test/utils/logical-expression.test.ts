import { LogicalExpressionParser } from '../../src/parser/misc/logical-expression';
import { LogicalExpressionUtils } from '../../src/utils/logical-expression';

describe('LogicalExpressionUtils', () => {
    test('getVariables', () => {
        // Invalid input
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => LogicalExpressionUtils.getVariables(<any>{
            type: 'Invalid',
        })).toThrowError('Unexpected node type');

        expect(
            LogicalExpressionUtils.getVariables(
                LogicalExpressionParser.parse('a'),
            ),
        ).toMatchObject([
            {
                type: 'Variable',
                name: 'a',
            },
        ]);

        expect(
            LogicalExpressionUtils.getVariables(
                LogicalExpressionParser.parse('!!!!a'),
            ),
        ).toMatchObject([
            {
                type: 'Variable',
                name: 'a',
            },
        ]);

        expect(
            LogicalExpressionUtils.getVariables(
                LogicalExpressionParser.parse('a || b && c'),
            ),
        ).toMatchObject([
            {
                type: 'Variable',
                name: 'a',
            },
            {
                type: 'Variable',
                name: 'b',
            },
            {
                type: 'Variable',
                name: 'c',
            },
        ]);

        expect(
            LogicalExpressionUtils.getVariables(
                LogicalExpressionParser.parse(
                    // eslint-disable-next-line max-len
                    '(adguard && !adguard_ext_safari) && (adguard_ext_android || (adguard_ext_chromium && (!adguard_ext_firefox)))',
                ),
            ),
        ).toMatchObject([
            {
                type: 'Variable',
                name: 'adguard',
            },
            {
                type: 'Variable',
                name: 'adguard_ext_safari',
            },
            {
                type: 'Variable',
                name: 'adguard_ext_android',
            },
            {
                type: 'Variable',
                name: 'adguard_ext_chromium',
            },
            {
                type: 'Variable',
                name: 'adguard_ext_firefox',
            },
        ]);

        // Lots of parentheses, variables, and operators
        expect(
            LogicalExpressionUtils.getVariables(
                LogicalExpressionParser.parse(
                    // eslint-disable-next-line max-len
                    '(a && b) || (c && d) || (e && f) || (g && h) || (i && j) || (k && l) || (m && n) || (o && p) || (q && r) || (s && t) || (u && v) || (w && x) || (y && z)',
                ),
            ),
        ).toMatchObject([
            {
                type: 'Variable',
                name: 'a',
            },
            {
                type: 'Variable',
                name: 'b',
            },
            {
                type: 'Variable',
                name: 'c',
            },
            {
                type: 'Variable',
                name: 'd',
            },
            {
                type: 'Variable',
                name: 'e',
            },
            {
                type: 'Variable',
                name: 'f',
            },
            {
                type: 'Variable',
                name: 'g',
            },
            {
                type: 'Variable',
                name: 'h',
            },
            {
                type: 'Variable',
                name: 'i',
            },
            {
                type: 'Variable',
                name: 'j',
            },
            {
                type: 'Variable',
                name: 'k',
            },
            {
                type: 'Variable',
                name: 'l',
            },
            {
                type: 'Variable',
                name: 'm',
            },
            {
                type: 'Variable',
                name: 'n',
            },
            {
                type: 'Variable',
                name: 'o',
            },
            {
                type: 'Variable',
                name: 'p',
            },
            {
                type: 'Variable',
                name: 'q',
            },
            {
                type: 'Variable',
                name: 'r',
            },
            {
                type: 'Variable',
                name: 's',
            },
            {
                type: 'Variable',
                name: 't',
            },
            {
                type: 'Variable',
                name: 'u',
            },
            {
                type: 'Variable',
                name: 'v',
            },
            {
                type: 'Variable',
                name: 'w',
            },
            {
                type: 'Variable',
                name: 'x',
            },
            {
                type: 'Variable',
                name: 'y',
            },
            {
                type: 'Variable',
                name: 'z',
            },
        ]);
    });

    test('evaluate', () => {
        // Invalid AST
        expect(() => LogicalExpressionUtils.evaluate(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <any>{
                type: 'Invalid',
            },
            {},
        )).toThrowError("Unexpected node type 'Invalid'");

        // Invalid right operand
        expect(() => LogicalExpressionUtils.evaluate(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <any>{
                type: 'Operator',
                operator: '&&',
            },
            {},
        )).toThrowError("Unexpected operator '&&'");

        expect(() => LogicalExpressionUtils.evaluate(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <any>{
                type: 'Operator',
                operator: '||',
            },
            {},
        )).toThrowError("Unexpected operator '||'");

        // Variable itself
        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('a'),
                { a: true },
            ),
        ).toBeTruthy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('a'),
                { a: false },
            ),
        ).toBeFalsy();

        // Not operator
        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('!a'),
                { a: false },
            ),
        ).toBeTruthy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('!a'),
                { a: true },
            ),
        ).toBeFalsy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('!!a'),
                { a: true },
            ),
        ).toBeTruthy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('!!a'),
                { a: false },
            ),
        ).toBeFalsy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('!!!a'),
                { a: false },
            ),
        ).toBeTruthy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('!!!!a'),
                { a: false },
            ),
        ).toBeFalsy();

        // And operator
        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('a && b'),
                { a: false, b: true },
            ),
        ).toBeFalsy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('a && b'),
                { a: true, b: false },
            ),
        ).toBeFalsy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('a && b'),
                { a: true, b: true },
            ),
        ).toBeTruthy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('(a) && (b)'),
                { a: true, b: true },
            ),
        ).toBeTruthy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('a && b && !c'),
                { a: true, b: true, c: false },
            ),
        ).toBeTruthy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('((a && (b))) && !!(!(c))'),
                { a: true, b: true, c: false },
            ),
        ).toBeTruthy();

        // Or operator
        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('a || b'),
                { a: false, b: true },
            ),
        ).toBeTruthy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('a || b'),
                { a: true, b: false },
            ),
        ).toBeTruthy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('a || b'),
                { a: true, b: true },
            ),
        ).toBeTruthy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('(a) || (b)'),
                { a: true, b: true },
            ),
        ).toBeTruthy();

        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse('a || b || !c'),
                { a: false, b: false, c: false },
            ),
        ).toBeTruthy();

        // Complex expression
        expect(
            LogicalExpressionUtils.evaluate(
                LogicalExpressionParser.parse(
                    // eslint-disable-next-line max-len
                    '(a && !b) && (c || (d && (!e)))',
                ),
                {
                    a: true, b: false, c: true, d: true, e: false,
                },
            ),
        ).toBeTruthy();
    });
});
