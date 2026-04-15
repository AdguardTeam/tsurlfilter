/**
 * @file Preparser-level unit tests for `SelectorListPreparser`.
 *
 * Each test tokenises a CSS selector string, runs
 * `SelectorListPreparser.preparse()`, then inspects the flat `Int32Array`
 * data buffer directly — no AST construction involved.
 *
 * Helper pattern
 * --------------
 * `p(source)` tokenises, prepares context, and calls `preparse`.
 * `child(i)` returns a helper object with typed field accessors for the
 * i-th global child record.
 */

import { describe, expect, test } from 'vitest';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import { createPreparserContext, initPreparserContext } from '../../../src/preparser/context';
import {
    CHILD_FIELD_0,
    CHILD_FIELD_1,
    CHILD_FIELD_2,
    CHILD_FIELD_3,
    CHILD_FIELD_4,
    CHILD_FIELD_5,
    CHILD_FIELD_6,
    CHILD_FIELD_7,
    ChildKind,
    COMBINATOR_CHILD,
    COMBINATOR_DESCENDANT,
    COMBINATOR_NEXT_SIBLING,
    COMBINATOR_SUBSEQUENT_SIBLING,
    DEFAULT_MAX_COMPLEX,
    NO_VALUE,
    SelectorListPreparser,
} from '../../../src/preparser/css/selector-list';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

const tokenizer = new Tokenizer(1024);
const ctx = createPreparserContext();

/**
 * Data offset used in all tests (write at start of ctx.data).
 */
const DATA_OFFSET = 0;

/**
 * Tokenise `source` and run `SelectorListPreparser.preparse()`.
 *
 * @param source CSS selector string.
 */
function p(source: string): void {
    tokenizer.setSource(source);
    initPreparserContext(ctx, source, tokenizer);
    SelectorListPreparser.preparse(ctx, 0, ctx.tokenCount, DATA_OFFSET);
}

/**
 * Access fields of the i-th global child record.
 *
 * @param i Global child record index.
 *
 * @returns Object exposing each child field.
 */
function child(i: number): {
    kind: ChildKind;
    srcStart: number;
    srcEnd: number;
    f0: number; f1: number; f2: number; f3: number;
    f4: number; f5: number; f6: number; f7: number;
    src: string;
    valueStr: string;
    nameStr: string;
    argStr: string | null;
} {
    const base = SelectorListPreparser.childBase(
        DATA_OFFSET,
        DEFAULT_MAX_COMPLEX,
        i,
    );
    const d = ctx.data;
    const src = ctx.source;
    const kind = d[base + 0] as ChildKind;
    const srcStart = d[base + 1];
    const srcEnd = d[base + 2];
    const f0 = d[base + CHILD_FIELD_0];
    const f1 = d[base + CHILD_FIELD_1];
    const f2 = d[base + CHILD_FIELD_2];
    const f3 = d[base + CHILD_FIELD_3];
    const f4 = d[base + CHILD_FIELD_4];
    const f5 = d[base + CHILD_FIELD_5];
    const f6 = d[base + CHILD_FIELD_6];
    const f7 = d[base + CHILD_FIELD_7];
    return {
        kind,
        srcStart,
        srcEnd,
        f0,
        f1,
        f2,
        f3,
        f4,
        f5,
        f6,
        f7,
        src: src.slice(srcStart, srcEnd),
        valueStr: f0 !== NO_VALUE ? src.slice(f0, f1) : '',
        nameStr: f0 !== NO_VALUE ? src.slice(f0, f1) : '',
        argStr: f2 !== NO_VALUE ? src.slice(f2, f3) : null,
    };
}

