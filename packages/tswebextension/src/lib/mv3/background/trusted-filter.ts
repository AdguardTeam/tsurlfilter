/**
 * @file Extends {@link IFilter} with a per-filter trust flag used by the
 * engine to decide whether JS / unsafe cosmetic rules are allowed.
 */

import { Filter, type IFilter } from '@adguard/dnr-converter';
import { type FilterListConversionError } from '@adguard/tsurlfilter';

/**
 * Extends {@link IFilter} with a trust flag and access to conversion errors.
 *
 * Trusted filters (e.g. custom filters explicitly marked as trusted by the
 * user) are allowed to execute JS rules and unsafe cosmetic rules.
 * Untrusted filters have those rule types silently ignored by the engine.
 */
export interface ITrustedFilter extends IFilter {
    /**
     * Returns whether the filter is trusted by the user.
     *
     * @returns `true` if JS / unsafe rules should be applied.
     */
    isTrusted(): boolean;

    /**
     * Returns conversion errors that occurred during FilterList preparation.
     *
     * @returns Array of conversion errors.
     */
    getConversionErrors(): readonly FilterListConversionError[];
}

/**
 * Concrete implementation of {@link ITrustedFilter}.
 *
 * Wraps the pre-loaded {@link Filter} from `@adguard/dnr-converter` and
 * adds a per-instance trust flag and conversion errors.
 */
export class TrustedFilter extends Filter implements ITrustedFilter {
    /**
     * Whether the filter is trusted by the user.
     */
    private readonly trusted: boolean;

    /**
     * Conversion errors from FilterList preparation.
     */
    private readonly conversionErrors: readonly FilterListConversionError[];

    /**
     * Creates a pre-loaded TrustedFilter.
     *
     * @param id Numeric filter identifier.
     * @param content Pre-loaded filter content (one rule per line).
     * @param trusted Whether the filter is trusted by the user.
     * @param conversionErrors Conversion errors that occurred during FilterList preparation.
     */
    constructor(
        id: number,
        content: string,
        trusted: boolean,
        conversionErrors?: readonly FilterListConversionError[],
    ) {
        super(id, content);
        this.trusted = trusted;
        this.conversionErrors = conversionErrors ?? [];
    }

    /** @inheritdoc */
    public isTrusted(): boolean {
        return this.trusted;
    }

    /** @inheritdoc */
    public getConversionErrors(): readonly FilterListConversionError[] {
        return this.conversionErrors;
    }
}
