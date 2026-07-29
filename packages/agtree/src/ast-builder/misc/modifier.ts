/* eslint-disable no-bitwise */

/**
 * @file Modifier parser — creates Modifier AST nodes from parsed data.
 *
 * Delegates value node creation to {@link ValueAstBuilder}.
 */

import { NodeType, ValueKind } from '../../nodes';
import type { Modifier } from '../../nodes';
import {
    MOD_KIND_CSP,
    MOD_KIND_DOMAIN_LIST,
    MOD_KIND_REGEX,
    MOD_KIND_RESOURCE,
    MODIFIER_FIELD_FLAGS,
    MODIFIER_FIELD_NAME_END,
    MODIFIER_FIELD_NAME_START,
    MODIFIER_FIELD_VALUE_END,
    MODIFIER_FIELD_VALUE_START,
    MODIFIER_FLAG_NEGATED,
    MODIFIER_RECORD_STRIDE,
    MODIFIER_VALUE_KIND_MASK,
    MODIFIER_VALUE_KIND_SHIFT,
    NO_VALUE,
    NR_MODIFIER_RECORDS_OFFSET,
} from '../../parser/network/constants';

import { ValueAstBuilder } from './value';

/**
 * Parser for Modifier AST nodes.
 *
 * Delegates value node creation to {@link ValueAstBuilder}.
 */
export class ModifierAstBuilder {
    /**
     * Builds a Modifier AST node from parsed data at the given index.
     *
     * @param source Original source string.
     * @param data Preparsed data buffer.
     * @param idx Modifier index (0-based).
     * @param isLocIncluded Whether to include location info.
     * @param recordsOffset Buffer offset where records begin (default: network rule offset).
     *
     * @returns Modifier AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        idx: number,
        isLocIncluded: boolean,
        recordsOffset: number = NR_MODIFIER_RECORDS_OFFSET,
    ): Modifier {
        const base = recordsOffset + idx * MODIFIER_RECORD_STRIDE;

        const nameStart = data[base + MODIFIER_FIELD_NAME_START];
        const nameEnd = data[base + MODIFIER_FIELD_NAME_END];
        const modFlags = data[base + MODIFIER_FIELD_FLAGS];
        const valStart = data[base + MODIFIER_FIELD_VALUE_START];
        const valEnd = data[base + MODIFIER_FIELD_VALUE_END];

        const rawKindBits = (modFlags >>> MODIFIER_VALUE_KIND_SHIFT) & MODIFIER_VALUE_KIND_MASK;

        // Modifier name is always a plain identifier
        const name = ValueAstBuilder.parse(source, nameStart, nameEnd, isLocIncluded, ValueKind.Identifier);

        const modifier: Modifier = {
            type: NodeType.Modifier,
            name,
            exception: (modFlags & MODIFIER_FLAG_NEGATED) !== 0,
        };

        if (valStart !== NO_VALUE) {
            // Domain lists and CSP directives are sub-parseable → use Raw
            if (rawKindBits === MOD_KIND_DOMAIN_LIST || rawKindBits === MOD_KIND_CSP) {
                const valueKind = rawKindBits === MOD_KIND_DOMAIN_LIST
                    ? ValueKind.DomainList
                    : ValueKind.Csp;
                modifier.value = ValueAstBuilder.parseRaw(source, valStart, valEnd, isLocIncluded, valueKind);
            } else {
                // All other values (identifiers, regex, resource, unknown) → Value
                const valueKind = ModifierAstBuilder.bitsToValueKind(rawKindBits);
                modifier.value = ValueAstBuilder.parse(source, valStart, valEnd, isLocIncluded, valueKind);
            }
        }

        if (isLocIncluded) {
            modifier.start = nameStart;
            modifier.end = valStart !== NO_VALUE ? valEnd : nameEnd;
        }

        return modifier;
    }

    /**
     * Maps raw kind bits from the binary buffer to a {@link ValueKind} enum value.
     *
     * @param bits Kind bits read from modifier flags.
     *
     * @returns Corresponding ValueKind, or undefined if unknown.
     */
    private static bitsToValueKind(bits: number): ValueKind | undefined {
        if (bits === MOD_KIND_REGEX) { return ValueKind.Regex; }
        if (bits === MOD_KIND_RESOURCE) { return ValueKind.Resource; }
        return undefined;
    }
}