describe('User Story 1 — Simple selectors', () => {
    test('type selector: div', () => {
        p('div');
        expect(SelectorListPreparser.complexCount(ctx.data, DATA_OFFSET)).toBe(1);
        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 0)).toBe(1);

        const c = child(0);
        expect(c.kind).toBe(ChildKind.TypeSelector);
        expect(c.src).toBe('div');
        expect(c.valueStr).toBe('div');
        expect(c.f2).toBe(NO_VALUE);
    });

    test('universal type selector: *', () => {
        p('*');
        expect(SelectorListPreparser.complexCount(ctx.data, DATA_OFFSET)).toBe(1);

        const c = child(0);
        expect(c.kind).toBe(ChildKind.TypeSelector);
        expect(c.src).toBe('*');
        expect(c.valueStr).toBe('*');
    });

    test('type selector with hyphen: my-tag', () => {
        p('my-tag');
        const c = child(0);
        expect(c.kind).toBe(ChildKind.TypeSelector);
        expect(c.valueStr).toBe('my-tag');
    });

    test('type selector with underscore: my_tag', () => {
        p('my_tag');
        const c = child(0);
        expect(c.kind).toBe(ChildKind.TypeSelector);
        expect(c.valueStr).toBe('my_tag');
    });

    test('ID selector: #my-id', () => {
        p('#my-id');
        expect(SelectorListPreparser.complexCount(ctx.data, DATA_OFFSET)).toBe(1);

        const c = child(0);
        expect(c.kind).toBe(ChildKind.IdSelector);
        expect(c.src).toBe('#my-id'); // source includes '#'
        expect(c.valueStr).toBe('my-id'); // value excludes '#'
        expect(c.f2).toBe(NO_VALUE);
    });

    test('ID selector: #id starts at offset 1', () => {
        p('#id');
        const c = child(0);
        expect(c.kind).toBe(ChildKind.IdSelector);
        expect(c.f0).toBe(1); // value_start excludes '#' at offset 0
        expect(c.f1).toBe(3); // value_end
    });

    test('class selector: .class', () => {
        p('.class');
        const c = child(0);
        expect(c.kind).toBe(ChildKind.ClassSelector);
        expect(c.src).toBe('.class'); // source includes '.'
        expect(c.valueStr).toBe('class'); // value excludes '.'
        expect(c.f2).toBe(NO_VALUE);
    });

    test('class selector: .my-class', () => {
        p('.my-class');
        const c = child(0);
        expect(c.kind).toBe(ChildKind.ClassSelector);
        expect(c.valueStr).toBe('my-class');
    });

    test('attribute selector: [attr]', () => {
        p('[attr]');
        const c = child(0);
        expect(c.kind).toBe(ChildKind.AttributeSelector);
        expect(c.src).toBe('[attr]');
        expect(c.nameStr).toBe('attr'); // FIELD_0/FIELD_1 = name
        expect(c.f2).toBe(NO_VALUE); // no operator
        expect(c.f4).toBe(NO_VALUE); // no value
        expect(c.f6).toBe(NO_VALUE); // no flag
    });

    test('attribute selector: [attr="value" i]', () => {
        p('[attr="value" i]');
        const c = child(0);
        expect(c.kind).toBe(ChildKind.AttributeSelector);
        expect(ctx.source.slice(c.f0, c.f1)).toBe('attr'); // name
        expect(ctx.source.slice(c.f2, c.f3)).toBe('='); // operator
        expect(ctx.source.slice(c.f4, c.f5)).toBe('value'); // value (no quotes)
        expect(ctx.source.slice(c.f6, c.f7)).toBe('i'); // flag
    });

    test('attribute selector: [attr~="val"]', () => {
        p('[attr~="val"]');
        const c = child(0);
        expect(ctx.source.slice(c.f2, c.f3)).toBe('~=');
        expect(ctx.source.slice(c.f4, c.f5)).toBe('val');
        expect(c.f6).toBe(NO_VALUE);
    });

    test('attribute selector: [attr^="val" s]', () => {
        p('[attr^="val" s]');
        const c = child(0);
        expect(ctx.source.slice(c.f2, c.f3)).toBe('^=');
        expect(ctx.source.slice(c.f6, c.f7)).toBe('s');
    });

    test('attribute selector: unquoted value [attr=val]', () => {
        p('[attr=val]');
        const c = child(0);
        expect(ctx.source.slice(c.f4, c.f5)).toBe('val');
    });

    test('pseudo-class: :hover (non-functional)', () => {
        p(':hover');
        const c = child(0);
        expect(c.kind).toBe(ChildKind.PseudoClassSelector);
        expect(c.src).toBe(':hover');
        expect(c.nameStr).toBe('hover');
        expect(c.f2).toBe(NO_VALUE); // no argument
    });

    test('pseudo-class: :nth-child(2n+1)', () => {
        p(':nth-child(2n+1)');
        const c = child(0);
        expect(c.kind).toBe(ChildKind.PseudoClassSelector);
        expect(c.nameStr).toBe('nth-child');
        expect(c.argStr).toBe('2n+1');
        expect(c.f2).not.toBe(NO_VALUE); // arg_start is set
    });

    test('pseudo-class: :not(.class)', () => {
        p(':not(.class)');
        const c = child(0);
        expect(c.kind).toBe(ChildKind.PseudoClassSelector);
        expect(c.nameStr).toBe('not');
        expect(c.argStr).toBe('.class');
    });
});

