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
     * ExtendedCSS rule strings that the current document holds.
     *
     * The rule set is not guaranteed to stay the same within a document:
     * `getContentScriptData` recomputes it on every call, and a configuration
     * change can produce a different set. Comparing the stored rule set
     * re-injects the ExtendedCSS data when it changes. The frame context is
     * replaced on navigation, and `onCommitted` clears the rule set when the
     * context survives, so it always describes the current document.
     *
     * The hits statistics flag is not part of the state: the payload keeps its
     * rule strings, and its guard compares only them, so a flag-only change
     * never reaches the page.
     */
    public extCssAppliedData?: string[];

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
     * Whether the context may describe a document that holds an ExtendedCSS
     * instance this context did not apply.
     *
     * The startup pass creates a context for a page that was already loaded,
     * so that page can hold an instance applied before the current code ran.
     * Such a document needs a dispose even though no apply is recorded for it.
     * Only the startup pass sets the flag, and `onCommitted` clears it: a new
     * document starts without an instance.
     */
    public extCssInstanceMayExist = false;

    /**
     * Whether the context describes a navigation that has not committed.
     *
     * The request and navigation handlers replace the frame context as soon as
     * a new document starts loading, while the frame still shows the previous
     * document. ExtendedCSS injection waits for the commit, so the incoming
     * document's rules never reach the displayed one. A navigation that never
     * commits, such as a download, keeps the flag and gets no injection.
     */
    public extCssAwaitingCommit = false;

    /**
     * ExtendedCSS injection that is in flight for this context, if any.
     *
     * Injection events can arrive before the previous injection resolves. The
     * marker stops them from sending the same payload again and from starting
     * their own retry chain. It holds the number of the document the injection
     * belongs to, so a commit starts its own injection while a stale injection
     * cannot release the marker of a newer one.
     */
    public extCssInjectionMarker?: number;
}
