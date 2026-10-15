import { type IAffectedElement } from '@adguard/extended-css';

import { SEMICOLON } from '../constants';
import { type RuleInfoBasic } from '../rule-info';

import { HitsStorage } from './hits-storage';
import { type PendingProbe, type PendingProbesCollector } from './pending-probes-collector';
import { ElementUtils } from './utils/element-utils';

/**
 * Counted element data structure.
 * Rule texts are resolved in the background, so only filterId/ruleIndex are sent from content script.
 */
type ICountedElement = RuleInfoBasic & { element: string | Element };

const DEFAULT_ELEMENT_TO_STRING = true;

/**
 * CssHitsCounter options.
 */
interface CssHitsCounterOptions {
    /**
     * Flag determining if the element should be converted to a string.
     * If true, the element is converted to a string.
     * Otherwise, the element is left as is, which might be helpful in corelibs,
     * where logs are printed in the developer tools console.
     * By default, is true.
     */
    elementToString?: boolean;

    /**
     * Elements that were added and removed before the counter was created
     * (see {@link PendingProbesCollector}).
     */
    pendingProbes?: PendingProbe[];

    /**
     * Collector of short-lived elements. When set, the counter takes the
     * already collected probes and subscribes to the collector, so probes
     * collected later — e.g. elements added during the loading and removed
     * after the counter initialization — are counted as well. The collector
     * is stopped together with the counter.
     */
    pendingProbesCollector?: PendingProbesCollector;
}

/**
 * Collects CSS hits. Markers are injected by the cosmetic emitter as the
 * `--adguard-hit` custom property (see `CosmeticApiCommon`); the reader
 * probes each element's computed style and reports matches via the
 * callback passed to the constructor.
 */
export class CssHitsCounter {
    /**
     * We split CSS hits counting into smaller batches of elements and schedule them one by one using setTimeout.
     */
    private static readonly COUNT_CSS_HITS_BATCH_DELAY = 5;

    /**
     * Size of small batches of elements we count.
     */
    private static readonly CSS_HITS_BATCH_SIZE = 25;

    /**
     * Marker value prefix; encodes as `adguard<id>%3B<idx>`.
     */
    private static readonly MARKER_PREFIX = 'adguard';

    /**
     * Custom property carrying the marker (see `CosmeticApiCommon`).
     */
    private static readonly MARKER_PROPERTY_NAME = '--adguard-hit';

    /**
     * We delay countAllCssHits function if it was called too frequently from mutationObserver.
     */
    private static readonly COUNT_ALL_CSS_HITS_TIMEOUT_MS = 500;

    /**
     * Delay between attempts to count pending probes, in milliseconds.
     *
     * The marker styles may be injected slightly later than the cosmetic
     * data is received, so a probe that does not match any rule yet is
     * reinserted and checked again.
     */
    private static readonly PENDING_PROBES_RETRY_DELAY_MS = 100;

    /**
     * Number of attempts to count pending probes.
     */
    private static readonly PENDING_PROBES_MAX_ATTEMPTS = 5;

    /**
     * Callback function for counted css hits handling.
     */
    private onCssHitsFoundCallback: (x: ICountedElement[]) => void;

    /**
     * Hits storage.
     */
    private hitsStorage: HitsStorage = new HitsStorage();

    /**
     * Mutation observer.
     */
    private observer: MutationObserver | null = null;

    /**
     * Counting on process flag.
     */
    private countIsWorking = false;

    /**
     * Probes collected before and after the counter initialization.
     */
    private pendingProbes: PendingProbe[] = [];

    /**
     * Collector feeding the counter with short-lived elements, if any.
     */
    private pendingProbesCollector: PendingProbesCollector | null = null;

    /**
     * Number of counting attempts already performed for each pending probe.
     *
     * Attempts are tracked per probe, so probes delivered later get their own
     * retry budget instead of sharing the in-flight one.
     */
    private pendingProbeAttempts = new WeakMap<PendingProbe, number>();

    /**
     * Timer for the next attempt to count {@link pendingProbes}.
     */
    private pendingProbesTimeoutId: number | null = null;

    /**
     * Lifecycle cleanup flag. Delayed callbacks check it before doing work.
     */
    private stopped = false;

    /**
     * Flag determining if we should convert elements to string, or not.
     *
     * @private
     */
    private elementToString = DEFAULT_ELEMENT_TO_STRING;

    /**
     * Bound readystatechange listener, stored so stop() can remove the same
     * function reference.
     */
    private readonly boundStartCounter = this.startCounter.bind(this);

