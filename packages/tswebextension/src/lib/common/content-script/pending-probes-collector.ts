/**
 * Detached element collected by {@link PendingProbesCollector} before the
 * CSS hits counter is created.
 *
 * The element reference is kept because the hidden state is encoded in the
 * computed style and can only be read while the element is in the document.
 */
export interface PendingProbe {
    /**
     * Detached element.
     */
    element: Element;

    /**
     * Node the element was added to or removed from.
     */
    target: Node;

    /**
     * Sibling preceding the element at the moment of the mutation, if any.
     */
    previousSibling: Node | null;

    /**
     * Sibling following the element at the moment of the mutation, if any.
     */
    nextSibling: Node | null;
}

/**
 * Tags that must never be temporarily re-inserted into the page.
 *
 * Baits are hidden content elements, usually `div`/`span`, while re-inserting
 * resource-bearing or structural tags can re-run page side effects: re-issue
 * network requests, reload a frame, re-apply styles or fire custom element
 * callbacks. The counter re-inserts collected elements to read their computed
 * style, so such tags must not be collected.
 */
const IGNORED_TAGS = [
    'script', 'html', 'body', 'head', 'style', 'link', 'meta', 'title', 'base',
    'img', 'picture', 'source', 'iframe', 'frame', 'object', 'embed', 'video',
    'audio', 'track', 'svg',
];

/**
 * Tags inside a probe's subtree that make the whole subtree non-restorable.
 *
 * Re-inserting these re-runs page side effects: reloads a frame, re-issues a
 * network request or restarts media. The list is narrower than
 * {@link IGNORED_TAGS}: it must not include tags whose re-insertion is safe,
 * otherwise baits that contain them (e.g. an anti-adblock bait with a
 * `<script>` child, which is common) are never restored and their hits are
 * lost. In particular, an already executed `<script>` does not run again when
 * it is re-inserted, so scripts are allowed in subtrees.
 */
const RESTRICTED_SUBTREE_TAGS = [
    'link', 'img', 'picture', 'source', 'iframe', 'frame', 'object', 'embed',
    'video', 'audio', 'track',
    // SVG image elements load their `href`, so they are resource-bearing
    // even though the `svg` root itself is safe for inline graphics.
    'image',
];

/**
 * Checks whether an element with the given tag must not be re-inserted as
 * part of a probe's subtree.
 *
 * @param tagName Tag name to check.
 *
 * @returns True if the tag makes the subtree non-restorable.
 */
export const isRestrictedSubtreeTag = (tagName: string): boolean => {
    const normalizedTagName = tagName.toLowerCase();

    return RESTRICTED_SUBTREE_TAGS.includes(normalizedTagName)
        // Custom elements run their callbacks on re-insertion.
        || normalizedTagName.includes('-');
};

/**
 * Checks whether an element with the given tag must never be temporarily
 * re-inserted into the page.
 *
 * Custom elements are rejected as well: re-inserting them runs page-side
 * callbacks (`connectedCallback`/`disconnectedCallback`), which is exactly
 * the kind of page code the counter must not trigger.
 *
 * @param tagName Tag name to check.
 *
 * @returns True if the tag is ignored.
 */
export const isIgnoredProbeTag = (tagName: string): boolean => {
    const normalizedTagName = tagName.toLowerCase();

    return IGNORED_TAGS.includes(normalizedTagName)
        // Custom element names must contain a hyphen.
        || normalizedTagName.includes('-');
};

/**
 * Checks whether a detached element can be safely re-inserted into the page
 * to read its computed style.
 *
 * The check covers the element itself and its whole subtree: re-inserting a
 * `div` that contains an `iframe` reloads the frame, and a custom element
 * inside runs its callbacks, even though the root tag looks safe. Subtrees
 * are checked against {@link RESTRICTED_SUBTREE_TAGS}, which is narrower than
 * {@link IGNORED_TAGS} to keep baits with safe children, e.g. scripts,
 * restorable.
 *
 * @param element Detached element to check.
 * @param descendants Descendants of the element, if already collected by the
 * caller. When omitted, the subtree is queried.
 *
 * @returns True if the element can be re-inserted.
 */
