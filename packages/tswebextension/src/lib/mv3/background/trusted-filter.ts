/**
 * @file Extends {@link IFilter} with a per-filter trust flag used by the
 * engine to decide whether JS / unsafe cosmetic rules are allowed.
 */

import { Filter, type IFilter } from '@adguard/dnr-converter';

/**
 * Extends {@link IFilter} with a trust flag.
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
}

/**
 * Concrete implementation of {@link ITrustedFilter}.
 *
 * Wraps the lazy-loaded {@link Filter} from `@adguard/dnr-converter` and
 * adds a per-instance trust flag.
 */
export class TrustedFilter extends Filter implements ITrustedFilter {
    /**
     * Whether the filter is trusted by the user.
     */
    private readonly trusted: boolean;

    /**
     * Creates a lazy-loaded TrustedFilter.
     *
     * @param id Numeric filter identifier.
     * @param getSource Zero-argument async callback that resolves to filter content.
     * @param trusted Whether the filter is trusted by the user.
     */
    constructor(id: number, getSource: () => Promise<string>, trusted: boolean) {
        super(id, getSource);
        this.trusted = trusted;
    }

    /** @inheritdoc */
    public isTrusted(): boolean {
        return this.trusted;
    }
}