    /**
     * Attaches the mutation observer immediately while the document is still
     * loading, so elements added and removed before the document becomes
     * interactive are not missed. The full DOM scan is performed once the
     * document is interactive or complete.
     *
     * @param callback Which receives {@link ICountedElement} and handles counted css hits.
     * @param options CssHitsCounter options.
     */
    constructor(callback: (x: ICountedElement[]) => void, options?: CssHitsCounterOptions) {
        if (options) {
            const { elementToString, pendingProbes, pendingProbesCollector } = options;
            if (elementToString !== undefined) {
                this.elementToString = elementToString;
            }
            if (pendingProbes && pendingProbes.length > 0) {
                this.pendingProbes = pendingProbes;
            }
            if (pendingProbesCollector) {
                this.pendingProbesCollector = pendingProbesCollector;

                const collectedProbes = pendingProbesCollector.takePendingProbes();
                if (collectedProbes.length > 0) {
                    this.pendingProbes.push(...collectedProbes);
                }

                pendingProbesCollector.setOnProbesCollected((probes) => {
                    this.addPendingProbes(probes);
                });
            }
        }

        this.onCssHitsFoundCallback = callback;

        if (document.readyState === 'complete'
            || document.readyState === 'interactive') {
            this.countCssHits();
        } else {
            // Start observing immediately during the document loading.
            // Waiting for `readystatechange` misses elements that are added
            // and removed before the document becomes interactive.
            this.countCssHitsForMutations();
            document.addEventListener('readystatechange', this.boundStartCounter);
        }

        // Probes collected before the counter initialization are counted
        // after the observer is attached, so no mutation can slip between
        // the two.
        this.countPendingProbes();
    }

    /**
     * Stops css hits counting process.
     */
    public stop(): void {
        this.stopped = true;
        this.onCssHitsFoundCallback = (): void => {};

        if (this.observer) {
            this.observer.disconnect();
        }

        if (this.pendingProbesTimeoutId !== null) {
            window.clearTimeout(this.pendingProbesTimeoutId);
            this.pendingProbesTimeoutId = null;
        }

        if (this.pendingProbesCollector) {
            this.pendingProbesCollector.stop();
            this.pendingProbesCollector = null;
        }

        this.pendingProbes = [];
        document.removeEventListener('readystatechange', this.boundStartCounter);
    }

    /**
     * Adds probes collected after the counter initialization.
     *
     * The probes are counted by the regular probe processing pass. If a pass
     * or a retry is already scheduled, the new probes are picked up by it and
     * get their own retry budget.
     *
     * @param probes Probes collected by {@link PendingProbesCollector}.
     */
    public addPendingProbes(probes: PendingProbe[]): void {
        if (this.stopped || probes.length === 0) {
            return;
        }

        this.pendingProbes.push(...probes);

        if (this.pendingProbesTimeoutId !== null) {
            // A pass or a retry is already scheduled and will pick the new
            // probes up.
            return;
        }

        this.pendingProbesTimeoutId = window.setTimeout(() => {
            this.pendingProbesTimeoutId = null;
            this.countPendingProbes();
        }, 0);
    }

    /**
     * ExtendedCss callback: reads the legacy `content:` marker from the
     * parsed rule object, reports a hit, and clears the marker so it
     * never reaches the DOM.
     *
     * The ExtendedCss path was *not* affected by AG-265 — its rules are
     * applied imperatively, never inserted as a stylesheet, so the
     * `content:` marker cannot leak. Reading from the parsed object is
     * required because ExtendedCss invokes this callback **before**
     * `setStyleToElement` writes anything to the node, so computed
     * style is not yet populated. After parsing, the marker declaration
     * is blanked to prevent any visible flash on rules that do not also
     * hide the element.
     *
     * @param affectedEl Affected element from ExtendedCss.
     *
     * @returns The same affected element, unchanged.
     */
    public countAffectedByExtendedCss(affectedEl: IAffectedElement): IAffectedElement {
        if (affectedEl && affectedEl.rules && affectedEl.rules.length > 0) {
            const result = [];

            for (const rule of affectedEl.rules) {
                if (rule.style && rule.style.content) {
                    const ruleInfo = ElementUtils.parseExtendedStyleInfo(
                        rule.style.content,
                        CssHitsCounter.MARKER_PREFIX,
                    );
                    if (ruleInfo === null) {
                        continue;
                    }

                    const { filterId, ruleIndex } = ruleInfo;
                    if (filterId !== undefined && ruleIndex !== undefined) {
                        const element = this.elementToString
                            ? ElementUtils.elementToString(affectedEl.node)
                            : affectedEl.node;

                        result.push({
                            filterId,
                            ruleIndex,
                            element,
                        });

                        // clear style content to avoid duplicate counting and
                        // to prevent the marker text from being painted.
                        rule.style.content = '';
                    }
                }
            }

            this.onCssHitsFoundCallback(result);
        }

        return affectedEl;
    }

