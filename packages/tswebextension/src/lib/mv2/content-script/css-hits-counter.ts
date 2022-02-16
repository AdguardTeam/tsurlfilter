/* eslint-disable no-param-reassign */

import { IAffectedElement } from 'extended-css';
import { ElementUtils } from './utils/element-utils';
import { HitsStorage } from './hits-storage';

/**
 * Counted element interface
 */
interface ICountedElement {
    filterId: number;
    ruleText: string;
    element: string;
}

/**
 * Class represents collecting css style hits process
 *
 * During applying css styles to element we add special 'content:' attribute
 * Example:
 * .selector -> .selector { content: 'adguard{filterId};{ruleText} !important;}
 *
 * then here we parse this attribute and calls provided callback function
 */
export class CssHitsCounter {
    /**
     * We split CSS hits counting into smaller batches of elements
     * and schedule them one by one using setTimeout
     */
    private static readonly COUNT_CSS_HITS_BATCH_DELAY = 5;

    /**
     * Size of small batches of elements we count
     */
    private static readonly CSS_HITS_BATCH_SIZE = 25;

    /**
     * In order to find elements hidden by AdGuard we look for a `:content` pseudo-class
     * with values starting with this prefix. Filter information will be
     * encoded in this value as well.
     */
    private static readonly CONTENT_ATTR_PREFIX = 'adguard';

    /**
     * We delay countAllCssHits function if it was called too frequently from mutationObserver
     */
    private static readonly COUNT_ALL_CSS_HITS_TIMEOUT_MS = 500;

    /**
     * Callback function for counted css hits handling
     */
    private onCssHitsFoundCallback: (x: ICountedElement[]) => void;

    /**
     * Hits storage
     */
    private hitsStorage: HitsStorage = new HitsStorage();

    /**
     * Mutation observer
     */
    private observer: MutationObserver | null = null;

    /**
     * Counting on process flag
     */
    private countIsWorking = false;

    /**
     * This function prepares calculation of css hits.
     * We are waiting for 'load' event and start calculation.
     * @param callback - ({filterId: number; ruleText: string; element: string}[]) => {} handles counted css hits
     */
    constructor(callback: (x: ICountedElement[]) => void) {
        this.onCssHitsFoundCallback = callback;

        if (document.readyState === 'complete'
            || document.readyState === 'interactive') {
            this.countCssHits();
        } else {
            document.addEventListener('readystatechange', this.startCounter.bind(this));
        }
    }

    /**
     * Stops css hits counting process
     */
    public stop(): void {
        this.onCssHitsFoundCallback = (): void => {};
        if (this.observer) {
            this.observer.disconnect();
        }
    }

    /**
     * Callback used to collect statistics of elements affected by extended css rules
     *
     * @param {object} affectedEl
     * @return {object} affectedEl
     */
    public countAffectedByExtendedCss(affectedEl: IAffectedElement): IAffectedElement {
        if (affectedEl && affectedEl.rules && affectedEl.rules.length > 0) {
            const result = [];

            for (const rule of affectedEl.rules) {
                if (rule.style && rule.style.content) {
                    const styleInfo = ElementUtils.parseExtendedStyleInfo(
                        rule.style.content,
                        CssHitsCounter.CONTENT_ATTR_PREFIX,
                    );
                    if (styleInfo === null) {
                        continue;
                    }

                    const { filterId, ruleText } = styleInfo;
                    if (filterId !== undefined && ruleText !== undefined) {
                        result.push({
                            filterId,
                            ruleText,
                            element: ElementUtils.elementToString(affectedEl.node),
                        });

                        // clear style content to avoid duplicate counting
                        rule.style.content = '';
                    }
                }
            }

            this.onCssHitsFoundCallback(result);
        }

        return affectedEl;
    }

    /**
     * Starts counting process
     */
    private startCounter(): void {
        if (document.readyState === 'interactive'
            || document.readyState === 'complete') {
            this.countCssHits();

            document.removeEventListener('readystatechange', this.startCounter);
        }
    }

    /**
     * Counts css hits
     */
    private countCssHits(): void {
        this.countAllCssHits();
        this.countCssHitsForMutations();
    }

    /**
     * Counts css hits for already affected elements
     */
    private countAllCssHits(): void {
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
     * @param elements Collection of all elements
     * @param start Start of batch
     * @param end End of batch
     * @param step Size of batch
     * @param result Collection for save result
     * @param callback Finish callback
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
     * Counts css hits for array of elements
     *
     * @param elements
     * @param start
     * @param length
     */
    private countCssHitsForElements(
        elements: NodeListOf<Element> | Element[],
        start: number,
        length: number | null,
    ): { filterId: number; ruleText: string; element: string }[] {
        const RULE_FILTER_SEPARATOR = ';';
        start = start || 0;
        length = length || elements.length;

        const result = [];
        for (let i = start; i < length; i += 1) {
            const element = elements[i];
            const cssHitData = CssHitsCounter.getCssHitData(element);
            if (!cssHitData) {
                continue;
            }

            const { filterId, ruleText } = cssHitData;
            const ruleAndFilterString = filterId + RULE_FILTER_SEPARATOR + ruleText;

            if (this.hitsStorage.isCounted(element, ruleAndFilterString)) {
                continue;
            }
            this.hitsStorage.setCounted(element, ruleAndFilterString);

            result.push({
                filterId,
                ruleText,
                element: ElementUtils.elementToString(element),
            });
        }

        return result;
    }

    /**
     * Counts css hits for mutations
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
                        // Most likely this is a "probe" element that was added and then
                        // immediately removed from DOM.
                        // We re-add it and check if any rule matched it
                        probeElements.push(node);

                        // CSS rules could be applied to the nodes inside probe element
                        // that's why we get all child elements of added node
                        ElementUtils.appendChildren(node, childrenOfProbeElements);

                        if (this.observer) {
                            this.observer.disconnect();
                        }

                        mutationRecord.target.appendChild(node);
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
                 * don't remove child elements of probe elements
                 * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1096
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
     * Starts mutation observer
     */
    private startObserver(): void {
        if (this.observer) {
            this.observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
            });
        }
    }

    /**
     * Function checks if elements style content attribute contains data injected with AdGuard
     *
     * @param {Node} element
     * @returns {({filterId: Number, ruleText: String} | null)}
     */
    private static getCssHitData(element: Element): { filterId: number; ruleText: string } | null {
        const style = getComputedStyle(element);
        return ElementUtils.parseInfo(style.content, CssHitsCounter.CONTENT_ATTR_PREFIX);
    }

    /**
     * Check if tag is ignored
     * @param nodeTag
     */
    private static isIgnoredNodeTag(nodeTag: string): boolean {
        const ignoredTags = ['script'];
        return ignoredTags.includes(nodeTag.toLowerCase());
    }
}
