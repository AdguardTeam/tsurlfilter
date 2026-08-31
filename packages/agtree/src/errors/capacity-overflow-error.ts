/**
 * @file Error thrown by pipeline parsers when a buffer would need to
 * grow past its hard cap.
 */

/**
 * Names of the growable regions in the parser context.
 */
export type CapacityRegion = 'tokens' | 'modifiers' | 'domains' | 'scriptletBody';

/**
 * Region identifier for the token buffer.
 */
export const REGION_TOKENS = 'tokens' as const;

/**
 * Region identifier for the modifier buffer.
 */
export const REGION_MODIFIERS = 'modifiers' as const;

/**
 * Region identifier for the domain buffer.
 */
export const REGION_DOMAINS = 'domains' as const;

/**
 * Region identifier for the scriptlet body buffer.
 */
export const REGION_SCRIPTLET_BODY = 'scriptletBody' as const;

/**
 * Union of the three regions that can grow dynamically.
 * Used as the parameter type for {@link growCtxRegion}.
 */
export type GrowableRegion = typeof REGION_MODIFIERS | typeof REGION_DOMAINS | typeof REGION_SCRIPTLET_BODY;

/**
 * Thrown by a pipeline parser when a growable region would need to exceed its
 * hard cap (defined in `src/limits.ts`).
 *
 * The parser clears `ctx.status` before throwing so the same instance is safe
 * to use for the next parse call.
 */
export class CapacityOverflowError extends Error {
    /**
     * The region whose hard cap was exceeded.
     */
    public readonly region: CapacityRegion;

    /**
     * The capacity that was requested (and denied).
     */
    public readonly requested: number;

    /**
     * The hard cap for this region.
     */
    public readonly hardCap: number;

    /**
     * Create a new `CapacityOverflowError`.
     *
     * @param region The buffer region that overflowed.
     * @param requested The capacity that was requested.
     * @param hardCap The hard cap for this region.
     */
    constructor(region: CapacityRegion, requested: number, hardCap: number) {
        super(`Parser ${region} buffer would exceed hard cap (requested ${requested}, max ${hardCap})`);
        this.name = 'CapacityOverflowError';
        this.region = region;
        this.requested = requested;
        this.hardCap = hardCap;
    }
}