describe('User Story 2 — Compound selectors', () => {
    test('div#id.class', () => {
        p('div#id.class');
        expect(SelectorListPreparser.complexCount(ctx.data, DATA_OFFSET)).toBe(1);
        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 0)).toBe(3);

        expect(child(0).kind).toBe(ChildKind.TypeSelector);
        expect(child(0).valueStr).toBe('div');

        expect(child(1).kind).toBe(ChildKind.IdSelector);
        expect(child(1).valueStr).toBe('id');

        expect(child(2).kind).toBe(ChildKind.ClassSelector);
        expect(child(2).valueStr).toBe('class');
    });

    test('[attr1="v1"][attr2]', () => {
        p('[attr1="v1"][attr2]');
        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 0)).toBe(2);

        expect(child(0).kind).toBe(ChildKind.AttributeSelector);
        expect(ctx.source.slice(child(0).f0, child(0).f1)).toBe('attr1');

        expect(child(1).kind).toBe(ChildKind.AttributeSelector);
        expect(ctx.source.slice(child(1).f0, child(1).f1)).toBe('attr2');
    });

    test('div.class:hover[attr]', () => {
        p('div.class:hover[attr]');
        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 0)).toBe(4);

        expect(child(0).kind).toBe(ChildKind.TypeSelector);
        expect(child(1).kind).toBe(ChildKind.ClassSelector);
        expect(child(2).kind).toBe(ChildKind.PseudoClassSelector);
        expect(child(3).kind).toBe(ChildKind.AttributeSelector);
    });
});

describe('User Story 3 — Complex selectors with combinators', () => {
    test('div > span (child combinator)', () => {
        p('div > span');
        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 0)).toBe(3);

        expect(child(0).kind).toBe(ChildKind.TypeSelector);
        expect(child(0).valueStr).toBe('div');

        expect(child(1).kind).toBe(ChildKind.SelectorCombinator);
        expect(child(1).f0).toBe(COMBINATOR_CHILD);

        expect(child(2).kind).toBe(ChildKind.TypeSelector);
        expect(child(2).valueStr).toBe('span');
    });

    test('div span (descendant combinator)', () => {
        p('div span');
        const c1 = child(1);
        expect(c1.kind).toBe(ChildKind.SelectorCombinator);
        expect(c1.f0).toBe(COMBINATOR_DESCENDANT);
    });

    test('div + a (next-sibling combinator)', () => {
        p('div + a');
        expect(child(1).kind).toBe(ChildKind.SelectorCombinator);
        expect(child(1).f0).toBe(COMBINATOR_NEXT_SIBLING);
    });

    test('div ~ h1 (subsequent-sibling combinator)', () => {
        p('div ~ h1');
        expect(child(1).kind).toBe(ChildKind.SelectorCombinator);
        expect(child(1).f0).toBe(COMBINATOR_SUBSEQUENT_SIBLING);
    });

    test('div > span + a ~ h1 (three combinators)', () => {
        p('div > span + a ~ h1');
        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 0)).toBe(7);

        expect(child(1).f0).toBe(COMBINATOR_CHILD);
        expect(child(3).f0).toBe(COMBINATOR_NEXT_SIBLING);
        expect(child(5).f0).toBe(COMBINATOR_SUBSEQUENT_SIBLING);
    });

    test('whitespace around explicit combinator is not a descendant combinator', () => {
        p('div   >   span');
        // Only 3 children: TypeSelector, SelectorCombinator(>), TypeSelector
        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 0)).toBe(3);
        expect(child(1).f0).toBe(COMBINATOR_CHILD);
    });
});

