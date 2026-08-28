import { describe, expect, test } from 'vitest';

import { FilterListScanner } from '../../src/filter-list/scanner';
import type { ScannedRuleInfo } from '../../src/filter-list/types';
import { RuleKind } from '../../src/parser/rule';

/**
 * Constructs a {@link ScannedRuleInfo} from the flat params passed by
 * {@link ScanCallback}, for use in test assertions.
 *
 * @param kind Structural classification of the rule.
 * @param ruleStart Source start offset.
 * @param ruleEnd Source end offset.
 *
 * @returns A {@link ScannedRuleInfo} object.
 */
const toInfo = (
    kind: RuleKind,
    ruleStart: number,
    ruleEnd: number,
): ScannedRuleInfo => ({
    kind,
    ruleStart,
    ruleEnd,
});

type EmptyLineInfo = {
    start: number;
    end: number;
};

type CollectedRules = {
    rules: ScannedRuleInfo[];
    empties: EmptyLineInfo[];
};

describe('FilterListScanner', () => {
    const scanner = new FilterListScanner();

    /**
     * Helper: collect all scanned rules and empty lines from a source.
     *
     * @param source Filter list source string.
     *
     * @returns Collected rules and empty line info.
     */
    function collectRules(source: string): CollectedRules {
        const rules: ScannedRuleInfo[] = [];
        const empties: EmptyLineInfo[] = [];

        scanner.scan(
            source,
            (kind, ruleStart, ruleEnd) => {
                // Collect into ScannedRuleInfo shape to keep existing assertions unchanged
                rules.push(toInfo(kind, ruleStart, ruleEnd));
            },
            (start: number, end: number) => {
                empties.push({ start, end });
            },
        );

        return { rules, empties };
    }

    test('scans a single network rule (no trailing newline)', () => {
        const { rules, empties } = collectRules('||example.com^');
        expect(rules).toHaveLength(1);
        expect(rules[0].kind).toBe(RuleKind.Network);
        expect(rules[0].ruleStart).toBe(0);
        expect(rules[0].ruleEnd).toBe(14);
        expect(empties).toHaveLength(0);
    });

    test('scans multiple rules separated by LF', () => {
        const source = '||example.com^\n! comment\nexample.org##.ad';
        const { rules } = collectRules(source);
        expect(rules).toHaveLength(3);
        expect(rules[0].kind).toBe(RuleKind.Network);
        expect(rules[1].kind).toBe(RuleKind.Comment);
        expect(rules[2].kind).toBe(RuleKind.Cosmetic);
    });

    test('splits rules across CRLF newlines', () => {
        const source = '||a.com^\r\n||b.com^';
        const { rules } = collectRules(source);
        expect(rules).toHaveLength(2);
    });

    test('splits rules across CR newlines', () => {
        const source = '||a.com^\r||b.com^';
        const { rules } = collectRules(source);
        expect(rules).toHaveLength(2);
    });

    test('handles empty lines', () => {
        const source = '||a.com^\n\n||b.com^';
        const { rules, empties } = collectRules(source);
        expect(rules).toHaveLength(2);
        expect(empties).toHaveLength(1);
    });

    test('handles trailing newline (produces trailing empty)', () => {
        const source = '||a.com^\n';
        const { rules, empties } = collectRules(source);
        expect(rules).toHaveLength(1);
        expect(empties).toHaveLength(1);
    });

    test('empty source produces no rules and no empties', () => {
        const source = '';
        const { rules, empties } = collectRules(source);
        expect(rules).toHaveLength(0);
        expect(empties).toHaveLength(0);
    });

    test('callback receives populated ctx.data', () => {
        let receivedKind: RuleKind | undefined;
        scanner.scan(
            '||example.com^$script',
            (kind) => {
                receivedKind = kind;
            },
            () => {},
        );
        expect(receivedKind).toBe(RuleKind.Network);
    });

    test('ruleStart and ruleEnd are correct for middle rule', () => {
        // '||a.com^\n! comment\n' — second rule starts at 9, ends at 18
        const source = '||a.com^\n! comment\n';
        const { rules } = collectRules(source);
        expect(rules).toHaveLength(2);
        expect(rules[1].ruleStart).toBe(9);
        expect(rules[1].ruleEnd).toBe(18);
    });

    test('reset() restores default buffer sizes and scanner still works', () => {
        // Parse a large cosmetic rule to potentially grow buffers, then reset.
        const bigDomains = Array.from({ length: 200 }, (_, i) => `d${i}.com`).join(',');
        const bigRule = `${bigDomains}##.ad`;
        scanner.scan(bigRule, () => {}, () => {});
        scanner.reset();

        // After reset, scanner should still work correctly.
        const { rules } = collectRules('||example.com^');
        expect(rules).toHaveLength(1);
        expect(rules[0].kind).toBe(RuleKind.Network);
    });

    test('handles source with only newlines', () => {
        const source = '\n\n\n';
        const { rules, empties } = collectRules(source);
        expect(rules).toHaveLength(0);
        // 3 LFs: 3 empty lines (each LF terminates an empty rule) + 1 trailing empty
        expect(empties).toHaveLength(4);
    });

    test('splits rules across mixed newline types', () => {
        const source = '! a\r\n! b\r! c\n! d';
        const { rules } = collectRules(source);
        expect(rules).toHaveLength(4);
    });

    test('large list (1000 rules) produces correct count', () => {
        const lines = Array.from({ length: 1000 }, (_, i) => `||domain${i}.com^`);
        const source = lines.join('\n');
        let count = 0;
        scanner.scan(source, () => { count += 1; }, () => {});
        expect(count).toBe(1000);
    });

    describe('oversized rule behavior (grow:false)', () => {
        // A cosmetic rule with a long selector — well above 4 tokens.
        const oversizedRule = 'example.com##.ad-banner';

        test('single oversized rule emits exactly one error callback, not multiple onRule calls', () => {
            const tinyScanner = new FilterListScanner({ tokenCapacity: 4, grow: false });
            const rules: ScannedRuleInfo[] = [];
            const errors: unknown[] = [];

            tinyScanner.scan(
                oversizedRule,
                (kind, ruleStart, ruleEnd) => { rules.push(toInfo(kind, ruleStart, ruleEnd)); },
                () => {},
                (e) => { errors.push(e); },
            );

            expect(rules, 'no partial rule callbacks').toHaveLength(0);
            expect(errors, 'exactly one error for the whole rule').toHaveLength(1);
        });

        test('oversized rule followed by a normal rule: one error + one rule', () => {
            const tinyScanner = new FilterListScanner({ tokenCapacity: 4, grow: false });
            const rules: ScannedRuleInfo[] = [];
            const errors: unknown[] = [];

            const normal = '! comment';
            const source = `${oversizedRule}\n${normal}`;

            tinyScanner.scan(
                source,
                (kind, ruleStart, ruleEnd) => { rules.push(toInfo(kind, ruleStart, ruleEnd)); },
                () => {},
                (e) => { errors.push(e); },
            );

            expect(errors).toHaveLength(1);
            expect(rules).toHaveLength(1);
            // Normal rule starts right after the newline.
            expect(rules[0].ruleStart).toBe(oversizedRule.length + 1);
        });

        test('two consecutive oversized rules emit two errors', () => {
            const tinyScanner = new FilterListScanner({ tokenCapacity: 4, grow: false });
            const errors: unknown[] = [];

            tinyScanner.scan(
                `${oversizedRule}\n${oversizedRule}`,
                () => {},
                () => {},
                (e) => { errors.push(e); },
            );

            expect(errors).toHaveLength(2);
        });

        test('oversized rule without onRuleError throws', () => {
            const tinyScanner = new FilterListScanner({ tokenCapacity: 4, grow: false });

            expect(() => {
                tinyScanner.scan(oversizedRule, () => {}, () => {});
            }).toThrow();
        });

        test('error ruleEnd and ruleStart span the full oversized line', () => {
            const tinyScanner = new FilterListScanner({ tokenCapacity: 4, grow: false });
            let errStart = -1;
            let errEnd = -1;

            tinyScanner.scan(
                oversizedRule,
                () => {},
                () => {},
                (_e, start, end) => {
                    errStart = start;
                    errEnd = end;
                },
            );

            expect(errStart).toBe(0);
            expect(errEnd).toBe(oversizedRule.length);
        });
    });

    describe('data-buffer overflow (grow:false)', () => {
        // A network rule with 2 modifiers — requires itemCapacity >= 2.
        // With itemCapacity: 1 the modifier-list parser sets CTX_STATUS_OVERFLOW.
        const twoModRule = '||example.com^$third-party,image';
        const normalRule = '! comment';

        test('modifier overflow routes to onRuleError, not onRule', () => {
            const scanner2 = new FilterListScanner({ itemCapacity: 1, grow: false });
            const rules: ScannedRuleInfo[] = [];
            const errors: unknown[] = [];

            scanner2.scan(
                twoModRule,
                (kind, ruleStart, ruleEnd) => { rules.push(toInfo(kind, ruleStart, ruleEnd)); },
                () => {},
                (e) => { errors.push(e); },
            );

            expect(rules, 'truncated rule must not be emitted as valid').toHaveLength(0);
            expect(errors, 'exactly one error for the overflowed rule').toHaveLength(1);
        });

        test('modifier overflow error carries the correct source range', () => {
            const scanner2 = new FilterListScanner({ itemCapacity: 1, grow: false });
            let errStart = -1;
            let errEnd = -1;

            scanner2.scan(
                twoModRule,
                () => {},
                () => {},
                (_e, start, end) => {
                    errStart = start;
                    errEnd = end;
                },
            );

            expect(errStart).toBe(0);
            expect(errEnd).toBe(twoModRule.length);
        });

        test('modifier overflow followed by a normal rule: one error + one rule', () => {
            const scanner2 = new FilterListScanner({ itemCapacity: 1, grow: false });
            const rules: ScannedRuleInfo[] = [];
            const errors: unknown[] = [];
            const source = `${twoModRule}\n${normalRule}`;

            scanner2.scan(
                source,
                (kind, ruleStart, ruleEnd) => { rules.push(toInfo(kind, ruleStart, ruleEnd)); },
                () => {},
                (e) => { errors.push(e); },
            );

            expect(errors).toHaveLength(1);
            expect(rules).toHaveLength(1);
            expect(rules[0].ruleStart).toBe(twoModRule.length + 1);
        });

        test('modifier overflow without onRuleError throws', () => {
            const scanner2 = new FilterListScanner({ itemCapacity: 1, grow: false });

            expect(() => {
                scanner2.scan(twoModRule, () => {}, () => {});
            }).toThrow('Parser data buffer overflow');
        });

        test('modifier overflow error message identifies the overflow', () => {
            const scanner2 = new FilterListScanner({ itemCapacity: 1, grow: false });
            let caughtError: unknown;

            scanner2.scan(
                twoModRule,
                () => {},
                () => {},
                (e) => { caughtError = e; },
            );

            expect(caughtError).toBeInstanceOf(Error);
            expect((caughtError as Error).message).toContain('data buffer overflow');
        });
    });
});