    /**
     * Starts counting process.
     */
    private startCounter(): void {
        if (this.stopped) {
            return;
        }

        if (document.readyState === 'interactive'
            || document.readyState === 'complete') {
            // The observer is already attached during loading; here we only
            // perform the full scan after the document has been parsed.
            this.countAllCssHits();

            document.removeEventListener('readystatechange', this.boundStartCounter);
        }
    }

    /**
     * Counts css hits.
     */
    private countCssHits(): void {
        // Start observing first. Otherwise an element added between the
        // initial querySelectorAll snapshot and the observer setup can be
        // missed forever if it is removed before the next full scan.
        this.countCssHitsForMutations();
        this.countAllCssHits();
    }

    /**
     * Counts css hits for already affected elements.
     */
    private countAllCssHits(): void {
        if (this.stopped) {
            return;
        }

        // we don't start counting again all css hits till previous count process wasn't finished
        if (this.countIsWorking) {
            return;
        }

        this.countIsWorking = true;
        const elements = document.querySelectorAll('*');
        this.countCssHitsBatch(
            elements,
            0,
            CssHitsCounter.CSS_HITS_BATCH_SIZE,
            CssHitsCounter.CSS_HITS_BATCH_SIZE,
            [],
            (result: ICountedElement[]): void => {
                if (result.length > 0) {
                    this.onCssHitsFoundCallback(result);
                }
                this.countIsWorking = false;
            },
        );
    }

    /**
     * Main calculation function.
     * 1. Selects sub collection from elements.
     * 2. For each element from sub collection: retrieves calculated css 'content'
     * attribute and if it contains 'adguard'
     * marker then retrieves rule text and filter identifier.
     * 3. Starts next task with some delay.
     *
     * @param elements Collection of all elements.
     * @param start Start of batch.
     * @param end End of batch.
     * @param step Size of batch.
     * @param result Collection for save result.
     * @param callback Finish callback.
     */
    // eslint-disable-next-line max-len
    private countCssHitsBatch(
        elements: NodeListOf<Element>,
        start: number,
        end: number,
        step: number,
        result: ICountedElement[],
        callback: (x: ICountedElement[]) => void,
    ): void {
        if (this.stopped) {
            return;
        }

        const length = Math.min(end, elements.length);
        result = result.concat(this.countCssHitsForElements(elements, start, length));
        if (length === elements.length) {
            callback(result);
            return;
        }

        start = end;
        end += step;

        // Start next task with some delay
        window.setTimeout(() => {
            this.countCssHitsBatch(elements, start, end, step, result, callback);
        }, CssHitsCounter.COUNT_CSS_HITS_BATCH_DELAY);
    }

    /**
     * Counts css hits for array of elements.
     *
     * @param elements Array of elements.
     * @param start Start of batch.
     * @param length Length of batch.
     * @param countedElements Optional set receiving elements that produced a hit.
     *
     * @returns Data with information about rule and element.
     */
    private countCssHitsForElements(
        elements: NodeListOf<Element> | Element[],
        start: number,
        length: number | null,
        countedElements?: Set<Element>,
    ): ICountedElement[] {
        start = start || 0;
        length = length || elements.length;

        const result = [];
        for (let i = start; i < length; i += 1) {
            const element = elements[i];
            const cssHitData = CssHitsCounter.getCssHitData(element);
            if (!cssHitData) {
                continue;
            }

            const { filterId, ruleIndex } = cssHitData;
            const ruleAndFilterString = filterId + SEMICOLON + ruleIndex;

            if (this.hitsStorage.isCounted(element, ruleAndFilterString)) {
                countedElements?.add(element);
                continue;
            }
            this.hitsStorage.setCounted(element, ruleAndFilterString);
            countedElements?.add(element);

            result.push({
                filterId,
                ruleIndex,
                element: this.elementToString ? ElementUtils.elementToString(element) : element,
            });
        }

        return result;
    }