export const isProbeRestorable = (element: Element, descendants?: Element[]): boolean => {
    if (isIgnoredProbeTag(element.tagName)) {
        return false;
    }

    if (descendants) {
        for (let i = 0; i < descendants.length; i += 1) {
            if (isRestrictedSubtreeTag(descendants[i].tagName)) {
                return false;
            }
        }

        return true;
    }

    const children = element.querySelectorAll('*');
    for (let i = 0; i < children.length; i += 1) {
        if (isRestrictedSubtreeTag(children[i].tagName)) {
            return false;
        }
    }

    return true;
};

/**
 * Maximum number of probes kept in a pending queue.
 *
 * The collector uses it to bound its buffer, and the counter uses it to bound
 * the queue it accumulates while the collector keeps observing. When the
 * queue is full, new elements are dropped: baits are usually created by a
 * script in `<head>`, so the earliest probes are the valuable ones, while
 * later churn is more likely to be unrelated. Dropped elements are not marked
 * as seen, so if the page adds and removes one again after the queue is
 * drained, it can still be collected.
 */
export const MAX_PENDING_PROBES = 500;

/**
 * Collects short-lived elements that are added and removed during the
 * document loading.
 *
 * The counter is created asynchronously, after the cosmetic data is received
 * from the background. Until then, the page can already create and remove
 * anti-adblock probe elements, for example from a script in `<head>`. This
 * collector observes the DOM from the very beginning of the document loading
 * and keeps references to such elements, so that the counter can check them
 * once it is initialized.
 *
 * The collector stays alive after the counter is initialized and keeps
 * feeding newly collected probes to it: a bait can be added during the
 * loading and removed later, after the counter already exists. It stops
 * observing when it is stopped explicitly or after
 * {@link MAX_OBSERVATION_TIME_MS}.
 */
export class PendingProbesCollector {
    /**
     * Maximum observation time in milliseconds.
     *
     * If the counter is not initialized by then (e.g. the background is not
     * responding), the observer is disconnected and the collected elements
     * are dropped to avoid a permanent overhead and DOM retention on the
     * page.
     */
    private static readonly MAX_OBSERVATION_TIME_MS = 30000;

    /**
     * Mutation observer.
     */
    private observer: MutationObserver | null = null;

    /**
     * Collected elements.
     */
    private pendingProbes: PendingProbe[] = [];

    /**
     * Roots of subtrees appended during the observation window.
     *
     * Used to detect elements that were added and then removed later: the
     * removal callback checks the removed element and the node it was removed
     * from against this set, walking up the still-linked ancestor chain. Only
     * roots are stored, because a mutation record reports only the root of an
     * appended subtree.
     */
    private addedElements = new WeakSet<Element>();

    /**
     * Deduplication set for collected elements.
     */
    private collectedElements = new WeakSet<Element>();

    /**
     * Timer disconnecting the observer after {@link MAX_OBSERVATION_TIME_MS}.
     */
    private observationTimeoutId: number | null = null;

    /**
     * Callback receiving newly collected probes.
     */
    private onProbesCollected: ((probes: PendingProbe[]) => void) | null = null;

    /**
     * Callback invoked when observation ends without an explicit stop, e.g.
     * after {@link MAX_OBSERVATION_TIME_MS}.
     */
    private onObservationEnded: (() => void) | null = null;

    /**
     * Whether the collector is currently observing the DOM.
     *
     * @returns True if the collector is observing.
     */
    public get isObserving(): boolean {
        return this.observer !== null;
    }

