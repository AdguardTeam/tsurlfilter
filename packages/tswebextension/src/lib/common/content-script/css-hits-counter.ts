import { type IAffectedElement } from '@adguard/extended-css';

import { CSS_HITS_MARKER_PREFIX, CSS_HITS_MARKER_PROPERTY, SEMICOLON } from '../constants';
import { type RuleInfoBasic } from '../rule-info';

import { EXTCSS_REMOVED_ELEMENTS_KEY } from './extcss-removed-elements';
import { HitsStorage } from './hits-storage';
import {
    isProbeRestorable,
    MAX_PENDING_PROBES,
    type PendingProbe,
    type PendingProbesCollector,
} from './pending-probes-collector';
import { cssHitsHelpers } from './utils/css-hits-helpers';
import { ElementUtils } from './utils/element-utils';

/**
 * Counted element data structure.
 * Rule texts are resolved in the background, so only filterId/ruleIndex are sent from content script.
 */
type ICountedElement = RuleInfoBasic & { element: string | Element };

const DEFAULT_ELEMENT_TO_STRING = true;

/**
 * CssHitsCounter options.
 *
 * The pending-probes options are internal: they are used by the bundled
 * cosmetic controllers, and their types are not exported from the package.
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
     * Alias of the shared {@link CSS_HITS_MARKER_PREFIX} constant.
     */
    private static readonly MARKER_PREFIX = CSS_HITS_MARKER_PREFIX;

    /**
     * Custom property carrying the marker (see `CosmeticApiCommon`).
     *
     * Alias of the shared {@link CSS_HITS_MARKER_PROPERTY} constant.
     */
    private static readonly MARKER_PROPERTY_NAME = CSS_HITS_MARKER_PROPERTY;

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
     * Per-node reported ExtendedCSS hits, kept on the instance: two counters in
     * one document must not share it, otherwise a counter created after
     * {@link stop} would not report the nodes the previous one already did.
     */
    private countedHits: WeakMap<Element, Set<string>> = new WeakMap();

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
     * Elements that were already temporarily re-inserted by the mutation
     * observer.
     */
    private probedElements = new WeakSet<Element>();

    /**
     * Elements that the mutation observer re-inserted and successfully
     * counted.
     *
     * The collector and the counter's own mutation observer can both report
     * the same element, so {@link countPendingProbes} must not re-insert it
     * again. Elements that did not match any rule are not added here: they
     * are still retried by the pending probes pass, since the marker styles
     * may be applied later.
     */
    private countedProbes = new WeakSet<Element>();

    /**
     * Elements ExtendedCss removed with a `:remove()` rule; never restore
     * them. MV2 records them on this instance, MV3 in the injected function's
     * `window` set (the shared ISOLATED world), which wins when it exists.
     *
     * @returns Elements removed by ExtendedCss.
     */
    private get extendedCssRemovedElements(): WeakSet<Element> {
        return (window as unknown as Record<string, WeakSet<Element> | undefined>)[EXTCSS_REMOVED_ELEMENTS_KEY]
            ?? this.instanceExtendedCssRemovedElements;
    }

    private instanceExtendedCssRemovedElements = new WeakSet<Element>();

    /**
     * Number of counting attempts already performed for each pending probe.
     *
     * Attempts are tracked per probe, so probes delivered later get their own
     * retry budget instead of sharing the in-flight one.
     */
    private pendingProbeAttempts = new WeakMap<PendingProbe, number>();

    /**
     * Whether a native marker hit has already been observed.
     *
     * The marker styles are injected as a whole, so once any element produced
     * a hit, a probe that did not match on its first attempt will not match on
     * a retry either. Retrying it would only keep detached subtrees alive and
     * delay the probes that follow in the queue.
     */
    private markerStylesApplied = false;

    /**
     * Timer for the next attempt to count {@link pendingProbes}.
     */
    private pendingProbesTimeoutId: number | null = null;

    /**
     * Timer for the debounced full CSS hits scan.
     */
    private countAllCssHitsTimeoutId: number | null = null;

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
     * Attaches the mutation observer while the document is still loading when
     * no pending probes collector is provided, so elements added and removed
     * before the document becomes interactive are not missed. With a
     * collector, the collector already covers that window, so the counter's
     * own observer starts at `interactive`, together with the full DOM scan.
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
                // Copy the array: the counter adds probes to its own queue,
                // so the caller's array must not change.
                this.enqueuePendingProbes(pendingProbes);
            }
            if (pendingProbesCollector) {
                this.pendingProbesCollector = pendingProbesCollector;

                const collectedProbes = pendingProbesCollector.takePendingProbes();
                if (collectedProbes.length > 0) {
                    this.enqueuePendingProbes(collectedProbes);
                }

                pendingProbesCollector.setOnProbesCollected((probes) => {
                    this.addPendingProbes(probes);
                });

                pendingProbesCollector.setOnObservationEnded(() => {
                    // The collector stopped before the document became
                    // interactive: it no longer covers the loading window, so
                    // the counter must start its own observer.
                    if (!this.stopped && !this.observer) {
                        this.countCssHitsForMutations();
                    }
                });
            }
        }

        this.onCssHitsFoundCallback = callback;

        if (document.readyState === 'complete'
            || document.readyState === 'interactive') {
            this.countCssHits();
        } else {
            // Start observing immediately during the document loading when
            // no active collector covers that window: waiting for
            // `readystatechange` misses elements that are added and removed
            // before the document becomes interactive. With an active
            // collector, the counter's own observer starts at `interactive`
            // to avoid walking every mutation twice while the page is
            // parsing.
            if (!this.pendingProbesCollector?.isObserving) {
                this.countCssHitsForMutations();
            }
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

        if (this.countAllCssHitsTimeoutId !== null) {
            window.clearTimeout(this.countAllCssHitsTimeoutId);
            this.countAllCssHitsTimeoutId = null;
        }

        if (this.pendingProbesCollector) {
            this.pendingProbesCollector.stop();
            this.pendingProbesCollector = null;
        }

        this.pendingProbes = [];
        document.removeEventListener('readystatechange', this.boundStartCounter);
    }

    /**
     * Adds probes to the pending queue, keeping at most
     * {@link MAX_PENDING_PROBES} probes.
     *
     * The earliest probes are kept: baits are usually created by a script in
     * `<head>`, while later churn is more likely to be unrelated.
     *
     * @param probes Probes to enqueue.
     */
    private enqueuePendingProbes(probes: PendingProbe[]): void {
        const available = MAX_PENDING_PROBES - this.pendingProbes.length;
        if (available <= 0) {
            return;
        }

        if (probes.length > available) {
            this.pendingProbes.push(...probes.slice(0, available));
            return;
        }

        this.pendingProbes.push(...probes);
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
    private addPendingProbes(probes: PendingProbe[]): void {
        if (this.stopped || probes.length === 0) {
            return;
        }

        this.enqueuePendingProbes(probes);

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
     * ExtendedCss callback: collects the legacy `content:` markers of the
     * affected element's rules, reports the hits, and clears the markers on
     * the copy of the rules applied to that element, so they never reach the
     * DOM while the remaining elements matched by the same rule are still
     * counted.
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
            // ExtendedCSS removes the node itself for `:remove()`, so the
            // counter must never put it back as a probe. The helper below
            // reports hits only, so the removal is tracked here.
            for (const rule of affectedEl.rules) {
                if (rule.style?.remove === 'true') {
                    this.extendedCssRemovedElements.add(affectedEl.node);
                }
            }

            const result = cssHitsHelpers.collectExtendedCssHits(
                affectedEl,
                CssHitsCounter.MARKER_PREFIX,
                this.elementToString,
                this.countedHits,
            );

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
            // Without a collector the observer is already attached during
            // loading. With a collector it starts now, together with the full
            // scan after the document has been parsed.
            if (!this.observer) {
                this.countCssHitsForMutations();
            }

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

        // The full scan is performed only after the document has been parsed:
        // the debounced mutation callback can fire while the document is
        // still loading.
        if (document.readyState !== 'interactive'
            && document.readyState !== 'complete') {
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

            // A marker proves that the injected styles are already applied,
            // regardless of whether this element was counted before.
            this.markerStylesApplied = true;

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

        // A new observer replaces the previous one, so a debounce armed by
        // the previous observer must not run a full scan anymore.
        if (this.countAllCssHitsTimeoutId !== null) {
            window.clearTimeout(this.countAllCssHitsTimeoutId);
            this.countAllCssHitsTimeoutId = null;
        }

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
                    if (!(node instanceof Element)) {
                        continue;
                    }

                    const { target } = mutationRecord;
                    if (!node.parentNode && target) {
                        // If this node has been appended to the DOM and counted once, do not add
                        // it again.
                        if (this.probedElements.has(node)) {
                            continue;
                        }

                        // Elements removed by ExtendedCss are reported by it,
                        // so they must not be put back into the page.
                        if (this.extendedCssRemovedElements.has(node)) {
                            continue;
                        }

                        // CSS rules could be applied to the nodes inside probe element
                        // that's why we get all child elements of added node
                        const childrenOfProbe: Element[] = [];
                        ElementUtils.appendChildren(node, childrenOfProbe);

                        // Never re-insert resource-bearing or custom element
                        // subtrees: it re-runs page side effects.
                        if (!isProbeRestorable(node, childrenOfProbe)) {
                            continue;
                        }

                        const restoreTarget = CssHitsCounter.getProbeRestoreTarget(target);
                        // Without a connected ancestor the probe cannot be
                        // measured in its original cascade context.
                        if (!restoreTarget) {
                            continue;
                        }

                        // Most likely this is a "probe" element that was added and then
                        // immediately removed from DOM.
                        // We re-add it and check if any rule matched it
                        probeElements.push(node);

                        // To ensure that this "probe" node has only been added once to the DOM,
                        // we add it to the weak set.
                        this.probedElements.add(node);

                        childrenOfProbeElements.push(...childrenOfProbe);

                        if (this.observer) {
                            this.observer.disconnect();
                        }

                        CssHitsCounter.insertProbe(
                            node,
                            restoreTarget,
                            mutationRecord.previousSibling,
                            mutationRecord.nextSibling,
                        );
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
                const countedElements = new Set<Element>();
                const result = this.countCssHitsForElements(allProbeElements, 0, null, countedElements);
                if (result.length > 0) {
                    this.onCssHitsFoundCallback(result);
                }

                // Remember which probes matched, so the collector does not
                // re-insert them again. A hit on a descendant also proves
                // that the probe was checked, so walk up from every counted
                // element and mark all probe roots that contain it.
                const probeRoots = new Set<Element>(probeElements);
                countedElements.forEach((element) => {
                    let node: Node | null = element;
                    while (node) {
                        if (node instanceof Element && probeRoots.has(node)) {
                            this.countedProbes.add(node);
                        }
                        node = node.parentNode;
                    }
                });

                /**
                 * Don't remove child elements of probe elements
                 * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1096.
                 */
                ElementUtils.removeElements(probeElements);
                this.startObserver();
            }

            // debounce counting all css hits when mutation record fires
            if (this.countAllCssHitsTimeoutId !== null) {
                window.clearTimeout(this.countAllCssHitsTimeoutId);
            }
            this.countAllCssHitsTimeoutId = window.setTimeout(() => {
                this.countAllCssHitsTimeoutId = null;
                this.countAllCssHits();
            }, CssHitsCounter.COUNT_ALL_CSS_HITS_TIMEOUT_MS);
        }));

        this.startObserver();
    }

    /**
     * Orders pending probes for processing.
     *
     * A probe whose target is another probe's element (or is inside it) must
     * be processed after that probe: the ancestor has to be restored to the
     * document before the descendant can be measured in its original parent.
     * Dependent probes are grouped and kept in the same chunk, because
     * restored probes are removed at the end of a chunk.
     *
     * @param probes Pending probes in removal order.
     *
     * @returns Chunks of probes in processing order.
     */
    private static orderPendingProbes(probes: PendingProbe[]): PendingProbe[][] {
        const probeByElement = new Map<Element, PendingProbe>();
        probes.forEach((probe) => {
            probeByElement.set(probe.element, probe);
        });

        const dependencyByProbe = new Map<PendingProbe, PendingProbe | null>();
        const getDependency = (probe: PendingProbe): PendingProbe | null => {
            if (dependencyByProbe.has(probe)) {
                return dependencyByProbe.get(probe) ?? null;
            }

            let dependency: PendingProbe | null = null;
            let current: Node | null = probe.target;
            while (current) {
                if (current instanceof Element) {
                    const candidate = probeByElement.get(current);
                    if (candidate && candidate !== probe) {
                        dependency = candidate;
                        break;
                    }
                }

                current = current.parentNode;
            }

            dependencyByProbe.set(probe, dependency);
            return dependency;
        };

        const rootByProbe = new Map<PendingProbe, PendingProbe>();
        const getRoot = (probe: PendingProbe, visiting: Set<PendingProbe>): PendingProbe => {
            const cached = rootByProbe.get(probe);
            if (cached) {
                return cached;
            }

            if (visiting.has(probe)) {
                return probe;
            }

            visiting.add(probe);
            const dependency = getDependency(probe);
            const root = dependency ? getRoot(dependency, visiting) : probe;
            visiting.delete(probe);

            rootByProbe.set(probe, root);
            return root;
        };

        const depthByProbe = new Map<PendingProbe, number>();
        const getDepth = (probe: PendingProbe, visiting: Set<PendingProbe>): number => {
            const cached = depthByProbe.get(probe);
            if (cached !== undefined) {
                return cached;
            }

            if (visiting.has(probe)) {
                return 0;
            }

            visiting.add(probe);
            const dependency = getDependency(probe);
            const depth = dependency ? getDepth(dependency, visiting) + 1 : 0;
            visiting.delete(probe);

            depthByProbe.set(probe, depth);
            return depth;
        };

        const indexByProbe = new Map<PendingProbe, number>();
        probes.forEach((probe, index) => {
            indexByProbe.set(probe, index);
            getDepth(probe, new Set());
        });

        const groups = new Map<PendingProbe, PendingProbe[]>();
        const groupOrder: PendingProbe[] = [];
        probes.forEach((probe) => {
            const root = getRoot(probe, new Set());
            let group = groups.get(root);
            if (!group) {
                group = [];
                groups.set(root, group);
                groupOrder.push(root);
            }

            group.push(probe);
        });

        // Process dependent groups first, so a large batch of independent
        // probes cannot delay a container/bait pair indefinitely.
        const orderedGroups = [
            ...groupOrder.filter((root) => (groups.get(root)?.length ?? 0) > 1),
            ...groupOrder.filter((root) => (groups.get(root)?.length ?? 0) <= 1),
        ];

        const getAncestors = (probe: PendingProbe): PendingProbe[] => {
            const ancestors: PendingProbe[] = [];
            const seen = new Set<PendingProbe>();
            let dependency = getDependency(probe);
            while (dependency && !seen.has(dependency)) {
                ancestors.unshift(dependency);
                seen.add(dependency);
                dependency = getDependency(dependency);
            }

            return ancestors;
        };

        /**
         * Splits a dependent group into chunks that fit the batch size when
         * the group has independent branches.
         *
         * The group is sorted by depth, so each chunk keeps the ancestors of
         * its probes. Ancestors processed in a previous chunk are added again
         * to the next chunk, because restored probes are removed at the end
         * of a chunk. A dependency chain deeper than the batch size is kept
         * as one chunk, because it cannot be measured in smaller independent
         * pieces.
         *
         * @param group Dependent probes sorted by depth.
         *
         * @returns Chunks of probes.
         */
        const splitDependentGroup = (group: PendingProbe[]): PendingProbe[][] => {
            const groupChunks: PendingProbe[][] = [];
            let groupChunk: PendingProbe[] = [];
            let groupChunkSet = new Set<PendingProbe>();

            group.forEach((probe) => {
                const ancestors = getAncestors(probe);
                let missingAncestors = ancestors.filter((ancestor) => !groupChunkSet.has(ancestor));

                if (groupChunk.length > 0
                    && groupChunk.length + missingAncestors.length + 1
                        > CssHitsCounter.CSS_HITS_BATCH_SIZE) {
                    groupChunks.push(groupChunk);
                    groupChunk = [];
                    groupChunkSet = new Set();
                    missingAncestors = ancestors;
                }

                missingAncestors.forEach((ancestor) => {
                    groupChunk.push(ancestor);
                    groupChunkSet.add(ancestor);
                });

                groupChunk.push(probe);
                groupChunkSet.add(probe);
            });

            if (groupChunk.length > 0) {
                groupChunks.push(groupChunk);
            }

            // A chunk that only repeats probes from later chunks cannot make
            // progress: after it is processed, every probe is still in the
            // queue as an ancestor. Drop such chunks. A deep dependency chain
            // then collapses into its last chunk, which is processed as one
            // task, because the chain cannot be measured in smaller
            // independent pieces.
            const seenProbes = new Set<PendingProbe>();
            for (let i = groupChunks.length - 1; i >= 0; i -= 1) {
                const chunkToCheck = groupChunks[i];
                const hasUniqueProbe = chunkToCheck
                    .some((probe) => !seenProbes.has(probe));

                if (hasUniqueProbe) {
                    chunkToCheck.forEach((probe) => seenProbes.add(probe));
                } else {
                    groupChunks.splice(i, 1);
                }
            }

            return groupChunks;
        };

        const chunks: PendingProbe[][] = [];
        let chunk: PendingProbe[] = [];

        orderedGroups.forEach((root) => {
            const group = groups.get(root)!;
            group.sort((a, b) => (depthByProbe.get(a)! - depthByProbe.get(b)!)
                || ((indexByProbe.get(a) ?? 0) - (indexByProbe.get(b) ?? 0)));

            // A dependent group larger than the batch size is split into
            // chunks that keep the ancestors of every probe in the chunk.
            if (group.length > CssHitsCounter.CSS_HITS_BATCH_SIZE) {
                if (chunk.length > 0) {
                    chunks.push(chunk);
                    chunk = [];
                }

                chunks.push(...splitDependentGroup(group));
                return;
            }

            if (chunk.length > 0
                && chunk.length + group.length > CssHitsCounter.CSS_HITS_BATCH_SIZE) {
                chunks.push(chunk);
                chunk = [];
            }

            chunk.push(...group);

            if (chunk.length >= CssHitsCounter.CSS_HITS_BATCH_SIZE) {
                chunks.push(chunk);
                chunk = [];
            }
        });

        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        return chunks;
    }

    /**
     * Counts probes collected before and after the counter initialization.
     *
     * Each probe is temporarily reinserted into the document, so that the
     * injected marker can be read from its computed style, and removed
     * synchronously after the counting, so it is never painted. The probes
     * are processed in small chunks when possible, so a large queue does not
     * block the page in one task; a dependency chain deeper than the chunk
     * size is processed as one chunk. Nothing stays in the document between
     * chunks.
     *
     * Probes are ordered by dependency: a probe removed from another probe's
     * element is processed after that element is restored, and dependent
     * probes are kept in the same chunk. Without this, a bait removed before
     * its container would be measured with a detached target, and a container
     * removed before its bait would be removed again before the bait is
     * processed.
     *
     * Probes that did not match any rule are retried a few times, since the
     * marker styles may be injected slightly after the cosmetic data is
     * received. Once any hit is observed, the styles are known to be applied,
     * so unmatched probes are not retried; a probe is also not retried when
     * its own subtree already produced a hit. An ancestor probe stays queued
     * while a probe that still needs a retry depends on it, even if the
     * ancestor's own retry budget is exhausted.
     *
     * Only native stylesheet markers are detected this way: ExtendedCss
     * rules are reported when ExtendedCss itself applies them to an element.
     */
    private countPendingProbes(): void {
        if (this.stopped || this.pendingProbes.length === 0) {
            return;
        }

        const allProbes = this.pendingProbes;
        this.pendingProbes = [];

        const chunks = CssHitsCounter.orderPendingProbes(allProbes);
        const probes = chunks[0] ?? [];
        // Probes that did not fit into this chunk, if any.
        const remainingProbes = chunks.slice(1).flat();
        // An ancestor probe is repeated in each dependent chunk; it will be
        // processed again in a later chunk, so it must not spend its retry
        // budget here.
        const remainingProbeSet = new Set(remainingProbes);

        // Elements that another probe in this chunk was removed from. A
        // counted probe that is such an ancestor must be restored again,
        // otherwise the dependent probe cannot be measured in its original
        // parent.
        const ancestorElements = new Set<Element>();
        probes.forEach(({ target }) => {
            let node: Node | null = target;
            while (node) {
                if (node instanceof Element) {
                    ancestorElements.add(node);
                }
                node = node.parentNode;
            }
        });

        const elementsToCount: Element[] = [];
        const restoredProbeElements: Element[] = [];
        const countedElements = new Set<Element>();
        // Probes that do not need another pass: counted or intentionally
        // skipped (e.g. their subtree must not be re-inserted).
        const settledProbes = new Set<PendingProbe>();
        // Maps every counted element to the probe it belongs to, so a probe
        // is not retried once any element of its subtree has matched.
        const probeByElement = new Map<Element, PendingProbe>();
        let result: ICountedElement[] = [];

        if (this.observer) {
            this.observer.disconnect();
        }

        try {
            for (let i = 0; i < probes.length; i += 1) {
                const probe = probes[i];
                const { element } = probe;

                // The mutation observer already re-inserted and counted the
                // element, or, once the marker styles are known to be
                // applied, already re-inserted it without a hit. It must not
                // be put back again unless another probe in this chunk
                // depends on it.
                if ((this.countedProbes.has(element)
                    || (this.markerStylesApplied && this.probedElements.has(element)))
                    && !ancestorElements.has(element)) {
                    settledProbes.add(probe);
                    continue;
                }

                // ExtendedCss already reported the hit and removed the
                // element itself, so it must not be put back.
                if (this.extendedCssRemovedElements.has(element)) {
                    settledProbes.add(probe);
                    continue;
                }

                // The page may re-attach the element (or move it into a
                // detached container) while the probe is queued. Never move
                // such an element: re-inserting it would tear it out of its
                // container. A connected element can still be counted in
                // place; a detached one cannot match any rule.
                if (element.parentNode) {
                    if (!element.isConnected) {
                        settledProbes.add(probe);
                        continue;
                    }

                    const attachedDescendants: Element[] = [];
                    ElementUtils.appendChildren(element, attachedDescendants);

                    elementsToCount.push(element);
                    probeByElement.set(element, probe);
                    for (let j = 0; j < attachedDescendants.length; j += 1) {
                        elementsToCount.push(attachedDescendants[j]);
                        probeByElement.set(attachedDescendants[j], probe);
                    }
                    continue;
                }

                const descendants: Element[] = [];
                ElementUtils.appendChildren(element, descendants);

                // Do not re-insert resource-bearing or custom element
                // subtrees: it re-runs page side effects.
                if (!isProbeRestorable(element, descendants)) {
                    settledProbes.add(probe);
                    continue;
                }

                const restoreTarget = CssHitsCounter.getProbeRestoreTarget(probe.target);
                // Without a connected ancestor the probe cannot be measured
                // in its original cascade context, so do not restore it in an
                // unrelated position and do not burn its retry budget.
                if (!restoreTarget) {
                    settledProbes.add(probe);
                    continue;
                }

                CssHitsCounter.insertProbe(
                    element,
                    restoreTarget,
                    probe.previousSibling,
                    probe.nextSibling,
                );
                restoredProbeElements.push(element);

                elementsToCount.push(element);
                probeByElement.set(element, probe);
                for (let j = 0; j < descendants.length; j += 1) {
                    elementsToCount.push(descendants[j]);
                    probeByElement.set(descendants[j], probe);
                }
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

        // A matched element (the probe itself or one of its descendants)
        // means the marker styles are applied, so the probe must not be
        // retried. Each remaining probe has its own retry budget, so probes
        // delivered while a retry is armed are not dropped with the batch
        // they joined.
        const probesWithHit = new Set<PendingProbe>();
        countedElements.forEach((element) => {
            const probe = probeByElement.get(element);
            if (probe) {
                probesWithHit.add(probe);
            }
        });

        const retryProbes: PendingProbe[] = [];

        for (let i = 0; i < probes.length; i += 1) {
            const probe = probes[i];
            if (settledProbes.has(probe) || probesWithHit.has(probe)) {
                continue;
            }

            // The marker styles are already known to be applied: this probe
            // did not match, and a retry would not change that.
            if (this.markerStylesApplied) {
                continue;
            }

            // The next chunk processes this probe again as an ancestor, so
            // do not spend its retry budget on chunking.
            if (remainingProbeSet.has(probe)) {
                continue;
            }

            const attempts = (this.pendingProbeAttempts.get(probe) ?? 0) + 1;
            this.pendingProbeAttempts.set(probe, attempts);

            if (attempts < CssHitsCounter.PENDING_PROBES_MAX_ATTEMPTS) {
                retryProbes.push(probe);
            }
        }

        // A retrying probe still needs its ancestor to restore the original
        // parent. Keep that ancestor queued even when its own retry budget is
        // exhausted; otherwise the retrying probe would be measured with a
        // detached target.
        if (!this.markerStylesApplied
            && (retryProbes.length > 0 || remainingProbes.length > 0)) {
            const neededAncestorElements = new Set<Element>();
            const collectAncestors = (probe: PendingProbe): void => {
                let node: Node | null = probe.target;
                while (node) {
                    if (node instanceof Element) {
                        neededAncestorElements.add(node);
                    }
                    node = node.parentNode;
                }
            };

            retryProbes.forEach(collectAncestors);
            remainingProbes.forEach(collectAncestors);

            const retryProbeSet = new Set(retryProbes);
            for (let i = 0; i < probes.length; i += 1) {
                const probe = probes[i];
                if (settledProbes.has(probe)
                    || probesWithHit.has(probe)
                    || retryProbeSet.has(probe)
                    || remainingProbeSet.has(probe)) {
                    continue;
                }

                if (neededAncestorElements.has(probe.element)) {
                    retryProbes.push(probe);
                    retryProbeSet.add(probe);
                }
            }
        }

        // Retried probes are processed before the next chunk, so their retry
        // delay is not stretched by a large queue.
        const queuedProbes = remainingProbes.length > 0
            ? [...retryProbes, ...remainingProbes]
            : retryProbes;

        // A probe can appear in several dependent chunks as an ancestor; the
        // next pass re-splits the group, so keep a single queue entry.
        const uniqueQueuedProbes = [...new Set(queuedProbes)];

        if (uniqueQueuedProbes.length === 0 || this.stopped) {
            return;
        }

        this.pendingProbes = uniqueQueuedProbes;

        // Only the retried probes need to wait for the marker styles; the
        // next chunk of fresh probes can be processed right away.
        const delay = retryProbes.length > 0 || remainingProbes.length === 0
            ? CssHitsCounter.PENDING_PROBES_RETRY_DELAY_MS
            : CssHitsCounter.COUNT_CSS_HITS_BATCH_DELAY;

        this.pendingProbesTimeoutId = window.setTimeout(() => {
            this.pendingProbesTimeoutId = null;
            this.countPendingProbes();
        }, delay);
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
     * Returns the node where a detached probe can be temporarily restored
     * before `getComputedStyle` is called.
     *
     * The probe must be measured in its original cascade context: restoring it
     * in a different tree position could report a hit for a rule that does not
     * actually match the element, or miss a context-dependent rule. Therefore
     * the original mutation target is used only if it is still a connected
     * element. `isConnected` is inherited, so a detached target has no
     * connected ancestor either.
     *
     * @param target Original mutation target.
     *
     * @returns The target if it is a connected element, otherwise `null`.
     */
    private static getProbeRestoreTarget(target: Node): Node | null {
        return target instanceof Element && target.isConnected ? target : null;
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
}
