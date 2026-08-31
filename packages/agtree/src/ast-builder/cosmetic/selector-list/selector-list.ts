/**
 * @file CSS selector list AST builder — main dispatcher.
 *
 * Reads parsed data from an Int32Array (produced by
 * `SelectorListParser.parse()`) and builds a SelectorList AST node
 * by iterating complex selector records and dispatching each child record
 * to the appropriate per-type builder function.
 */

import type {
    ComplexSelector,
    SelectorCombinator as SelectorCombinatorNode,
    SelectorList,
    SimpleSelector,
} from '../../../nodes';
import { NodeType } from '../../../nodes';
import { SelectorListParser } from '../../../parser/css/selector-list';
import { CHILD_FIELD_KIND, ChildKind, DEFAULT_MAX_COMPLEX } from '../../../parser/css/selector-list/constants';

import { buildAttributeSelector } from './attribute-selector';
import { buildClassSelector } from './class-selector';
import { buildSelectorCombinator } from './combinator';
import { buildIdSelector } from './id-selector';
import { buildPseudoClassSelector } from './pseudo-class-selector';
import { buildTypeSelector } from './type-selector';

/**
 * Parse options for the selector list AST builder.
 */
export interface SelectorListParseOptions {
    /**
     * Whether to include location info (start/end) in AST nodes.
     *
     * Defaults to `true` to match the behaviour of the old SelectorListParser.
     */
    isLocIncluded?: boolean;
}

/**
 * CSS selector list AST builder.
 *
 * Reads child records from a pre-populated `Int32Array` and produces a typed
 * `SelectorList` AST node. Performs **zero validation** — the parser
 * guarantees structural correctness before this builder is ever called.
 */
export class SelectorListAstBuilder {
    /**
     * Build a SelectorList AST node from parsed data.
     *
     * @param source Original source string (the raw selector substring).
     * @param data Int32Array that was written by `SelectorListParser.parse()`.
     * @param dataOffset Base offset within `data` where selector-list data starts.
     * @param maxComplex Maximum complex selector capacity that was used during parse.
     * @param selectorStart Source offset of the first character of the selector list
     *   (used for `SelectorList.start` when `isLocIncluded` is true).
     * @param selectorEnd Source offset just past the last character of the selector list
     *   (used for `SelectorList.end` when `isLocIncluded` is true).
     * @param options Parse options.
     *
     * @returns SelectorList AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset: number = 0,
        maxComplex: number = DEFAULT_MAX_COMPLEX,
        selectorStart: number = 0,
        selectorEnd: number = source.length,
        options: SelectorListParseOptions = {},
    ): SelectorList {
        const { isLocIncluded = true } = options;

        const complexCount = SelectorListParser.complexCount(data, dataOffset);
        const complexSelectors: ComplexSelector[] = new Array(complexCount);

        for (let ci = 0; ci < complexCount; ci += 1) {
            const childCount = SelectorListParser.childCountInComplex(data, dataOffset, ci);
            const childStart = SelectorListParser.childStartIndex(data, dataOffset, ci);

            const children: (SimpleSelector | SelectorCombinatorNode)[] = new Array(childCount);

            for (let j = 0; j < childCount; j += 1) {
                const globalChildIdx = childStart + j;
                const base = SelectorListParser.childBase(dataOffset, maxComplex, globalChildIdx);
                const kind: ChildKind = data[base + CHILD_FIELD_KIND];

                switch (kind) {
                    case ChildKind.TypeSelector:
                        children[j] = buildTypeSelector(source, data, base, isLocIncluded);
                        break;
                    case ChildKind.IdSelector:
                        children[j] = buildIdSelector(source, data, base, isLocIncluded);
                        break;
                    case ChildKind.ClassSelector:
                        children[j] = buildClassSelector(source, data, base, isLocIncluded);
                        break;
                    case ChildKind.AttributeSelector:
                        children[j] = buildAttributeSelector(source, data, base, isLocIncluded);
                        break;
                    case ChildKind.PseudoClassSelector:
                        children[j] = buildPseudoClassSelector(source, data, base, isLocIncluded);
                        break;
                    case ChildKind.SelectorCombinator:
                        children[j] = buildSelectorCombinator(source, data, base, isLocIncluded);
                        break;
                    default:
                        throw new Error(`Unknown ChildKind: ${kind}`);
                }
            }

            const complexNode: ComplexSelector = {
                type: NodeType.ComplexSelector,
                children,
            };

            if (isLocIncluded) {
                complexNode.start = SelectorListParser.complexSourceStart(data, dataOffset, ci);
                complexNode.end = SelectorListParser.complexSourceEnd(data, dataOffset, ci);
            }

            complexSelectors[ci] = complexNode;
        }

        const node: SelectorList = {
            type: NodeType.SelectorList,
            children: complexSelectors,
        };

        if (isLocIncluded) {
            node.start = selectorStart;
            node.end = selectorEnd;
        }

        return node;
    }
}