    /**
     * Starts DOM observation.
     */
    public start(): void {
        if (this.observer) {
            return;
        }

        const { MutationObserver } = window;
        if (!MutationObserver) {
            return;
        }

        this.observer = new MutationObserver((mutationRecords) => {
            this.collectProbes(mutationRecords, true);
        });

        // `document.documentElement` may not exist yet at `document_start`,
        // so observe the document itself.
        this.observer.observe(document, {
            childList: true,
            subtree: true,
        });

        this.observationTimeoutId = window.setTimeout(() => {
            this.observationTimeoutId = null;
            this.disconnect();
        }, PendingProbesCollector.MAX_OBSERVATION_TIME_MS);
    }

    /**
     * Sets a callback receiving newly collected probes.
     *
     * Probes collected before the callback is set are passed to it
     * immediately.
     *
     * @param callback Callback receiving collected probes, or `null` to
     * unsubscribe.
     */
    public setOnProbesCollected(callback: ((probes: PendingProbe[]) => void) | null): void {
        this.onProbesCollected = callback;

        if (callback) {
            // Flush undelivered records and the buffer, so probes collected
            // before the subscription are not lost.
            const probes = this.takePendingProbes();
            if (probes.length > 0) {
                callback(probes);
            }
        }
    }

    /**
     * Sets a callback invoked when observation ends without an explicit stop.
     *
     * The counter uses it to start its own observer if the collector times
     * out while the document is still loading.
     *
     * @param callback Callback invoked when observation ends, or `null` to
     * unsubscribe.
     */
    public setOnObservationEnded(callback: (() => void) | null): void {
        this.onObservationEnded = callback;
    }

    /**
     * Returns collected probes and keeps observing.
     *
     * Mutation records that have not been delivered yet are processed before
     * returning, so no collected element is lost at the handover to the
     * counter.
     *
     * @returns Probes collected since the previous take.
     */
    public takePendingProbes(): PendingProbe[] {
        this.flushQueuedRecords();

        const probes = this.pendingProbes;
        this.pendingProbes = [];

        return probes;
    }

    /**
     * Stops observation and drops collected elements.
     */
    public stop(): void {
        this.onProbesCollected = null;
        // An explicit stop must not make the counter start its observer.
        this.onObservationEnded = null;
        this.disconnect();
        this.pendingProbes = [];
    }

    /**
     * Disconnects the observer, cancels the observation timeout and drops
     * collected elements.
     */
    private disconnect(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.observationTimeoutId !== null) {
            window.clearTimeout(this.observationTimeoutId);
            this.observationTimeoutId = null;
        }

        // Do not retain detached DOM subtrees once observation ends: the
        // probes collected so far are stale and would otherwise live for the
        // page lifetime.
        this.pendingProbes = [];

