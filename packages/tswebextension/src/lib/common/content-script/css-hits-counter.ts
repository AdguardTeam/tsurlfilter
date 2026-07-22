import { type IAffectedElement } from '@adguard/extended-css';

import { CSS_HITS_MARKER_PREFIX, SEMICOLON } from '../constants';
import { type RuleInfoBasic } from '../rule-info';

import { HitsStorage } from './hits-storage';
import { ElementUtils } from './utils/element-utils';

/**
 * Counted element data structure.
 * Rule texts are resolved in the background, so only filterId/ruleIndex are sent from content script.
 */
type ICountedElement = RuleInfoBasic & { element: string | Element };

/**
 * Added DOM root captured from a MutationObserver record.
 *
 * We keep the root node reference instead of a raw MutationRecord. This is the
 * important part for short-lived "probe" elements: even if the page removes the
 * node before our asynchronous counter task runs, the MutationObserver record
 * has already given us a strong reference to that node/subtree.
 */
type PendingMutationRoot = {
    /**
     * Added element root.
     */
    element: Element;

    /**
     * Original mutation target. If the added root is already detached by the
     * time we count it, we temporarily append it back here so normal page CSS
     * rules can match it.
     */
    target: Node;
};

/**
 * Concrete elements collected from one captured mutation-root batch.
 */