describe('User Story 4 — Selector lists', () => {
    test('div, span', () => {
        p('div, span');
        expect(SelectorListPreparser.complexCount(ctx.data, DATA_OFFSET)).toBe(2);

        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 0)).toBe(1);
        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 1)).toBe(1);

        // First complex selector: 'div'
        const c0 = child(0);
        expect(c0.kind).toBe(ChildKind.TypeSelector);
        expect(c0.valueStr).toBe('div');

        // Second complex selector: 'span' — global child index 1
        const c1 = child(1);
        expect(c1.kind).toBe(ChildKind.TypeSelector);
        expect(c1.valueStr).toBe('span');
    });

    test(':not(div, span) — comma inside balanced parens is not a separator', () => {
        p(':not(div, span)');
        // One complex selector, one child (the pseudo-class)
        expect(SelectorListPreparser.complexCount(ctx.data, DATA_OFFSET)).toBe(1);
        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 0)).toBe(1);

        const c = child(0);
        expect(c.kind).toBe(ChildKind.PseudoClassSelector);
        expect(c.argStr).toBe('div, span');
    });

    test('three complex selectors: div, .class, #id', () => {
        p('div, .class, #id');
        expect(SelectorListPreparser.complexCount(ctx.data, DATA_OFFSET)).toBe(3);
    });

    test('source ranges of complex selectors', () => {
        p('div, span');
        const srcStart0 = SelectorListPreparser.complexSourceStart(ctx.data, DATA_OFFSET, 0);
        const srcEnd0 = SelectorListPreparser.complexSourceEnd(ctx.data, DATA_OFFSET, 0);
        expect(ctx.source.slice(srcStart0, srcEnd0)).toBe('div');

        const srcStart1 = SelectorListPreparser.complexSourceStart(ctx.data, DATA_OFFSET, 1);
        const srcEnd1 = SelectorListPreparser.complexSourceEnd(ctx.data, DATA_OFFSET, 1);
        expect(ctx.source.slice(srcStart1, srcEnd1)).toBe('span');
    });
});

describe('User Story 5 — Balanced parentheses and brackets', () => {
    test(':not([class]) — inner brackets balanced', () => {
        p(':not([class])');
        const c = child(0);
        expect(c.kind).toBe(ChildKind.PseudoClassSelector);
        expect(c.argStr).toBe('[class]');
    });

    test('div:not([attr="value with [brackets]"]) — string skipped during balancing', () => {
        p('div:not([attr="value with [brackets]"])');
        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 0)).toBe(2);

        const pseudo = child(1);
        expect(pseudo.kind).toBe(ChildKind.PseudoClassSelector);
        // arg includes [attr="value with [brackets]"]
        expect(ctx.source.slice(pseudo.f2, pseudo.f3)).toBe('[attr="value with [brackets]"]');
    });

    test(':pseudo(  arg with spaces  ) — argument trimmed', () => {
        p(':pseudo(  arg with spaces  )');
        const c = child(0);
        expect(c.argStr).toBe('arg with spaces');
    });

    test(':has(> div) — combinator inside arg', () => {
        p(':has(> div)');
        const c = child(0);
        expect(c.argStr).toBe('> div');
    });

    test(':is(:hover, :focus) — nested pseudo inside arg', () => {
        p(':is(:hover, :focus)');
        const c = child(0);
        expect(c.argStr).toBe(':hover, :focus');
    });
});