    /**
     * Counts css hits for mutations.
     */
    private countCssHitsForMutations(): void {
        // eslint-disable-next-line prefer-destructuring
        const MutationObserver = window.MutationObserver;
        if (!MutationObserver) {
            return;
        }

        if (this.observer) {
            this.observer.disconnect();
        }

        /**
         * To avoid cases where two css hits counters try to append and remove the
         * same elements one after the other, we do not append already met nodes.
         */
        const probesWeakSet = new WeakSet();
        let timeoutId: number | null = null;
        this.observer = new MutationObserver(((mutationRecords) => {
            // Collect probe elements, count them, then remove from their targets
            const probeElements: Element[] = [];
            const childrenOfProbeElements: Element[] = [];
            const potentialProbeElements: Element[] = [];

            mutationRecords.forEach((mutationRecord) => {
                if (mutationRecord.addedNodes.length === 0) {
                    return;
                }

                for (let i = 0; i < mutationRecord.addedNodes.length; i += 1) {
                    const node = mutationRecord.addedNodes[i];
                    if (!(node instanceof Element) || CssHitsCounter.isIgnoredNodeTag(node.tagName)) {
                        continue;
                    }

                    const { target } = mutationRecord;
                    if (!node.parentNode && target) {
                        // If this node has been appended to the DOM and counted once, do not add
                        // it again.
                        if (probesWeakSet.has(node)) {
                            return;
                        }
                        // Most likely this is a "probe" element that was added and then
                        // immediately removed from DOM.
                        // We re-add it and check if any rule matched it
                        probeElements.push(node);

                        // To ensure that this "probe" node has only been added once to the DOM,
                        // we add it to the weak set.
                        probesWeakSet.add(node);

                        // CSS rules could be applied to the nodes inside probe element
                        // that's why we get all child elements of added node
                        ElementUtils.appendChildren(node, childrenOfProbeElements);

                        if (this.observer) {
                            this.observer.disconnect();
                        }

                        const restoreTarget = CssHitsCounter.getProbeRestoreTarget(target);
                        if (restoreTarget) {
                            CssHitsCounter.insertProbe(
                                node,
                                restoreTarget,
                                mutationRecord.previousSibling,
                                mutationRecord.nextSibling,
                            );
                        }
                    } else if (node.parentNode && target) {
                        // Sometimes probe elements are appended to the DOM
                        potentialProbeElements.push(node);
                        ElementUtils.appendChildren(node, potentialProbeElements);
                    }
                }
            });

            // If the list of potential probe elements is relatively small,
            // we can count CSS hits immediately
            if (potentialProbeElements.length > 0
                && potentialProbeElements.length <= CssHitsCounter.CSS_HITS_BATCH_SIZE) {
                const result = this.countCssHitsForElements(potentialProbeElements, 0, null);
                if (result.length > 0) {
                    this.onCssHitsFoundCallback(result);
                }
            }

            const allProbeElements: Element[] = [];

            ElementUtils.addUnique(allProbeElements, childrenOfProbeElements);
            ElementUtils.addUnique(allProbeElements, probeElements);

            if (allProbeElements.length > 0) {
                const result = this.countCssHitsForElements(allProbeElements, 0, null);
                if (result.length > 0) {
                    this.onCssHitsFoundCallback(result);
                }
                /**
                 * Don't remove child elements of probe elements
                 * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1096.
                 */
                ElementUtils.removeElements(probeElements);
                this.startObserver();
            }

            // debounce counting all css hits when mutation record fires
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
            timeoutId = window.setTimeout(() => {
                this.countAllCssHits();
                window.clearTimeout(timeoutId!);
            }, CssHitsCounter.COUNT_ALL_CSS_HITS_TIMEOUT_MS);
        }));

        this.startObserver();
    }

