/**
 * @file Encapsulated typed reader over the cosmetic-rule structural data.
 *
 * Keeps ctx.data layout internal — consumers use semantic getters only.
 */

import { domainRecordsOffset, type ParserContext, scriptletBodyDataOffset } from '../context';

import {
    CR_BODY_END,
    CR_BODY_START,
    CR_DOMAIN_COUNT,
    CR_FLAG_BODY_ADG_SCRIPTLET,
    CR_FLAG_BODY_UBO_SCRIPTLET,
    CR_FLAG_EXCEPTION,
    CR_FLAG_HAS_ADG_MODS,
    CR_FLAG_HAS_UBO_MODS,
    CR_FLAGS_OFFSET,
    CR_SEP_KIND_ABP_SNIPPET,
    CR_SEP_KIND_ADG_CSS_INJECTION,
    CR_SEP_KIND_ADG_HTML_FILTERING,
    CR_SEP_KIND_ADG_JS,
    CR_SEP_KIND_ELEMENT_HIDING,
    CR_SEP_KIND_MASK,
    CR_SEP_KIND_SHIFT,
    CR_SEP_KIND_UBO_HTML_FILTERING,
    CR_SEP_LEN_MASK,
    CR_SEP_LEN_SHIFT,
    CR_SEP_SOURCE_START,
    DOMAIN_FIELD_FLAGS,
    DOMAIN_FIELD_VALUE_END,
    DOMAIN_FIELD_VALUE_START,
    DOMAIN_FLAG_EXCEPTION,
    DOMAIN_RECORD_STRIDE,
} from './constants';

/**
 * A single domain item extracted from cosmetic structural data.
 */
export interface DomainItem {
    /**
     * Domain value (trimmed, with the leading `~` removed for restricted domains).
     */
    value: string;

    /**
     * True when the domain is restricted (prefixed with `~`).
     */
    exception: boolean;
}

/**
 * Named semantic kinds for the cosmetic separator sub-kind exposed by
 * {@link CosmeticRuleDataReader.separatorKind}. These mirror the internal
 * `CR_SEP_KIND_*` bitfield values without exposing the buffer layout, so
 * consumers can make separator-family decisions without reproducing private
 * integer encodings.
 */