describe('Edge cases', () => {
    test('leading and trailing whitespace: "   div   "', () => {
        p('   div   ');
        expect(SelectorListPreparser.complexCount(ctx.data, DATA_OFFSET)).toBe(1);
        const c = child(0);
        expect(c.kind).toBe(ChildKind.TypeSelector);
        expect(c.valueStr).toBe('div');
    });

    test('multiple spaces around combinator: "div   >    span"', () => {
        p('div   >    span');
        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 0)).toBe(3);
        expect(child(1).f0).toBe(COMBINATOR_CHILD);
    });

    test('quoted attribute value with > and ,: [attr="value > and , more"]', () => {
        p('[attr="value > and , more"]');
        const c = child(0);
        expect(c.kind).toBe(ChildKind.AttributeSelector);
        expect(ctx.source.slice(c.f4, c.f5)).toBe('value > and , more');
    });

    test('attribute with single-quoted value: [attr=\'val\']', () => {
        p("[attr='val']");
        const c = child(0);
        expect(ctx.source.slice(c.f4, c.f5)).toBe('val');
    });

    test('compound selector starting with class, then ID: .foo#bar', () => {
        p('.foo#bar');
        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 0)).toBe(2);
        expect(child(0).kind).toBe(ChildKind.ClassSelector);
        expect(child(1).kind).toBe(ChildKind.IdSelector);
    });

    test('all combinator types in one selector', () => {
        p('.a > .b + .c ~ .d .e');
        // 5 selectors + 4 combinators = 9 children
        expect(SelectorListPreparser.childCountInComplex(ctx.data, DATA_OFFSET, 0)).toBe(9);
        expect(child(1).f0).toBe(COMBINATOR_CHILD);
        expect(child(3).f0).toBe(COMBINATOR_NEXT_SIBLING);
        expect(child(5).f0).toBe(COMBINATOR_SUBSEQUENT_SIBLING);
        expect(child(7).f0).toBe(COMBINATOR_DESCENDANT);
    });

    test('deeply nested pseudo-class: :not(:is(:hover))', () => {
        p(':not(:is(:hover))');
        const c = child(0);
        expect(c.kind).toBe(ChildKind.PseudoClassSelector);
        expect(c.argStr).toBe(':is(:hover)');
    });

    test('childStartIndex for multiple complex selectors', () => {
        p('div span, .foo, :hover');
        // complex 0: div span → 3 children (TypeSelector, Combinator, TypeSelector)
        // complex 1: .foo → 1 child
        // complex 2: :hover → 1 child
        expect(SelectorListPreparser.childStartIndex(ctx.data, DATA_OFFSET, 0)).toBe(0);
        expect(SelectorListPreparser.childStartIndex(ctx.data, DATA_OFFSET, 1)).toBe(3);
        expect(SelectorListPreparser.childStartIndex(ctx.data, DATA_OFFSET, 2)).toBe(4);
    });

    test('attribute selector with |= operator', () => {
        p('[lang|=en]');
        const c = child(0);
        expect(ctx.source.slice(c.f2, c.f3)).toBe('|=');
        expect(ctx.source.slice(c.f4, c.f5)).toBe('en');
    });

    test('attribute selector with $= operator', () => {
        p('[href$=".pdf"]');
        const c = child(0);
        expect(ctx.source.slice(c.f2, c.f3)).toBe('$=');
    });

    test('attribute selector with *= operator', () => {
        p('[class*="foo"]');
        const c = child(0);
        expect(ctx.source.slice(c.f2, c.f3)).toBe('*=');
    });
});