    /**
     * Counts probes collected before and after the counter initialization.
     *
     * Each probe is temporarily reinserted into the document, so that the
     * injected marker can be read from its computed style, and removed
     * synchronously after the counting, so it is never painted. Probes that
     * did not match any rule are retried a few times, since the marker styles
     * may be injected slightly after the cosmetic data is received.
     *
     * Only native stylesheet markers are detected this way: ExtendedCss
     * rules are reported when ExtendedCss itself applies them to an element.
     */
    private countPendingProbes(): void {
        if (this.stopped || this.pendingProbes.length === 0) {
            return;
        }

        const probes = this.pendingProbes;
        this.pendingProbes = [];

        const elementsToCount: Element[] = [];
        const restoredProbeElements: Element[] = [];
        const countedElements = new Set<Element>();
        let result: ICountedElement[] = [];

        if (this.observer) {
            this.observer.disconnect();
        }

        try {
            for (let i = 0; i < probes.length; i += 1) {
                const probe = probes[i];
                const { element } = probe;

                if (!element.isConnected) {
                    const restoreTarget = CssHitsCounter.getProbeRestoreTarget(probe.target);
                    if (restoreTarget) {
                        CssHitsCounter.insertProbe(
                            element,
                            restoreTarget,
                            probe.previousSibling,
                            probe.nextSibling,
                        );
                        restoredProbeElements.push(element);
                    }
                }

                elementsToCount.push(element);
                ElementUtils.appendChildren(element, elementsToCount);
            }

            result = this.countCssHitsForElements(elementsToCount, 0, null, countedElements);
        } finally {
            /**
             * Don't remove child elements of probe elements
             * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1096.
             */
            ElementUtils.removeElements(restoredProbeElements);
            this.startObserver();
        }

        if (result.length > 0) {
            this.onCssHitsFoundCallback(result);
        }

        // Each probe has its own retry budget, so probes delivered while a
        // retry is armed are not dropped with the batch they joined.
        const retryProbes: PendingProbe[] = [];

        for (let i = 0; i < probes.length; i += 1) {
            const probe = probes[i];
            if (countedElements.has(probe.element)) {
                continue;
            }

            const attempts = (this.pendingProbeAttempts.get(probe) ?? 0) + 1;
            this.pendingProbeAttempts.set(probe, attempts);

            if (attempts < CssHitsCounter.PENDING_PROBES_MAX_ATTEMPTS) {
                retryProbes.push(probe);
            }
        }

        if (retryProbes.length === 0 || this.stopped) {
            return;
        }

        this.pendingProbes = retryProbes;
        this.pendingProbesTimeoutId = window.setTimeout(() => {
            this.pendingProbesTimeoutId = null;
            this.countPendingProbes();
        }, CssHitsCounter.PENDING_PROBES_RETRY_DELAY_MS);
    }

    /**
     * Starts mutation observer.
     */
    private startObserver(): void {
        if (this.observer && !this.stopped) {
            // TODO: Check, maybe we should observer for 'characterData' and
            // 'characterDataOldValue' like it was in the old extension code
            this.observer.observe(document.documentElement || document, {
                childList: true,
                subtree: true,
                attributes: true,
            });
        }
    }

    /**
     * Chooses a connected node where a detached probe can be temporarily
     * restored before `getComputedStyle` is called.
     *
     * Walks up from the original mutation target to find the nearest node
     * still connected to the document. Preserving the cascade context
     * (descendant selectors, `:nth-child`, etc.) as closely as possible
     * matters here: appending straight to `document.documentElement` would
     * place the probe in a completely different tree position and could cause
     * it to miss context-dependent selectors. `document.documentElement` is
     * used only as the last resort when no ancestor in the chain is connected
     * anymore.
     *
     * @param target Original mutation target.
     *
     * @returns Node where the probe can be safely appended.
     */
    private static getProbeRestoreTarget(target: Node): Node | null {
        let current: Node | null = target;

        while (current) {
            if (current instanceof Element && current.isConnected) {
                return current;
            }

            current = current.parentNode;
        }

        return document.documentElement;
    }

    /**
     * Temporarily restores a detached probe to the document at its original
     * position, when possible.
     *
     * @param element Detached probe element.
     * @param target Node to append the probe to.
     * @param previousSibling Sibling preceding the probe at the moment of the mutation.
     * @param nextSibling Sibling following the probe at the moment of the mutation.
     */
    private static insertProbe(
        element: Element,
        target: Node,
        previousSibling: Node | null,
        nextSibling: Node | null,
    ): void {
        if (nextSibling && nextSibling.parentNode === target) {
            target.insertBefore(element, nextSibling);
            return;
        }

        if (previousSibling && previousSibling.parentNode === target) {
            target.insertBefore(element, previousSibling.nextSibling);
            return;
        }

        target.appendChild(element);
    }

    /**
     * Reads the `--adguard-hit` marker from an element's computed style (AG-265).
     *
     * @param element Element to probe.
     *
     * @returns Rule info or `null` if no marker is present.
     */
    private static getCssHitData(element: Element): RuleInfoBasic | null {
        try {
            const value = getComputedStyle(element)
                .getPropertyValue(CssHitsCounter.MARKER_PROPERTY_NAME);
            if (!value) {
                return null;
            }
            return ElementUtils.parseInfo(value, CssHitsCounter.MARKER_PREFIX);
        } catch {
            // Malformed marker values (e.g. broken percent-encoding) or
            // elements that cannot be measured should not break counting.
            return null;
        }
    }

    /**
     * Checks if tag is ignored.
     *
     * @param nodeTag Tag name to check.
     *
     * @returns True if tag is ignored.
     */
    private static isIgnoredNodeTag(nodeTag: string): boolean {
        const ignoredTags = ['script'];
        return ignoredTags.includes(nodeTag.toLowerCase());
    }
}