export const CosmeticRuleSeparatorKind = {
    /**
     * Element hiding (`##`, `#@#`, `#?#`, `#@?#`).
     */
    ElementHiding: CR_SEP_KIND_ELEMENT_HIDING,

    /**
     * ABP snippet (`#$#`, `#@$#`).
     */
    AbpSnippet: CR_SEP_KIND_ABP_SNIPPET,

    /**
     * ADG JS injection (`#%#`, `#@%#`).
     */
    AdgJs: CR_SEP_KIND_ADG_JS,

    /**
     * ADG HTML filtering (`$$`, `$@$`).
     */
    AdgHtmlFiltering: CR_SEP_KIND_ADG_HTML_FILTERING,

    /**
     * HTML filtering with the uBO `^` body prefix (`##` / `#@#`).
     */
    UboHtmlFiltering: CR_SEP_KIND_UBO_HTML_FILTERING,

    /**
     * ADG CSS injection (`#$#`, `#@$#`, `#$?#`, `#@$?#`).
     */
    AdgCssInjection: CR_SEP_KIND_ADG_CSS_INJECTION,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type CosmeticRuleSeparatorKind = typeof CosmeticRuleSeparatorKind[keyof typeof CosmeticRuleSeparatorKind];

/**
 * Read-only view over the structural data of a single cosmetic rule.
 *
 * **Borrowed-buffer lifetime**: a reader retains the original rule source
 * string and aliases the pipeline's mutable `ctx.data` buffer. It is valid
 * only until the pipeline that produced it parses another rule or its context
 * is otherwise invalidated (`reset`, a subsequent `parse`/`parseStructural`).
 * After that point, getters may return slices unrelated to the original rule.
 * Consumers must read all fields and discard the reader before reusing the
 * pipeline.
 */
export class CosmeticRuleDataReader {
    /**
     * Original rule source string.
     */
    private readonly source: string;

    /**
     * Structural data buffer.
     */
    private readonly data: Int32Array;

    /**
     * Offset within `data` where this rule's record starts.
     */
    private readonly base: number;

    /**
     * Absolute offset within `data` where domain records begin.
     */
    private readonly domainOffset: number;

    /**
     * Absolute offset within `data` where the scriptlet body region begins.
     */
    private readonly scriptletOffset: number;

    /**
     * Creates a cosmetic-rule reader bound to a populated parser context.
     *
     * @param ctx Parser context whose structural data is populated.
     * @param dataOffset Offset within `ctx.data` where this rule's record starts.
     */
    constructor(ctx: ParserContext, dataOffset = 0) {
        this.source = ctx.source;
        this.data = ctx.data;
        this.base = dataOffset;
        this.domainOffset = dataOffset + domainRecordsOffset(ctx);
        this.scriptletOffset = dataOffset + scriptletBodyDataOffset(ctx);
    }

    /**
     * Cosmetic rule flags word.
     *
     * @returns Cosmetic rule flags word.
     */
    private get flags(): number {
        return this.data[this.base + CR_FLAGS_OFFSET];
    }

    /**
     * Whether the rule uses an exception separator.
     *
     * @returns True for exception separators (`#@#`, `#@$#`, …).
     */
    public get exception(): boolean {
        return (this.flags & CR_FLAG_EXCEPTION) !== 0;
    }

    /**
     * Separator sub-kind of the cosmetic rule.
     *
     * @returns Separator sub-kind (`CR_SEP_KIND_*`), exposed as a named
     *   {@link CosmeticRuleSeparatorKind} value.
     */
    public get separatorKind(): CosmeticRuleSeparatorKind {
        // eslint-disable-next-line no-bitwise
        return ((this.flags >>> CR_SEP_KIND_SHIFT) & CR_SEP_KIND_MASK) as CosmeticRuleSeparatorKind;
    }

    /**
     * Whether the rule carries ADG or uBO modifiers.
     *
     * @returns True when the rule carries ADG `[$...]` or uBO modifiers.
     */
    public get hasModifiers(): boolean {
        // eslint-disable-next-line no-bitwise
        return (this.flags & (CR_FLAG_HAS_ADG_MODS | CR_FLAG_HAS_UBO_MODS)) !== 0;
    }

    /**
     * Whether the rule body is a scriptlet.
     *
     * @returns True when the rule body is a scriptlet (ADG, uBO, or ABP snippet).
     */
    public get isScriptlet(): boolean {
        // eslint-disable-next-line no-bitwise
        return (this.flags & (CR_FLAG_BODY_ADG_SCRIPTLET | CR_FLAG_BODY_UBO_SCRIPTLET)) !== 0
            || this.separatorKind === CR_SEP_KIND_ABP_SNIPPET;
    }

    /**
     * Reads the rule body from the source slice.
     *
     * @returns Rule body (trimmed), sliced from source.
     */
    public getBody(): string {
        return this.source.slice(
            this.data[this.base + CR_BODY_START],
            this.data[this.base + CR_BODY_END],
        );
    }

    /**
     * Reads the raw cosmetic separator (e.g. `##`, `#@#`, `#?#`) from source.
     *
     * @returns The cosmetic separator string.
     */
    public getSeparator(): string {
        const start = this.data[this.base + CR_SEP_SOURCE_START];
        // eslint-disable-next-line no-bitwise
        const sepLen = (this.flags >>> CR_SEP_LEN_SHIFT) & CR_SEP_LEN_MASK;
        return this.source.slice(start, start + sepLen);
    }

    /**
     * Number of domain items carried by the rule.
     *
     * @returns Number of domain items.
     */
    public get domainCount(): number {
        return this.data[this.base + CR_DOMAIN_COUNT];
    }

    /**
     * Reads the ordered domain items from the domain records.
     *
     * @returns Ordered domain items with exception flags.
     */
    public getDomains(): DomainItem[] {
        const count = this.domainCount;
        const out: DomainItem[] = [];
        for (let i = 0; i < count; i += 1) {
            const rb = this.domainOffset + i * DOMAIN_RECORD_STRIDE;
            out.push({
                value: this.source.slice(
                    this.data[rb + DOMAIN_FIELD_VALUE_START],
                    this.data[rb + DOMAIN_FIELD_VALUE_END],
                ),
                exception: (this.data[rb + DOMAIN_FIELD_FLAGS] & DOMAIN_FLAG_EXCEPTION) !== 0,
            });
        }
        return out;
    }

    /**
     * Reads the scriptlet parameter boundaries (raw source slices, quotes
     * intact). The first parameter is the scriptlet name for ADG/uBO scriptlets.
     * Empty (`NO_VALUE`) argument slots are preserved as empty strings.
     *
     * Only single-call scriptlet bodies (ADG/uBO) are supported; multi-call
     * ABP snippets must be routed through the AST path.
     *
     * @returns Raw scriptlet parameters, or an empty array when the rule is not
     *   a scriptlet, has no parameters, or uses a multi-call body.
     */
    public getScriptletParams(): string[] {
        if (!this.isScriptlet) {
            return [];
        }

        // Scriptlet body data layout: [+0] snippetCallCount, then per-call
        // [+0] paramCount, [+1] param0Start, [+2] param0End, ... Only the
        // single-call (ADG/uBO) layout is valid here.
        const snippetCallCount = this.data[this.scriptletOffset];
        if (snippetCallCount !== 1) {
            return [];
        }

        const paramCount = this.data[this.scriptletOffset + 1];
        const out: string[] = [];
        for (let i = 0; i < paramCount; i += 1) {
            const pStart = this.data[this.scriptletOffset + 2 + i * 2];
            const pEnd = this.data[this.scriptletOffset + 3 + i * 2];
            // Preserve empty (NO_VALUE) argument slots so callers keep
            // positional information, matching the AST path's null → empty-string
            // handling for supported uBO single-call bodies.
            out.push(pStart < 0 || pEnd < 0 ? '' : this.source.slice(pStart, pEnd));
        }
        return out;
    }
}