type MutationElementsToCount = {
    /**
     * Elements that should be checked for CSS hit markers.
     */
    elementsToCount: Element[];

    /**
     * Top-level probe roots temporarily restored to the DOM for this batch.
     */
    batchRestoredProbes: Element[];
};

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
    elementToString: boolean;
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
     * Alias of the shared {@link CSS_HITS_MARKER_PREFIX} constant.
     */
    private static readonly MARKER_PREFIX = CSS_HITS_MARKER_PREFIX;

    /**
     * Custom property carrying the marker (see `CosmeticApiCommon`).
     */
    private static readonly MARKER_PROPERTY_NAME = '--adguard-hit';

    /**
     * We delay countAllCssHits function if it was called too frequently from mutationObserver.
     */
    private static readonly COUNT_ALL_CSS_HITS_TIMEOUT_MS = 500;

    /**
     * Minimum interval between full DOM re-scans triggered by the MutationObserver.
     *
     * On heavy SPA websites (e.g. React apps with constant reconciliation), the
     * DOM can mutate continuously. Without a cooldown, every processed mutation
     * batch schedules a full scan (`querySelectorAll('*')` + `getComputedStyle`
     * on each element). If each scan takes longer than the mutation interval,
     * scans can run back-to-back and starve page rendering.
     */
    private static readonly COUNT_ALL_CSS_HITS_COOLDOWN_MS = 5000;

    /**
     * Delay before processing roots captured from MutationObserver records.
     *
     * The observer callback itself stays cheap and only keeps root references.
     * Counting waits briefly so the browser can apply injected cosmetic CSS and
     * expose the `content: "adguard..."` marker. Processing immediately in the
     * next macrotask is too early on pages like monkeytype.com: a census at
     * +100ms can already see six marked elements, while an immediate counter
     * pass sees no marker and later only the two long-lived elements remain.
     */
    private static readonly MUTATION_PROCESSING_DELAY_MS = 100;

    /**
     * Delay between repeated counts of the same captured mutation roots.
     *
     * Some pages add ad/probe nodes before the CSS marker has settled, then
     * remove them quickly. A single pass is inherently timing-sensitive: if it
     * runs just before `getComputedStyle(...).content` starts returning the
     * `adguard` marker, we lose that element forever. Retrying only captured
     * roots avoids full-page rescans and keeps the work bounded.
     */
    private static readonly MUTATION_RETRY_DELAY_MS = 100;

    /**
     * Number of count attempts for one captured mutation-root batch.
     *
     * Attempts happen at roughly 100, 200, 300, 400, and 500 ms after capture.
     * This covers the observed monkeytype.com timing without keeping restored
     * probe nodes around for seconds.
     */
    private static readonly MUTATION_COUNT_ATTEMPT_COUNT = 5;

    /**
     * Maximum number of added roots kept for detailed mutation processing.
     *
     * If a page mutates faster than we can process roots, we keep the detailed
     * queue bounded and rely on the throttled full scan for overflow. Detached
     * probes beyond the cap may be missed, but the alternative is unbounded
     * memory growth on pathological mutation storms.
     */
    private static readonly MAX_PENDING_MUTATION_ROOTS = 500;

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
     * Added element roots collected while waiting for asynchronous mutation
     * processing.
     */
    private pendingMutationRoots: PendingMutationRoot[] = [];

    /**
     * Dedupe set for roots currently stored in pendingMutationRoots.
     *
     * This set is recreated when the queue is drained so the same DOM node can
     * be processed again later if a page really reuses it in another mutation
     * batch.
     */
    private pendingMutationRootSet = new WeakSet<Element>();

    /**
     * Probe roots that we temporarily restored to the DOM and still need to
     * remove. The stop() method also uses this list so delayed batch
     * cancellation cannot leave our temporary nodes in the page.
     */
    private restoredProbeElements: Element[] = [];

    /**
     * Timer for mutation-root processing.
     *
     * This holds either the queued pending-roots timer or the active retry-attempt
     * timer. We keep one field so stop() can cancel whichever mutation callback
     * is currently waiting.
     */
    private processMutationsTimeoutId: number | null = null;

    /**
     * Timer for delayed full DOM CSS hit scans.
     */
    private countAllCssHitsTimeoutId: number | null = null;

    /**
     * Counting on process flag.
     */
    private countIsWorking = false;

    /**
     * Mutation-root counting in progress flag.
     *
     * Full DOM scans already have countIsWorking. Mutation roots need their own
     * gate because otherwise a constantly mutating page can start many
     * independent batch chains at once. Keeping one mutation batch chain active
     * at a time preserves responsiveness while still draining queued roots.
     */
    private mutationCountIsWorking = false;

    /**
     * Flag for lifecycle cleanup. Delayed callbacks check it before doing work.
     */
    private stopped = false;

    /**
     * Timestamp of the last full scan start.
     *
     * Updated at scan start, not scan completion, because on pathological pages
     * a scan may take long enough that completion-based cooldown is ineffective.
     */
    private lastCountAllTime = 0;

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
     * This function prepares calculation of css hits.
     * We are waiting for 'load' event and start calculation.
     *
     * @param callback Which receives {@link ICountedElement} and handles counted css hits.
     * @param options CssHitsCounter options.
     */
    constructor(callback: (x: ICountedElement[]) => void, options?: CssHitsCounterOptions) {
        if (options) {
            const { elementToString } = options;
            this.elementToString = elementToString;
        }

        this.onCssHitsFoundCallback = callback;

        if (document.readyState === 'complete'
            || document.readyState === 'interactive') {
            this.countCssHits();
        } else {
            // Observe immediately during document loading. Waiting for
            // readystatechange can miss short-lived probes that appear before
            // the first interactive full scan.
            this.lastCountAllTime = Date.now();
            this.countCssHitsForMutations();
            document.addEventListener('readystatechange', this.boundStartCounter);
        }
    }

    /**
     * Stops css hits counting process.
     */
    public stop(): void {
        this.stopped = true;
        this.onCssHitsFoundCallback = (): void => {};
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.processMutationsTimeoutId !== null) {
            window.clearTimeout(this.processMutationsTimeoutId);
            this.processMutationsTimeoutId = null;
        }

        if (this.countAllCssHitsTimeoutId !== null) {
            window.clearTimeout(this.countAllCssHitsTimeoutId);
            this.countAllCssHitsTimeoutId = null;
        }

        this.pendingMutationRoots = [];
        this.pendingMutationRootSet = new WeakSet<Element>();

        if (this.restoredProbeElements.length > 0) {
            ElementUtils.removeElements(this.restoredProbeElements);
            this.restoredProbeElements = [];
        }

        this.countIsWorking = false;
        this.mutationCountIsWorking = false;
        document.removeEventListener('readystatechange', this.boundStartCounter);
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
            const result: ICountedElement[] = [];

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
            this.countCssHits();

            document.removeEventListener('readystatechange', this.boundStartCounter);
        }
    }

    /**
     * Counts css hits.
     */
    private countCssHits(): void {
        // Start observing first. Otherwise an element added between the initial
        // querySelectorAll snapshot and observer setup can be missed forever if
        // it is removed before the next throttled full scan.
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
        this.lastCountAllTime = Date.now();
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
     * 2. For each element from sub collection: retrieves the computed
     * `--adguard-hit` custom property value and if it contains 'adguard'
     * marker then retrieves rule text and filter identifier.
     * 3. Starts next task with some delay.
     *
     * @param elements Collection of all elements.
     * @param start Start of batch.
     * @param end End of batch.
     * @param step Size of batch.
     * @param result Collection for save result.
     * @param callback Finish callback.
     * @param countedElementsToSkip Elements already counted in the same mutation retry chain.
     */
    // eslint-disable-next-line max-len
    private countCssHitsBatch(
        elements: NodeListOf<Element> | Element[],
        start: number,
        end: number,
        step: number,
        result: ICountedElement[],
        callback: (x: ICountedElement[]) => void,
        countedElementsToSkip?: WeakSet<Element>,
    ): void {
        if (this.stopped) {
            return;
        }

        const length = Math.min(end, elements.length);
        result = result.concat(this.countCssHitsForElements(elements, start, length, countedElementsToSkip));
        if (length === elements.length) {
            callback(result);
            return;
        }

        start = end;
        end += step;

        // Start next task with some delay
        window.setTimeout(() => {
            this.countCssHitsBatch(elements, start, end, step, result, callback, countedElementsToSkip);
        }, CssHitsCounter.COUNT_CSS_HITS_BATCH_DELAY);
    }

    /**
     * Counts css hits for array of elements.
     *
     * @param elements Array of elements.
     * @param start Start of batch.
     * @param length Length of batch.
     * @param countedElementsToSkip Elements already counted in the same mutation retry chain.
     *
     * @returns Data with information about rule and element.
     */
    private countCssHitsForElements(
        elements: NodeListOf<Element> | Element[],
        start: number,
        length: number | null,
        countedElementsToSkip?: WeakSet<Element>,
    ): ICountedElement[] {
        start = start || 0;
        length = length || elements.length;

        const result = [];
        for (let i = start; i < length; i += 1) {
            const element = elements[i];
            if (countedElementsToSkip?.has(element)) {
                continue;
            }

            const cssHitData = CssHitsCounter.getCssHitData(element);
            if (!cssHitData) {
                continue;
            }

            const { filterId, ruleIndex } = cssHitData;
            const ruleAndFilterString = filterId + SEMICOLON + ruleIndex;

            if (this.hitsStorage.isCounted(element, ruleAndFilterString)) {
                countedElementsToSkip?.add(element);
                continue;
            }
            this.hitsStorage.setCounted(element, ruleAndFilterString);
            countedElementsToSkip?.add(element);

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
        if (this.stopped) {
            return;
        }

        // eslint-disable-next-line prefer-destructuring
        const MutationObserver = window.MutationObserver;
        if (!MutationObserver) {
            return;
        }

        if (this.observer) {
            return;
        }

        this.observer = new MutationObserver(((mutationRecords) => {
            const hasPendingRoots = this.collectPendingMutationRoots(mutationRecords);

            if (hasPendingRoots) {
                this.schedulePendingMutationProcessing();
            }

            this.scheduleCountAllCssHits();
        }));

        this.startObserver();
    }

    /**
     * Schedules one full DOM scan after the cooldown window.
     *
     * The full scan is still useful as a catch-up mechanism for mutations that
     * were too broad for the detailed mutation path. It must be throttled,
     * otherwise SPA mutation storms can create a feedback loop.
     *
     * If a scan is already scheduled, keep it. Resetting the timer on every
     * mutation would turn this back into a pure debounce and could postpone
     * catch-up scans forever on pages that mutate continuously.
     */
    private scheduleCountAllCssHits(): void {
        if (this.stopped || this.countAllCssHitsTimeoutId !== null) {
            return;
        }

        const now = Date.now();
        const sinceLastScan = now - this.lastCountAllTime;
        const delay = Math.max(
            CssHitsCounter.COUNT_ALL_CSS_HITS_TIMEOUT_MS,
            CssHitsCounter.COUNT_ALL_CSS_HITS_COOLDOWN_MS - sinceLastScan,
        );

        this.countAllCssHitsTimeoutId = window.setTimeout(() => {
            this.countAllCssHitsTimeoutId = null;
            this.countAllCssHits();
        }, delay);
    }

    /**
     * Removes top-level probe roots restored by one mutation batch.
     *
     * @param batchRestoredProbes Restored top-level probe roots.
     */
    private removeRestoredProbeElements(batchRestoredProbes: Element[]): void {
        if (batchRestoredProbes.length === 0) {
            return;
        }

        if (this.observer) {
            this.observer.disconnect();
        }

        ElementUtils.removeElements(batchRestoredProbes);
        const restoredProbeSet = new Set(batchRestoredProbes);
        this.restoredProbeElements = this.restoredProbeElements
            .filter((element) => !restoredProbeSet.has(element));

        this.startObserver();
    }

    /**
     * Builds the concrete element list that should be checked for CSS hits.
     *
     * This deliberately happens outside the MutationObserver callback. A subtree
     * walk can be expensive on SPA pages, but doing it here lets us batch the
     * later getComputedStyle calls and keeps the callback itself small enough
     * not to block page mutation handling.
     *
     * @param roots Added DOM roots captured by MutationObserver.
     *
     * @returns Elements to count and temporarily restored probe roots to remove
     * after counting.
     */
    private collectElementsToCount(roots: PendingMutationRoot[]): MutationElementsToCount {
        const elementsToCount: Element[] = [];
        const elementsToCountSet = new WeakSet<Element>();
        const batchRestoredProbes: Element[] = [];

        /**
         * Adds an element to the counting list once.
         *
         * @param element Element to append.
         */
        const appendElementOnce = (element: Element): void => {
            if (elementsToCountSet.has(element)) {
                return;
            }

            elementsToCountSet.add(element);
            elementsToCount.push(element);
        };

        /**
         * Adds root element and all its descendant elements to the counting list.
         *
         * @param element Root element to append.
         */
        const appendRootAndChildren = (element: Element): void => {
            appendElementOnce(element);

            const children: Element[] = [];
            ElementUtils.appendChildren(element, children);
            for (let i = 0; i < children.length; i += 1) {
                appendElementOnce(children[i]);
            }
        };

        let observerWasDisconnected = false;

        for (let i = 0; i < roots.length; i += 1) {
            const { element, target } = roots[i];

            if (CssHitsCounter.isIgnoredNodeTag(element.tagName)) {
                continue;
            }

            if (!element.parentNode) {
                if (this.observer && !observerWasDisconnected) {
                    this.observer.disconnect();
                    observerWasDisconnected = true;
                }

                const restoreTarget = CssHitsCounter.getProbeRestoreTarget(target);
                restoreTarget.appendChild(element);
                batchRestoredProbes.push(element);
                this.restoredProbeElements.push(element);
            }

            appendRootAndChildren(element);
        }

        if (observerWasDisconnected) {
            this.startObserver();
        }

        return { elementsToCount, batchRestoredProbes };
    }

    /**
     * Completes one mutation-root counting chain.
     *
     * @param batchRestoredProbes Restored top-level probe roots.
     */
    private finishMutationCounting(batchRestoredProbes: Element[]): void {
        this.mutationCountIsWorking = false;
        this.removeRestoredProbeElements(batchRestoredProbes);
        if (this.pendingMutationRoots.length > 0) {
            this.schedulePendingMutationProcessing();
        }
    }

    /**
     * Processes one retry attempt for element roots captured by observer callback.
     *
     * Unlike the old "count only when <= batch size" branch, this path never
     * drops a large mutation batch just because it is large. It feeds collected
     * elements into the same small asynchronous batches used by the full scan,
     * which keeps long pages responsive while still catching short-lived probes.
     *
     * @param roots Added DOM roots captured by MutationObserver.
     * @param batchRestoredProbes Probe roots restored by earlier attempts.
     * @param countedElementsToSkip Elements already counted in the same mutation retry chain.
     * @param cachedElementsToCount Elements collected during the first retry attempt.
     * @param attemptIndex Zero-based retry attempt index.
     */
    private processMutationCountingAttempt(
        roots: PendingMutationRoot[],
        batchRestoredProbes: Element[],
        countedElementsToSkip: WeakSet<Element>,
        cachedElementsToCount: Element[] | null,
        attemptIndex: number,
    ): void {
        if (this.stopped) {
            return;
        }

        let elementsToCount = cachedElementsToCount;
        if (!elementsToCount) {
            const collected = this.collectElementsToCount(roots);
            ElementUtils.addUnique(batchRestoredProbes, collected.batchRestoredProbes);
            elementsToCount = collected.elementsToCount;
        }

        if (elementsToCount.length === 0) {
            this.finishMutationCounting(batchRestoredProbes);
            return;
        }

        this.countCssHitsBatch(
            elementsToCount,
            0,
            CssHitsCounter.CSS_HITS_BATCH_SIZE,
            CssHitsCounter.CSS_HITS_BATCH_SIZE,
            [],
            (result: ICountedElement[]): void => {
                if (result.length > 0) {
                    this.onCssHitsFoundCallback(result);
                }

                const nextAttemptIndex = attemptIndex + 1;
                if (nextAttemptIndex < CssHitsCounter.MUTATION_COUNT_ATTEMPT_COUNT) {
                    this.processMutationsTimeoutId = window.setTimeout(() => {
                        this.processMutationsTimeoutId = null;
                        this.processMutationCountingAttempt(
                            roots,
                            batchRestoredProbes,
                            countedElementsToSkip,
                            elementsToCount,
                            nextAttemptIndex,
                        );
                    }, CssHitsCounter.MUTATION_RETRY_DELAY_MS);
                    return;
                }

                /**
                 * Don't remove child elements of probe elements
                 * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1096.
                 */
                this.finishMutationCounting(batchRestoredProbes);
            },
            countedElementsToSkip,
        );
    }

    /**
     * Starts processing roots captured by the observer callback.
     */
    private processPendingRoots(): void {
        if (this.stopped || this.mutationCountIsWorking || this.pendingMutationRoots.length === 0) {
            return;
        }

        const roots = this.pendingMutationRoots;
        this.pendingMutationRoots = [];
        this.pendingMutationRootSet = new WeakSet<Element>();
        this.mutationCountIsWorking = true;

        this.processMutationCountingAttempt(roots, [], new WeakSet<Element>(), null, 0);
    }

    /**
     * Schedules pending mutation-root processing if no processing is active.
     */
    private schedulePendingMutationProcessing(): void {
        if (this.mutationCountIsWorking || this.processMutationsTimeoutId !== null) {
            return;
        }

        this.processMutationsTimeoutId = window.setTimeout(() => {
            this.processMutationsTimeoutId = null;
            this.processPendingRoots();
        }, CssHitsCounter.MUTATION_PROCESSING_DELAY_MS);
    }

    /**
     * Collects added element roots from MutationObserver records.
     *
     * @param mutationRecords Mutation records delivered by the observer.
     *
     * @returns True if at least one root was queued for detailed processing.
     */
    private collectPendingMutationRoots(mutationRecords: MutationRecord[]): boolean {
        let hasPendingRoots = false;

        for (let i = 0; i < mutationRecords.length; i += 1) {
            const mutationRecord = mutationRecords[i];
            if (mutationRecord.addedNodes.length === 0) {
                continue;
            }

            for (let j = 0; j < mutationRecord.addedNodes.length; j += 1) {
                const node = mutationRecord.addedNodes[j];
                if (!(node instanceof Element) || CssHitsCounter.isIgnoredNodeTag(node.tagName)) {
                    continue;
                }

                if (this.queuePendingMutationRoot(node, mutationRecord.target)) {
                    hasPendingRoots = true;
                }
            }
        }

        return hasPendingRoots;
    }

    /**
     * Queues one added element root for detailed mutation processing.
     *
     * @param element Added element root.
     * @param target Original MutationObserver record target.
     *
     * @returns True when root was queued.
     */
    private queuePendingMutationRoot(element: Element, target: Node): boolean {
        if (this.pendingMutationRootSet.has(element)) {
            return false;
        }

        if (this.pendingMutationRoots.length >= CssHitsCounter.MAX_PENDING_MUTATION_ROOTS) {
            this.scheduleCountAllCssHits();
            return false;
        }

        this.pendingMutationRootSet.add(element);
        this.pendingMutationRoots.push({ element, target });

        return true;
    }

    /**
     * Starts mutation observer.
     */
    private startObserver(): void {
        if (this.observer && !this.stopped) {
            // TODO: Check, maybe we should observer for 'characterData' and
            // 'characterDataOldValue' like it was in the old extension code
            this.observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
            });
        }
    }

    /**
     * Reads the `--adguard-hit` marker from an element's computed style (AG-265).
     *
     * @param element Element to probe.
     *
     * @returns Rule info or `null` if no marker is present.
     */
    private static getCssHitData(element: Element): RuleInfoBasic | null {
        const value = getComputedStyle(element)
            .getPropertyValue(CssHitsCounter.MARKER_PROPERTY_NAME);
        if (!value) {
            return null;
        }
        return ElementUtils.parseInfo(value, CssHitsCounter.MARKER_PREFIX);
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

    /**
     * Chooses a connected node where a detached probe can be temporarily
     * restored before getComputedStyle is called.
     *
     * Walks up from the original mutation target to find the nearest node
     * still connected to the document. Preserving cascade context (descendant
     * selectors, `:nth-child`, etc.) as closely as possible matters here:
     * appending straight to `document.documentElement` would place the probe
     * in a completely different tree position and could cause it to miss
     * context-dependent selectors. `document.documentElement` is used only as
     * the last resort when no ancestor in the chain is connected anymore.
     *
     * @param target Original MutationObserver record target.
     *
     * @returns Node where the probe can be safely appended.
     */
    private static getProbeRestoreTarget(target: Node): Node {
        let current: Node | null = target;
        while (current) {
            if ((current instanceof Element || current instanceof DocumentFragment) && current.isConnected) {
                return current;
            }

            current = current.parentNode;
        }

        return document.documentElement;
    }
}