        // Notify the subscriber, e.g. so the counter can start its own
        // observer if the collector times out while the document is still
        // loading. An explicit stop() clears the callback first.
        this.onObservationEnded?.();
    }

    /**
     * Processes mutation records that are queued but not delivered yet.
     */
    private flushQueuedRecords(): void {
        if (this.observer) {
            this.collectProbes(this.observer.takeRecords(), false);
        }
    }

    /**
     * Collects detached elements from mutation records.
     *
     * @param mutationRecords Mutation records delivered by the observer.
     * @param notify Flag telling whether the subscriber should be notified
     * about newly collected probes.
     */
    private collectProbes(mutationRecords: MutationRecord[], notify: boolean): void {
        let hasNewProbes = false;

        for (let i = 0; i < mutationRecords.length; i += 1) {
            const mutationRecord = mutationRecords[i];

            const { addedNodes } = mutationRecord;
            for (let j = 0; j < addedNodes.length; j += 1) {
                const node = addedNodes[j];
                if (node.nodeType !== node.ELEMENT_NODE) {
                    continue;
                }

                const element = node as Element;

                // The element was added and already removed before the
                // observer callback has been invoked.
                if (!element.parentNode) {
                    if (PendingProbesCollector.isCollectableNode(element)) {
                        // Remember the element even if the queue is full, so
                        // it can be collected when it is removed after the
                        // queue has been drained.
                        this.addedElements.add(element);
                        hasNewProbes = this.collectProbe(element, mutationRecord) || hasNewProbes;
                    }

                    continue;
                }

                // Remember only the appended root: a mutation record reports
                // just the root of an appended subtree. Descendants are
                // resolved lazily on removal by walking up from the removal
                // target, so no subtree scan is needed here.
                this.addedElements.add(element);
            }

            const { removedNodes } = mutationRecord;
            for (let j = 0; j < removedNodes.length; j += 1) {
                const node = removedNodes[j];
                if (!PendingProbesCollector.isCollectableNode(node)) {
                    continue;
                }

                // The element was added during the observation window and
                // removed later.
                if (!node.parentNode
                    && this.wasAddedDuringObservation(node, mutationRecord.target)) {
                    hasNewProbes = this.collectProbe(node, mutationRecord) || hasNewProbes;
                }
            }
        }

        if (!hasNewProbes || !notify || !this.onProbesCollected) {
            return;
        }

        const probes = this.pendingProbes;
        this.pendingProbes = [];
        this.onProbesCollected(probes);
    }

    /**
     * Checks whether an element was added during the observation window.
     *
     * A mutation record reports only the root of an appended subtree, so a
     * removed descendant has no addition record of its own. It was still
     * added during the window if it was reported as added itself, or if the
     * node it was removed from (or one of its ancestors) was appended during
     * the window: in that case the element came with that subtree, or was
     * added later and has its own addition record.
     *
     * The ancestor chain is still linked for a detached subtree, so this also
     * covers an element removed in the same task its container was appended
     * in, before the observer callback runs.
     *
     * @param node Removed element.
     * @param target Node the element was removed from.
     *
     * @returns True if the element was added during the observation.
     */
    private wasAddedDuringObservation(node: Element, target: Node): boolean {
        if (this.addedElements.has(node)) {
            return true;
        }

        let current: Node | null = target;
        while (current) {
            if (current instanceof Element && this.addedElements.has(current)) {
                return true;
            }

            current = current.parentNode;
        }

        return false;
    }

    /**
     * Stores a detached element.
     *
     * The element is not stored if it cannot be safely re-inserted (see
     * {@link isProbeRestorable}) or if the queue is full.
     *
     * @param element Detached element.
     * @param mutationRecord Mutation record the element was found in.
     *
     * @returns True if the element was stored.
     */
    private collectProbe(element: Element, mutationRecord: MutationRecord): boolean {
        if (this.collectedElements.has(element)) {
            return false;
        }

        if (this.pendingProbes.length >= MAX_PENDING_PROBES) {
            // Keep the earliest probes. The element is not marked as seen, so
            // if the page adds and removes it again after the queue is
            // drained, it can still be collected. Check the cap before
            // scanning the subtree: when the queue is full, the scan would be
            // wasted work for an element that is dropped anyway.
            return false;
        }

        if (!isProbeRestorable(element)) {
            // Mark the element as seen to avoid rescanning its subtree on
            // every repeated mutation record.
            this.collectedElements.add(element);
            return false;
        }

        this.collectedElements.add(element);

        this.pendingProbes.push({
            element,
            target: mutationRecord.target,
            previousSibling: mutationRecord.previousSibling,
            nextSibling: mutationRecord.nextSibling,
        });

        return true;
    }

    /**
     * Checks if the node should be collected.
     *
     * @param node Node to check.
     *
     * @returns True if the node is an element with a re-insertable tag.
     */
    private static isCollectableNode(node: Node): node is Element {
        // `node.ELEMENT_NODE` is used instead of the `Element` global, so the
        // check does not depend on the global scope availability.
        return node.nodeType === node.ELEMENT_NODE
            && !isIgnoredProbeTag((node as Element).tagName);
    }
}