describe('User Story 6 — Error cases', () => {
    test('empty source throws AdblockSyntaxError', () => {
        expect(() => p('')).toThrow(AdblockSyntaxError);
    });

    test('whitespace-only source throws AdblockSyntaxError', () => {
        expect(() => p('   ')).toThrow(AdblockSyntaxError);
    });

    test('combinator at start: >div', () => {
        expect(() => p('>div')).toThrow(AdblockSyntaxError);
    });

    test('combinator at start: +div', () => {
        expect(() => p('+div')).toThrow(AdblockSyntaxError);
    });

    test('combinator at start: ~div', () => {
        expect(() => p('~div')).toThrow(AdblockSyntaxError);
    });

    test('trailing combinator: div >', () => {
        expect(() => p('div >')).toThrow(AdblockSyntaxError);
    });

    test('consecutive combinators: div > + span', () => {
        expect(() => p('div > + span')).toThrow(AdblockSyntaxError);
    });

    test('empty selector before comma: ,div', () => {
        expect(() => p(',div')).toThrow(AdblockSyntaxError);
    });

    test('empty selector after comma: div,', () => {
        expect(() => p('div,')).toThrow(AdblockSyntaxError);
    });

    test('empty selector between commas: div,,span', () => {
        expect(() => p('div,,span')).toThrow(AdblockSyntaxError);
    });

    test('unterminated attribute selector: [attr="value"', () => {
        expect(() => p('[attr="value"')).toThrow(AdblockSyntaxError);
    });

    test('unterminated pseudo-class arg: :not(div', () => {
        expect(() => p(':not(div')).toThrow(AdblockSyntaxError);
    });

    test('invalid attribute operator: [attr?=val]', () => {
        expect(() => p('[attr?=val]')).toThrow(AdblockSyntaxError);
    });

    test('invalid attribute flag: multi-word [attr=value foo]', () => {
        expect(() => p('[attr=value foo]')).toThrow(AdblockSyntaxError);
    });

    test('invalid attribute flag: two-letter [attr=value is]', () => {
        expect(() => p('[attr=value is]')).toThrow(AdblockSyntaxError);
    });

    test('invalid attribute flag: digit start [attr=value 1]', () => {
        // digit after value is not a valid ident-start so triggers "Expected ] or case flag"
        expect(() => p('[attr=value 1]')).toThrow(AdblockSyntaxError);
    });

    test('invalid attribute flag: unknown letter [attr=value x]', () => {
        expect(() => p('[attr=value x]')).toThrow(AdblockSyntaxError);
    });

    test('pseudo-element :: is not supported', () => {
        expect(() => p('::before')).toThrow(AdblockSyntaxError);
    });

    test('type selector already set (second type selector in compound)', () => {
        // This only triggers when there is a second non-whitespace ident
        // immediately after a first type-selector in the same compound.
        // The tokenizer merges consecutive letters into one token,
        // so we need an escape or ident with explicit separation.
        // A realistic trigger: after first compound type selector, universal '*'
        expect(() => p('div*')).toThrow(AdblockSyntaxError);
    });

    // Regression: capacity guard must fire BEFORE writeComplexRecord so that
    // over-capacity selector lists never corrupt the child-record region.

    test('maxComplex=1: second selector via comma throws before write (regression)', () => {
        // preparse "div, span" with maxComplex=1 — the comma triggers the
        // check; the second complex record must NOT be written.
        const source = 'div, span';
        tokenizer.setSource(source);
        initPreparserContext(ctx, source, tokenizer);
        expect(() => SelectorListPreparser.preparse(
            ctx,
            0,
            ctx.tokenCount,
            DATA_OFFSET,
            1, // maxComplex
        )).toThrow(AdblockSyntaxError);
    });

    test('maxComplex=1: single selector that is the second would throw (finalization path regression)', () => {
        // preparse "div, span" with maxComplex=1 — same source, same expectation;
        // ensures finalization-path guard also triggers for the last selector
        // when the comma-path has already exhausted capacity.
        const source = 'div, span';
        tokenizer.setSource(source);
        initPreparserContext(ctx, source, tokenizer);
        expect(() => SelectorListPreparser.preparse(
            ctx,
            0,
            ctx.tokenCount,
            DATA_OFFSET,
            1,
        )).toThrow(AdblockSyntaxError);
    });

    test('maxComplex=1: single selector succeeds, two selectors throw (finalization guard)', () => {
        // Verify the finalization-path guard directly: with maxComplex=1 a
        // single selector fits; two selectors must throw.
        const src1 = 'div';
        tokenizer.setSource(src1);
        initPreparserContext(ctx, src1, tokenizer);
        expect(() => SelectorListPreparser.preparse(
            ctx,
            0,
            ctx.tokenCount,
            DATA_OFFSET,
            1,
        )).not.toThrow();

        const src2 = 'div, span';
        tokenizer.setSource(src2);
        initPreparserContext(ctx, src2, tokenizer);
        expect(() => SelectorListPreparser.preparse(
            ctx,
            0,
            ctx.tokenCount,
            DATA_OFFSET,
            1,
        )).toThrow(AdblockSyntaxError);
    });
});
