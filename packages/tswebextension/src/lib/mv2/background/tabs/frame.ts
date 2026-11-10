import { FrameCommon, type PreparedCosmeticResultCommon } from '../../../common/tabs/frame';

/**
 * ExtendedCSS data resolved for a frame.
 */
export type ExtCssFrameData = {
    /**
     * ExtendedCSS rule strings to apply, or null when none match the frame.
     */
    extCssRules: string[] | null;

    /**
     * Whether ExtendedCSS hits statistics are collected for the frame.
     */
    areHitsStatsCollected: boolean;
};

/**
 * ExtendedCSS rule set that a document holds.
 *
 * The applied rules are never empty, unlike the data resolved for a frame,
 * which carries null when no rule matches.
 */
export type ExtCssAppliedData = {
    /**
     * ExtendedCSS rule strings the document holds.
     */
    extCssRules: string[];

    /**
     * Whether ExtendedCSS hits statistics are collected for the rule set.
     */
    areHitsStatsCollected: boolean;
};

/**
 * Prepared cosmetic result for MV2.
 *
 * This type represents the processed cosmetic data extracted from the initial cosmetic result.
 */
export type PreparedCosmeticResultMV2 = PreparedCosmeticResultCommon & ExtCssFrameData & {
    /**
     * Script text extracted from the cosmetic result.
     */
    scriptText: string;
};

/**
 * Frame context data for MV2.
 *
 * @see {@link FrameCommon} description.
 */
export class FrameMV2 extends FrameCommon {
    /**
     * Prepared cosmetic result for the frame in MV2.
     *
     * This data is saved in the frame because it is needed for injecting cosmetic rules into the frames.
     */
    public preparedCosmeticResult?: PreparedCosmeticResultMV2;

    /**
     * ExtendedCSS data resolved from the on-demand cosmetic result.
     *
     * Frames precalculated by the cosmetic frame processor carry this data in
     * `preparedCosmeticResult` instead. It is kept here so repeated injection
     * events do not rebuild the rule strings.
     */
    public extCssData?: ExtCssFrameData;

    /**
     * ExtendedCSS rule set that the current document holds.
     *
     * The rule set is not guaranteed to stay the same within a document:
     * `getContentScriptData` recomputes it on every call, and a configuration
     * change can produce a different set. Comparing the stored rule set
     * re-injects the ExtendedCSS data when it changes. The frame context is
     * replaced on navigation, and `onCommitted` clears the rule set when the
     * context survives, so it always describes the current document.
     */
    public extCssAppliedData?: ExtCssAppliedData;

    /**
     * Number of the document the ExtendedCSS state belongs to.
     *
     * The context survives a same-URL reload, so `documentId` cannot tell two
     * documents apart. The counter is bumped on every commit, and an injection
     * records its result only while the counter is unchanged.
     */
    public extCssDocumentVersion = 0;

    /**
     * Number of the document whose ExtendedCSS instance was disposed.
     *
     * The context can be recreated for a document that already has an
     * instance, so `extCssAppliedData` cannot tell whether an instance
     * must be retired. Disposal is tracked per document, and the injected
     * dispose function is a no-op when the document holds no instance.
     */
    public extCssDisposedDocumentVersion?: number;

    /**
     * ExtendedCSS injection that is in flight for this context, if any.
     *
     * Injection events can arrive before the previous injection resolves. The
     * marker stops them from sending the same payload again and from starting
     * their own retry chain. It also identifies the call that owns it, so a
     * stale injection cannot release the marker of a newer one, and its
     * document version lets a commit start its own injection.
     */
    public extCssInjectionMarker?: { documentVersion: number };
}
