/**
 * @vitest-environment jsdom
 */

import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CssHitsCounter } from '../../../../src/lib';
import {
    type PendingProbe,
    PendingProbesCollector,
} from '../../../../src/lib/common/content-script/pending-probes-collector';
import { mockMutationObserver, MutationObserverMock } from '../../../helpers/mutation-observer';

describe('CssHitsCounter', () => {
    // Mock document
    document.body.innerHTML = `
        <p>test</p>
        <div id="testDiv">
            <div id="childDiv"></div>
            <div id="hiddenDiv1" style="display: none; --adguard-hit:'adguard1%3B1';"></div>
            <div id="hiddenDiv2" style="display: none !important; --adguard-hit:'adguard2%3B2' !important;"></div>
         </div>
        `;

    /**
     * Creates a collector mock whose subscription callback can be invoked
     * directly by tests.
     *
     * @param isObserving Whether the mock collector is observing.
     *
     * @returns The collector and a function delivering probes to it.
     */
    const createProbesCollector = (isObserving = true): {
        collector: PendingProbesCollector;
        deliver: (probes: PendingProbe[]) => void;
    } => {
        let onProbesCollected: ((probes: PendingProbe[]) => void) | null = null;

        const collector = {
            isObserving,
            takePendingProbes: (): PendingProbe[] => [],
            setOnProbesCollected: (callback: ((probes: PendingProbe[]) => void) | null): void => {
                onProbesCollected = callback;
            },
            setOnObservationEnded: (): void => {},
            stop: vi.fn(),
        } as unknown as PendingProbesCollector;

        return {
            collector,
            deliver: (probes: PendingProbe[]): void => {
                onProbesCollected?.(probes);
            },
        };
    };

    /**
     * Temporarily removes the fixture elements with inline markers, so the
     * full scan does not report a hit in tests that exercise retries.
     *
     * @returns Function restoring the removed elements.
     */
    const removeFixtureMarkerElements = (): (() => void) => {
        const elements = ['hiddenDiv1', 'hiddenDiv2']
            .map((id) => document.getElementById(id))
            .filter((element): element is HTMLElement => element !== null)
            .map((element) => ({ element, parent: element.parentElement }));

        elements.forEach(({ element }) => element.remove());

        return () => {
            elements.forEach(({ element, parent }) => {
                parent?.appendChild(element);
            });
        };
    };

    it('checks class parameters', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const cssHitsCounter = new CssHitsCounter((stats: any): void => {});
        cssHitsCounter.stop();

        const elementToCount = {
            rules: [{ style: { content: 'adguard4;test-rule-ext-css' } }],
            node: document.getElementById('testDiv')!,
        };
        cssHitsCounter.countAffectedByExtendedCss(elementToCount);
    });

    it('uses the elementToString default when the options omit it', () => {
        const style = document.createElement('style');
        style.textContent = [
            'div.default-string-bait',
            "{ display: none !important; --adguard-hit: 'adguard27%3B27' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        try {
            const bait = document.createElement('div');
            bait.className = 'default-string-bait';
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, {
                pendingProbes: [{
                    element: bait,
                    target: document.body,
                    previousSibling: null,
                    nextSibling: null,
                }],
            });

            const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
            const hit = flat.find((stat) => stat.filterId === 27);

            expect(hit).toBeDefined();
            expect(typeof hit?.element).toBe('string');
            expect(hit?.element).toEqual(expect.stringContaining('default-string-bait'));

            counter.stop();
        } finally {
            style.remove();
        }
    });

    it('checks counting', () => {
        const onCssHitsFound = vi.fn((stats: any): void => {
            expect(stats).toHaveLength(2);

            expect(stats[0].filterId).toBe(1);
            expect(stats[0].ruleIndex).toBe(1);
            expect(stats[0].element)
                .toBe('<div id="hiddenDiv1" style="display: none; --adguard-hit:\'adguard1%3B1\';">');

            expect(stats[1].filterId).toBe(2);
            expect(stats[1].ruleIndex).toBe(2);
            // eslint-disable-next-line max-len
            expect(stats[1].element).toBe('<div id="hiddenDiv2" style="display: none !important; --adguard-hit:\'adguard2%3B2\' !important;">');
        });

        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        expect(onCssHitsFound).toHaveBeenCalled();

        cssHitsCounter.stop();
    });

    it('checks counting with mutations', () => {
        const onCssHitsFound = vi.fn((stats: any): void => {
            expect(stats).not.toBeNull();
        });

        const restoreMutationObserver = mockMutationObserver();

        try {
            const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

            const template = document.createElement('div');
            // eslint-disable-next-line max-len
            template.innerHTML = '<div id="mutationDiv" style="display: none !important; --adguard-hit:\'adguard3%3B3\';"></div>';

            const mutationRecord = {
                addedNodes: [template],
                removedNodes: [],
                type: 'childList',
                attributeName: 'style',
                target: document.body,
            };
            MutationObserverMock.last!.trigger([mutationRecord as unknown as MutationRecord]);

            expect(onCssHitsFound).toHaveBeenCalledTimes(2);
            expect(onCssHitsFound).toHaveBeenLastCalledWith([{
                filterId: 3,
                ruleIndex: 3,
                element: '<div id="mutationDiv" style="display: none !important; --adguard-hit:\'adguard3%3B3\';">',
            }]);

            // The probe must not stay in the document.
            expect(template.parentNode).toBeNull();

            cssHitsCounter.stop();
        } finally {
            restoreMutationObserver();
        }
    });

    it('checks if countAffectedByExtendedCss is ok', () => {
        const onCssHitsFound = vi.fn((stats: any): void => {
            expect(stats).not.toBeNull();
        });

        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const elementToCount = {
            rules: [{ style: { content: 'some' } }],
            node: document.getElementById('testDiv')!,
        };

        let affectedElement = cssHitsCounter.countAffectedByExtendedCss(elementToCount);
        expect(affectedElement).toBe(elementToCount);

        elementToCount.rules[0].style.content = 'adguard4;4';

        affectedElement = cssHitsCounter.countAffectedByExtendedCss(elementToCount);

        expect(affectedElement).toBe(elementToCount);

        expect(onCssHitsFound).toHaveBeenCalledTimes(3);
        expect(onCssHitsFound).toHaveBeenLastCalledWith([{
            filterId: 4,
            ruleIndex: 4,
            element: '<div id="testDiv">',
        }]);
        // The reader is expected to clear the marker so it cannot be
        // painted on rules that don't also hide the element.
        expect(elementToCount.rules[0].style.content).toBe('');

        cssHitsCounter.stop();
    });

    it('counts --adguard-hit marker without leaking marker text (AG-265)', () => {
        // Emitter output under the new design: stylesheet carries an
        // `@property` declaration and the marker is a custom property.
        // No `adguard` string ever renders as visible text.
        const style = document.createElement('style');
        style.textContent = [
            "@property --adguard-hit { syntax: '*'; inherits: false; initial-value: ''; }",
            "div.ag265 { --adguard-hit: 'adguard0%3B99' !important; }",
        ].join('\n');
        document.head.appendChild(style);

        const target = document.createElement('div');
        target.className = 'ag265';
        document.body.appendChild(target);

        // jsdom implements `getComputedStyle(el)` for author stylesheets
        // parsed from a <style> tag, which is what we exercise here.
        const onCssHitsFound = vi.fn();
        const counter = new CssHitsCounter(onCssHitsFound);

        expect(onCssHitsFound).toHaveBeenCalled();
        const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
        expect(flat).toContainEqual(expect.objectContaining({ filterId: 0, ruleIndex: 99 }));

        // No marker text leaked into any visible rendering surface.
        expect(target.textContent).toBe('');

        counter.stop();
        target.remove();
        style.remove();
    });

    it('counts probes collected before the counter initialization (AG-48018)', () => {
        const style = document.createElement('style');
        style.textContent = "div.pending-bait { display: none !important; --adguard-hit: 'adguard7%3B7' !important; }";
        document.head.appendChild(style);

        const bait = document.createElement('div');
        bait.className = 'pending-bait';

        const onCssHitsFound = vi.fn();
        const counter = new CssHitsCounter(onCssHitsFound, {
            pendingProbes: [{
                element: bait,
                target: document.body,
                previousSibling: null,
                nextSibling: null,
            }],
        });

        const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
        expect(flat).toContainEqual(expect.objectContaining({ filterId: 7, ruleIndex: 7 }));

        // The probe must not stay in the document.
        expect(bait.parentNode).toBeNull();
        expect(document.body.contains(bait)).toBe(false);

        counter.stop();
        style.remove();
    });

    it('restores a pending probe at its original position', () => {
        const style = document.createElement('style');
        // The marker is only applied to the second child, so the probe must
        // be reinserted between its original siblings to be counted.
        style.textContent = [
            'div.position-test > div:nth-child(2)',
            "{ display: none !important; --adguard-hit: 'adguard8%3B8' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.className = 'position-test';
        const first = document.createElement('div');
        const second = document.createElement('div');
        container.appendChild(first);
        container.appendChild(second);
        document.body.appendChild(container);

        const bait = document.createElement('div');
        bait.className = 'position-bait';

        const onCssHitsFound = vi.fn();
        const counter = new CssHitsCounter(onCssHitsFound, {
            pendingProbes: [{
                element: bait,
                target: container,
                previousSibling: first,
                nextSibling: second,
            }],
        });

        const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
        expect(flat).toContainEqual(expect.objectContaining({ filterId: 8, ruleIndex: 8 }));
        expect(bait.parentNode).toBeNull();

        counter.stop();
        style.remove();
        container.remove();
    });

    it('measures a bait removed before its container in the same chunk', () => {
        const style = document.createElement('style');
        style.textContent = [
            'div.nested-bait',
            "{ display: none !important; --adguard-hit: 'adguard18%3B18' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        const container = document.createElement('div');
        const bait = document.createElement('div');
        bait.className = 'nested-bait';
        container.appendChild(bait);
        document.body.appendChild(container);

        // Both elements are removed before the pending probes are processed:
        // the bait first, then its container. Dependency ordering restores
        // the container before the bait.
        bait.remove();
        container.remove();

        const onCssHitsFound = vi.fn();
        const counter = new CssHitsCounter(onCssHitsFound, {
            pendingProbes: [
                {
                    element: bait,
                    target: container,
                    previousSibling: null,
                    nextSibling: null,
                },
                {
                    element: container,
                    target: document.body,
                    previousSibling: null,
                    nextSibling: null,
                },
            ],
        });

        const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
        expect(flat).toContainEqual(expect.objectContaining({ filterId: 18, ruleIndex: 18 }));
        expect(bait.parentNode).toBeNull();
        expect(container.parentNode).toBeNull();

        counter.stop();
        style.remove();
    });

    it('measures a bait whose container was removed first', () => {
        const style = document.createElement('style');
        style.textContent = [
            'div.mirror-bait',
            "{ display: none !important; --adguard-hit: 'adguard21%3B21' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        const container = document.createElement('div');
        const bait = document.createElement('div');
        bait.className = 'mirror-bait';
        container.appendChild(bait);
        document.body.appendChild(container);

        bait.remove();
        container.remove();

        const onCssHitsFound = vi.fn();
        const counter = new CssHitsCounter(onCssHitsFound, {
            pendingProbes: [
                {
                    element: container,
                    target: document.body,
                    previousSibling: null,
                    nextSibling: null,
                },
                {
                    element: bait,
                    target: container,
                    previousSibling: null,
                    nextSibling: null,
                },
            ],
        });

        const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
        expect(flat).toContainEqual(expect.objectContaining({ filterId: 21, ruleIndex: 21 }));
        expect(bait.parentNode).toBeNull();
        expect(container.parentNode).toBeNull();

        counter.stop();
        style.remove();
    });

    it('keeps a container and its bait together across the batch boundary', () => {
        vi.useFakeTimers();

        const style = document.createElement('style');
        style.textContent = [
            'div.boundary-bait',
            "{ display: none !important; --adguard-hit: 'adguard22%3B22' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        const container = document.createElement('div');
        const bait = document.createElement('div');
        bait.className = 'boundary-bait';
        container.appendChild(bait);
        document.body.appendChild(container);

        bait.remove();
        container.remove();

        // 24 independent probes before the pair would push the container
        // into the next chunk without dependency grouping.
        const fillers = Array.from({ length: 24 }, () => document.createElement('div'));

        try {
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, {
                pendingProbes: [
                    ...fillers.map((element) => ({
                        element,
                        target: document.body,
                        previousSibling: null,
                        nextSibling: null,
                    })),
                    {
                        element: bait,
                        target: container,
                        previousSibling: null,
                        nextSibling: null,
                    },
                    {
                        element: container,
                        target: document.body,
                        previousSibling: null,
                        nextSibling: null,
                    },
                ],
            });

            vi.advanceTimersByTime(200);

            const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
            expect(flat).toContainEqual(expect.objectContaining({ filterId: 22, ruleIndex: 22 }));
            expect(bait.parentNode).toBeNull();
            expect(container.parentNode).toBeNull();

            counter.stop();
        } finally {
            vi.useRealTimers();
            style.remove();
        }
    });

    it('limits the number of elements restored in one task for a large dependent group', () => {
        const container = document.createElement('div');
        const children = Array.from({ length: 200 }, () => document.createElement('div'));
        children.forEach((child) => container.appendChild(child));
        document.body.appendChild(container);
        children.forEach((child) => child.remove());
        container.remove();

        const bodyAppendSpy = vi.spyOn(document.body, 'appendChild');
        const containerAppendSpy = vi.spyOn(container, 'appendChild');

        const onCssHitsFound = vi.fn();
        const counter = new CssHitsCounter(onCssHitsFound, {
            pendingProbes: [
                ...children.map((element) => ({
                    element,
                    target: container,
                    previousSibling: null,
                    nextSibling: null,
                })),
                {
                    element: container,
                    target: document.body,
                    previousSibling: null,
                    nextSibling: null,
                },
            ],
        });

        // The first task restores the container and at most 24 children.
        expect(bodyAppendSpy.mock.calls.length + containerAppendSpy.mock.calls.length)
            .toBeLessThanOrEqual(25);
        expect(containerAppendSpy.mock.calls.length).toBeLessThanOrEqual(24);

        bodyAppendSpy.mockRestore();
        containerAppendSpy.mockRestore();
        counter.stop();
    });

    it('drains a dependency chain deeper than the batch size', () => {
        vi.useFakeTimers();

        const restoreFixtureMarkers = removeFixtureMarkerElements();

        const chainLength = 26;
        const elements = Array.from({ length: chainLength }, () => document.createElement('div'));
        for (let i = 1; i < chainLength; i += 1) {
            elements[i - 1].appendChild(elements[i]);
        }
        document.body.appendChild(elements[0]);
        for (let i = chainLength - 1; i >= 0; i -= 1) {
            elements[i].remove();
        }

        const bodyAppendSpy = vi.spyOn(document.body, 'appendChild');
        const getRootInsertions = (): number => bodyAppendSpy.mock.calls
            .filter(([node]) => node === elements[0])
            .length;

        try {
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, {
                pendingProbes: elements.map((element, index) => ({
                    element,
                    target: index === 0 ? document.body : elements[index - 1],
                    previousSibling: null,
                    nextSibling: null,
                })),
            });

            // Five passes process the whole chain. A chunk that only repeats
            // probes from later chunks must not be requeued forever.
            vi.advanceTimersByTime(1000);
            const insertions = getRootInsertions();
            expect(insertions).toBeLessThanOrEqual(5);

            vi.advanceTimersByTime(1000);
            expect(getRootInsertions()).toBe(insertions);

            bodyAppendSpy.mockRestore();
            counter.stop();
        } finally {
            restoreFixtureMarkers();
            vi.useRealTimers();
        }
    });

    it('restores a counted container when a bait was removed from it', () => {
        vi.useFakeTimers();
        const restoreMutationObserver = mockMutationObserver();

        const style = document.createElement('style');
        style.textContent = [
            "div.counted-container { display: none !important; --adguard-hit: 'adguard23%3B23' !important; }",
            "div.counted-bait { display: none !important; --adguard-hit: 'adguard24%3B24' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        try {
            const { collector, deliver } = createProbesCollector();
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, { pendingProbesCollector: collector });

            const container = document.createElement('div');
            container.className = 'counted-container';

            // The page adds and removes the matching container in one task;
            // the counter's observer re-inserts and counts it.
            MutationObserverMock.last!.trigger([{
                addedNodes: [container],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            const containerHits = onCssHitsFound.mock.calls
                .flatMap((c) => c[0])
                .filter((stat: any) => stat.filterId === 23);
            expect(containerHits).toHaveLength(1);

            // The bait was removed from the container before the container
            // was removed; both are reported by the collector.
            const bait = document.createElement('div');
            bait.className = 'counted-bait';
            deliver([
                {
                    element: bait,
                    target: container,
                    previousSibling: null,
                    nextSibling: null,
                },
                {
                    element: container,
                    target: document.body,
                    previousSibling: null,
                    nextSibling: null,
                },
            ]);

            vi.advanceTimersByTime(1000);

            const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
            expect(flat).toContainEqual(expect.objectContaining({ filterId: 24, ruleIndex: 24 }));
            expect(bait.parentNode).toBeNull();
            expect(container.parentNode).toBeNull();

            counter.stop();
        } finally {
            restoreMutationObserver();
            vi.useRealTimers();
            style.remove();
        }
    });

    it('marks a probe root as counted when its descendant matched', () => {
        vi.useFakeTimers();
        const restoreMutationObserver = mockMutationObserver();

        const style = document.createElement('style');
        style.textContent = "div.probe-child { display: none !important; --adguard-hit: 'adguard26%3B26' !important; }";
        document.head.appendChild(style);

        try {
            const { collector, deliver } = createProbesCollector();
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, { pendingProbesCollector: collector });

            const root = document.createElement('div');
            const child = document.createElement('div');
            child.className = 'probe-child';
            root.appendChild(child);

            // The observer re-inserts the root, counts the child, and
            // removes the root.
            MutationObserverMock.last!.trigger([{
                addedNodes: [root],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            const childHits = onCssHitsFound.mock.calls
                .flatMap((c) => c[0])
                .filter((stat: any) => stat.filterId === 26);
            expect(childHits).toHaveLength(1);

            const bodyAppendSpy = vi.spyOn(document.body, 'appendChild');
            deliver([{
                element: root,
                target: document.body,
                previousSibling: null,
                nextSibling: null,
            }]);

            vi.advanceTimersByTime(1000);

            // The observer already counted the child, so the pending pass
            // must not insert the root again.
            expect(bodyAppendSpy.mock.calls.filter(([node]) => node === root)).toHaveLength(0);

            bodyAppendSpy.mockRestore();
            counter.stop();
        } finally {
            restoreMutationObserver();
            vi.useRealTimers();
            style.remove();
        }
    });

    it('observes mutations during loading and scans the page only after interactive', () => {
        const restoreMutationObserver = mockMutationObserver();
        let readyState = 'loading';
        Object.defineProperty(document, 'readyState', {
            configurable: true,
            get: () => readyState,
        });

        const style = document.createElement('style');
        style.textContent = "div.loading-bait { display: none !important; --adguard-hit: 'adguard5%3B5' !important; }";
        document.head.appendChild(style);

        try {
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound);

            // The full scan is deferred until the document becomes
            // interactive, so the fixture elements must not be counted yet.
            expect(onCssHitsFound).not.toHaveBeenCalled();

            const bait = document.createElement('div');
            bait.className = 'loading-bait';

            MutationObserverMock.last!.trigger([{
                addedNodes: [bait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            expect(onCssHitsFound).toHaveBeenCalledTimes(1);
            expect(onCssHitsFound.mock.calls[0][0]).toEqual([
                expect.objectContaining({ filterId: 5, ruleIndex: 5 }),
            ]);

            // The bait must not stay in the document.
            expect(bait.parentNode).toBeNull();

            readyState = 'interactive';
            document.dispatchEvent(new Event('readystatechange'));

            // The full scan is performed after the document becomes
            // interactive and counts the fixture elements.
            const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
            expect(flat).toEqual(expect.arrayContaining([
                expect.objectContaining({ filterId: 1, ruleIndex: 1 }),
                expect.objectContaining({ filterId: 2, ruleIndex: 2 }),
            ]));

            counter.stop();
        } finally {
            delete (document as unknown as { readyState?: string }).readyState;
            style.remove();
            restoreMutationObserver();
        }
    });

    it('does not start its own observer during loading when a collector is provided', () => {
        const restoreMutationObserver = mockMutationObserver();
        let readyState = 'loading';
        Object.defineProperty(document, 'readyState', {
            configurable: true,
            get: () => readyState,
        });

        try {
            const { collector } = createProbesCollector();
            const counter = new CssHitsCounter(vi.fn(), { pendingProbesCollector: collector });

            // The collector covers the loading window; the counter must not
            // scan every mutation in parallel.
            expect(MutationObserverMock.instances).toHaveLength(0);

            readyState = 'interactive';
            document.dispatchEvent(new Event('readystatechange'));

            // At interactive the counter starts its own observer for the
            // regular mutation counting.
            expect(MutationObserverMock.instances).toHaveLength(1);

            counter.stop();
        } finally {
            delete (document as unknown as { readyState?: string }).readyState;
            restoreMutationObserver();
        }
    });

    it('starts its own observer when the collector is already stopped', () => {
        const restoreMutationObserver = mockMutationObserver();
        const readyState = 'loading';
        Object.defineProperty(document, 'readyState', {
            configurable: true,
            get: () => readyState,
        });

        try {
            const { collector } = createProbesCollector(false);
            const counter = new CssHitsCounter(vi.fn(), { pendingProbesCollector: collector });

            // The stopped collector does not cover the loading window.
            expect(MutationObserverMock.instances).toHaveLength(1);

            counter.stop();
        } finally {
            delete (document as unknown as { readyState?: string }).readyState;
            restoreMutationObserver();
        }
    });

    it('starts its own observer when the collector times out while loading', () => {
        vi.useFakeTimers();
        const restoreMutationObserver = mockMutationObserver();
        const readyState = 'loading';
        Object.defineProperty(document, 'readyState', {
            configurable: true,
            get: () => readyState,
        });

        try {
            const collector = new PendingProbesCollector();
            collector.start();
            expect(MutationObserverMock.instances).toHaveLength(1);

            const counter = new CssHitsCounter(vi.fn(), { pendingProbesCollector: collector });

            // Deferred while the collector is observing.
            expect(MutationObserverMock.instances).toHaveLength(1);

            vi.advanceTimersByTime(30000);

            // The collector stopped, so the counter covers the rest of the
            // loading window.
            expect(MutationObserverMock.instances).toHaveLength(2);

            counter.stop();
        } finally {
            delete (document as unknown as { readyState?: string }).readyState;
            restoreMutationObserver();
            vi.useRealTimers();
        }
    });

    it('retries pending probes until the marker is applied', () => {
        vi.useFakeTimers();

        const bait = document.createElement('div');
        bait.className = 'late-bait';
        const restoreFixtureMarkers = removeFixtureMarkerElements();

        try {
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, {
                pendingProbes: [{
                    element: bait,
                    target: document.body,
                    previousSibling: null,
                    nextSibling: null,
                }],
            });

            // No marker styles yet, nothing to count for the probe.
            const getProbeHits = (): unknown[] => onCssHitsFound.mock.calls
                .flatMap((c) => c[0])
                .filter((stat: any) => stat.filterId === 9);
            expect(getProbeHits()).toHaveLength(0);

            const style = document.createElement('style');
            style.textContent = "div.late-bait { display: none !important; --adguard-hit: 'adguard9%3B9' !important; }";
            document.head.appendChild(style);

            vi.advanceTimersByTime(100);

            expect(getProbeHits()).toHaveLength(1);
            expect(bait.parentNode).toBeNull();

            counter.stop();
            style.remove();
        } finally {
            restoreFixtureMarkers();
            vi.useRealTimers();
        }
    });

    it('does not retry unmatched probes after a hit proves the styles are applied', () => {
        vi.useFakeTimers();

        const style = document.createElement('style');
        style.textContent = [
            'div.marker-hit-bait',
            "{ display: none !important; --adguard-hit: 'adguard19%3B19' !important; }",
        ].join(' ');
        document.head.appendChild(style);
        const restoreFixtureMarkers = removeFixtureMarkerElements();

        try {
            const matchedBait = document.createElement('div');
            matchedBait.className = 'marker-hit-bait';
            const unmatchedBait = document.createElement('div');

            const appendChildSpy = vi.spyOn(document.body, 'appendChild');

            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, {
                pendingProbes: [
                    {
                        element: matchedBait,
                        target: document.body,
                        previousSibling: null,
                        nextSibling: null,
                    },
                    {
                        element: unmatchedBait,
                        target: document.body,
                        previousSibling: null,
                        nextSibling: null,
                    },
                ],
            });

            const getUnmatchedInsertions = (): number => appendChildSpy.mock.calls
                .filter(([node]) => node === unmatchedBait)
                .length;

            const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
            expect(flat).toContainEqual(expect.objectContaining({ filterId: 19, ruleIndex: 19 }));

            // The unmatched probe was checked once. The hit proves that the
            // marker styles are applied, so it must not be retried.
            expect(getUnmatchedInsertions()).toBe(1);
            vi.advanceTimersByTime(1000);
            expect(getUnmatchedInsertions()).toBe(1);

            appendChildSpy.mockRestore();
            counter.stop();
        } finally {
            restoreFixtureMarkers();
            vi.useRealTimers();
            style.remove();
        }
    });

    it('does not retry unmatched probes when the full scan found a hit', () => {
        vi.useFakeTimers();

        const restoreFixtureMarkers = removeFixtureMarkerElements();

        const style = document.createElement('style');
        style.textContent = [
            'div.full-scan-hit',
            "{ display: none !important; --adguard-hit: 'adguard20%3B20' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        const hidden = document.createElement('div');
        hidden.className = 'full-scan-hit';
        document.body.appendChild(hidden);

        try {
            const unmatchedBait = document.createElement('div');
            const appendChildSpy = vi.spyOn(document.body, 'appendChild');

            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, {
                pendingProbes: [{
                    element: unmatchedBait,
                    target: document.body,
                    previousSibling: null,
                    nextSibling: null,
                }],
            });

            const getUnmatchedInsertions = (): number => appendChildSpy.mock.calls
                .filter(([node]) => node === unmatchedBait)
                .length;

            // The full scan reports the attached element and proves that the
            // marker styles are applied.
            vi.advanceTimersByTime(1000);
            const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
            expect(flat).toContainEqual(expect.objectContaining({ filterId: 20, ruleIndex: 20 }));

            // The unmatched probe was checked once and not retried.
            expect(getUnmatchedInsertions()).toBe(1);

            appendChildSpy.mockRestore();
            counter.stop();
        } finally {
            restoreFixtureMarkers();
            vi.useRealTimers();
            style.remove();
            hidden.remove();
        }
    });

    it('gives probes delivered during a retry their own retry budget', () => {
        vi.useFakeTimers();

        // This probe never matches any rule and consumes its retry budget.
        const staleBait = document.createElement('div');
        staleBait.className = 'never-hidden';
        const restoreFixtureMarkers = removeFixtureMarkerElements();

        try {
            const { collector, deliver } = createProbesCollector();
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, {
                pendingProbes: [{
                    element: staleBait,
                    target: document.body,
                    previousSibling: null,
                    nextSibling: null,
                }],
                pendingProbesCollector: collector,
            });

            // Spend four attempts of the stale probe's budget; a retry is
            // still armed.
            vi.advanceTimersByTime(300);

            // The late probe joins while the retry is armed, so it must not
            // share the stale probe's remaining attempts.
            const lateBait = document.createElement('div');
            lateBait.className = 'late-streamed-bait';
            deliver([{
                element: lateBait,
                target: document.body,
                previousSibling: null,
                nextSibling: null,
            }]);

            // The stale probe exhausts its budget here; the late probe gets
            // its first attempt.
            vi.advanceTimersByTime(100);

            const style = document.createElement('style');
            style.textContent = [
                'div.late-streamed-bait',
                "{ display: none !important; --adguard-hit: 'adguard13%3B13' !important; }",
            ].join(' ');
            document.head.appendChild(style);

            vi.advanceTimersByTime(300);

            const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
            expect(flat).toContainEqual(expect.objectContaining({ filterId: 13, ruleIndex: 13 }));
            expect(lateBait.parentNode).toBeNull();

            counter.stop();
            style.remove();
        } finally {
            restoreFixtureMarkers();
            vi.useRealTimers();
        }
    });

    it('keeps a container queued while its late bait still has retries', () => {
        vi.useFakeTimers();

        const restoreFixtureMarkers = removeFixtureMarkerElements();

        const container = document.createElement('div');
        const bait = document.createElement('div');
        bait.className = 'late-nested-bait';
        container.appendChild(bait);
        document.body.appendChild(container);
        bait.remove();
        container.remove();

        try {
            const { collector, deliver } = createProbesCollector();
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, {
                pendingProbes: [{
                    element: container,
                    target: document.body,
                    previousSibling: null,
                    nextSibling: null,
                }],
                pendingProbesCollector: collector,
            });

            // Spend four attempts of the container's budget; a retry is
            // still armed.
            vi.advanceTimersByTime(300);

            // The bait arrives while the container's last attempt is armed.
            deliver([{
                element: bait,
                target: container,
                previousSibling: null,
                nextSibling: null,
            }]);

            // The container reaches its fifth attempt here and would be
            // dropped, but the bait still needs it to restore its parent.
            vi.advanceTimersByTime(100);

            const style = document.createElement('style');
            style.textContent = [
                'div.late-nested-bait',
                "{ display: none !important; --adguard-hit: 'adguard25%3B25' !important; }",
            ].join(' ');
            document.head.appendChild(style);

            vi.advanceTimersByTime(200);

            const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
            expect(flat).toContainEqual(expect.objectContaining({ filterId: 25, ruleIndex: 25 }));
            expect(bait.parentNode).toBeNull();
            expect(container.parentNode).toBeNull();

            counter.stop();
            style.remove();
        } finally {
            restoreFixtureMarkers();
            vi.useRealTimers();
        }
    });

    it('does not spend an ancestor retry budget on every sub-chunk', () => {
        vi.useFakeTimers();

        const restoreFixtureMarkers = removeFixtureMarkerElements();

        const container = document.createElement('div');
        const children = Array.from({ length: 50 }, () => {
            const child = document.createElement('div');
            // A restricted subtree makes the probe settle without being
            // restored, so the container is the only probe that can retry.
            child.appendChild(document.createElement('iframe'));
            return child;
        });
        children.forEach((child) => container.appendChild(child));
        document.body.appendChild(container);
        children.forEach((child) => child.remove());
        container.remove();

        const bodyAppendSpy = vi.spyOn(document.body, 'appendChild');
        const getContainerInsertions = (): number => bodyAppendSpy.mock.calls
            .filter(([node]) => node === container)
            .length;

        try {
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, {
                pendingProbes: [
                    ...children.map((element) => ({
                        element,
                        target: container,
                        previousSibling: null,
                        nextSibling: null,
                    })),
                    {
                        element: container,
                        target: document.body,
                        previousSibling: null,
                        nextSibling: null,
                    },
                ],
            });

            // The first chunk is processed synchronously. The container is
            // repeated in the next chunks, so it must not consume a retry
            // attempt here; the next chunk is processed after 5 ms.
            expect(getContainerInsertions()).toBe(1);
            vi.advanceTimersByTime(10);
            expect(getContainerInsertions()).toBeGreaterThan(1);

            bodyAppendSpy.mockRestore();
            counter.stop();
        } finally {
            restoreFixtureMarkers();
            vi.useRealTimers();
        }
    });

    it('clears the debounced full scan timer on stop', () => {
        vi.useFakeTimers();
        const restoreMutationObserver = mockMutationObserver();

        try {
            const counter = new CssHitsCounter(vi.fn());

            expect(vi.getTimerCount()).toBe(0);

            // Any mutation callback arms the debounced full scan.
            MutationObserverMock.last!.trigger([{
                addedNodes: [],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            expect(vi.getTimerCount()).toBe(1);
            counter.stop();
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            restoreMutationObserver();
            vi.useRealTimers();
        }
    });

    it('counts probes added after the counter initialization', () => {
        vi.useFakeTimers();

        const style = document.createElement('style');
        style.textContent = "div.added-bait { display: none !important; --adguard-hit: 'adguard10%3B10' !important; }";
        document.head.appendChild(style);

        try {
            const bait = document.createElement('div');
            bait.className = 'added-bait';

            const { collector, deliver } = createProbesCollector();
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, { pendingProbesCollector: collector });

            deliver([{
                element: bait,
                target: document.body,
                previousSibling: null,
                nextSibling: null,
            }]);

            vi.advanceTimersByTime(1);

            const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
            expect(flat).toContainEqual(expect.objectContaining({ filterId: 10, ruleIndex: 10 }));
            expect(bait.parentNode).toBeNull();

            counter.stop();
        } finally {
            vi.useRealTimers();
            style.remove();
        }
    });

    it('takes probes from the collector and stops it together with the counter', () => {
        const restoreMutationObserver = mockMutationObserver();

        const style = document.createElement('style');
        style.textContent = [
            'div.collector-bait',
            "{ display: none !important; --adguard-hit: 'adguard11%3B11' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        try {
            const collector = new PendingProbesCollector();
            collector.start();
            const collectorObserver = MutationObserverMock.last!;

            const bait = document.createElement('div');
            bait.className = 'collector-bait';
            collectorObserver.trigger([{
                addedNodes: [bait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, { pendingProbesCollector: collector });

            const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
            expect(flat).toContainEqual(expect.objectContaining({ filterId: 11, ruleIndex: 11 }));
            expect(bait.parentNode).toBeNull();

            counter.stop();

            // The collector must be stopped together with the counter.
            const anotherBait = document.createElement('div');
            collectorObserver.trigger([{
                addedNodes: [anotherBait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);
            expect(collector.takePendingProbes()).toHaveLength(0);
        } finally {
            style.remove();
            restoreMutationObserver();
        }
    });

    it('counts probes delivered by the collector after initialization', () => {
        const restoreMutationObserver = mockMutationObserver();
        vi.useFakeTimers();

        try {
            const collector = new PendingProbesCollector();
            collector.start();
            const collectorObserver = MutationObserverMock.last!;

            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, { pendingProbesCollector: collector });

            const style = document.createElement('style');
            style.textContent = [
                'div.streamed-bait',
                "{ display: none !important; --adguard-hit: 'adguard12%3B12' !important; }",
            ].join(' ');
            document.head.appendChild(style);

            // The element is added during loading and removed after the
            // counter exists: the collector must deliver it.
            const bait = document.createElement('div');
            bait.className = 'streamed-bait';
            document.body.appendChild(bait);
            collectorObserver.trigger([{
                addedNodes: [bait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            bait.remove();
            collectorObserver.trigger([{
                addedNodes: [],
                removedNodes: [bait],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            vi.advanceTimersByTime(1);

            const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
            expect(flat).toContainEqual(expect.objectContaining({ filterId: 12, ruleIndex: 12 }));
            expect(bait.parentNode).toBeNull();

            counter.stop();
            style.remove();
        } finally {
            vi.useRealTimers();
            restoreMutationObserver();
        }
    });

    it('does not move a probe that the page moved into a detached container', () => {
        const fragment = document.createDocumentFragment();
        const bait = document.createElement('div');
        fragment.appendChild(bait);

        const onCssHitsFound = vi.fn();
        const counter = new CssHitsCounter(onCssHitsFound, {
            pendingProbes: [{
                element: bait,
                target: document.body,
                previousSibling: null,
                nextSibling: null,
            }],
        });

        // The element must stay in the container: re-inserting it would tear
        // it out of there, and a detached element cannot match any rule.
        expect(bait.parentNode).toBe(fragment);

        counter.stop();
    });

    it('does not restore a probe without a connected ancestor', () => {
        const detachedContainer = document.createElement('div');
        const bait = document.createElement('div');

        const appendChildSpy = vi.spyOn(document.documentElement, 'appendChild');
        const insertBeforeSpy = vi.spyOn(document.documentElement, 'insertBefore');

        const counter = new CssHitsCounter(vi.fn(), {
            pendingProbes: [{
                element: bait,
                target: detachedContainer,
                previousSibling: null,
                nextSibling: null,
            }],
        });

        // Measuring the probe under <html> would use a different cascade
        // context and could report a hit for a rule that does not actually
        // match the element, so the probe must not be restored at all.
        expect(appendChildSpy).not.toHaveBeenCalled();
        expect(insertBeforeSpy).not.toHaveBeenCalled();
        expect(bait.parentNode).toBeNull();

        appendChildSpy.mockRestore();
        insertBeforeSpy.mockRestore();
        counter.stop();
    });

    it('does not restore a probe whose subtree contains a non-restorable element', () => {
        const withIframe = document.createElement('div');
        const iframe = document.createElement('iframe');
        withIframe.appendChild(iframe);

        const withCustomElement = document.createElement('div');
        const customElement = document.createElement('my-widget');
        withCustomElement.appendChild(customElement);

        const appendChildSpy = vi.spyOn(document.body, 'appendChild');
        const insertBeforeSpy = vi.spyOn(document.body, 'insertBefore');

        const onCssHitsFound = vi.fn();
        const counter = new CssHitsCounter(onCssHitsFound, {
            pendingProbes: [
                {
                    element: withIframe,
                    target: document.body,
                    previousSibling: null,
                    nextSibling: null,
                },
                {
                    element: withCustomElement,
                    target: document.body,
                    previousSibling: null,
                    nextSibling: null,
                },
            ],
        });

        // Re-inserting the subtrees would reload the frame and run the
        // custom element callbacks. The probes must not be restored at all;
        // checking `parentNode` alone would also pass after a restore and a
        // removal in the same pass.
        expect(appendChildSpy).not.toHaveBeenCalled();
        expect(insertBeforeSpy).not.toHaveBeenCalled();
        expect(withIframe.parentNode).toBeNull();
        expect(iframe.parentNode).toBe(withIframe);
        expect(withCustomElement.parentNode).toBeNull();
        expect(customElement.parentNode).toBe(withCustomElement);

        appendChildSpy.mockRestore();
        insertBeforeSpy.mockRestore();
        counter.stop();
    });

    it('restores a probe whose subtree contains only a script', () => {
        const style = document.createElement('style');
        style.textContent = [
            'div.script-bait',
            "{ display: none !important; --adguard-hit: 'adguard17%3B17' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        // Anti-adblock baits often append a script. Re-inserting an already
        // executed script does not run it again, so the hit must be counted.
        const bait = document.createElement('div');
        bait.className = 'script-bait';
        bait.appendChild(document.createElement('script'));

        const onCssHitsFound = vi.fn();
        const counter = new CssHitsCounter(onCssHitsFound, {
            pendingProbes: [{
                element: bait,
                target: document.body,
                previousSibling: null,
                nextSibling: null,
            }],
        });

        const flat = onCssHitsFound.mock.calls.flatMap((c) => c[0]);
        expect(flat).toContainEqual(expect.objectContaining({ filterId: 17, ruleIndex: 17 }));
        expect(bait.parentNode).toBeNull();

        counter.stop();
        style.remove();
    });

    it('does not restore elements removed by ExtendedCss', () => {
        vi.useFakeTimers();

        try {
            const bait = document.createElement('div');
            const { collector, deliver } = createProbesCollector();
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, { pendingProbesCollector: collector });

            const appendChildSpy = vi.spyOn(document.body, 'appendChild');
            const insertBeforeSpy = vi.spyOn(document.body, 'insertBefore');

            // ExtendedCss reports the hit and removes the element itself.
            counter.countAffectedByExtendedCss({
                node: bait,
                rules: [{ style: { remove: 'true' } }],
            });

            deliver([{
                element: bait,
                target: document.body,
                previousSibling: null,
                nextSibling: null,
            }]);

            vi.advanceTimersByTime(1000);

            // The probe must never be restored.
            expect(appendChildSpy).not.toHaveBeenCalled();
            expect(insertBeforeSpy).not.toHaveBeenCalled();
            expect(bait.parentNode).toBeNull();

            appendChildSpy.mockRestore();
            insertBeforeSpy.mockRestore();
            counter.stop();
        } finally {
            vi.useRealTimers();
        }
    });

    it('processes pending probes in chunks', () => {
        vi.useFakeTimers();

        const style = document.createElement('style');
        style.textContent = [
            'div.chunk-bait',
            "{ display: none !important; --adguard-hit: 'adguard14%3B14' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        try {
            const onCssHitsFound = vi.fn();
            const probes = Array.from({ length: 30 }, () => {
                const element = document.createElement('div');
                element.className = 'chunk-bait';

                return {
                    element,
                    target: document.body,
                    previousSibling: null,
                    nextSibling: null,
                };
            });

            const counter = new CssHitsCounter(onCssHitsFound, { pendingProbes: probes });

            const getChunkHits = (): number => onCssHitsFound.mock.calls
                .flatMap((c) => c[0])
                .filter((stat: any) => stat.filterId === 14)
                .length;

            // Only the first chunk is counted in one task.
            expect(getChunkHits()).toBe(25);

            vi.advanceTimersByTime(5);

            expect(getChunkHits()).toBe(30);

            counter.stop();
        } finally {
            vi.useRealTimers();
            style.remove();
        }
    });

    it('does not re-insert an element already counted by the mutation observer', () => {
        vi.useFakeTimers();
        const restoreMutationObserver = mockMutationObserver();

        const style = document.createElement('style');
        style.textContent = [
            'div.counted-bait',
            "{ display: none !important; --adguard-hit: 'adguard15%3B15' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        try {
            const { collector, deliver } = createProbesCollector();
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, { pendingProbesCollector: collector });
            const bait = document.createElement('div');
            bait.className = 'counted-bait';

            const appendChildSpy = vi.spyOn(document.body, 'appendChild');

            MutationObserverMock.last!.trigger([{
                addedNodes: [bait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            // The mutation observer re-inserted the probe once and counted it.
            expect(appendChildSpy).toHaveBeenCalledTimes(1);
            expect(bait.parentNode).toBeNull();

            // The collector reports the same element later: it must not be
            // inserted again.
            deliver([{
                element: bait,
                target: document.body,
                previousSibling: null,
                nextSibling: null,
            }]);

            vi.advanceTimersByTime(1000);

            expect(appendChildSpy).toHaveBeenCalledTimes(1);

            appendChildSpy.mockRestore();
            counter.stop();
        } finally {
            style.remove();
            restoreMutationObserver();
            vi.useRealTimers();
        }
    });

    it('still retries a probe that the mutation observer could not count', () => {
        vi.useFakeTimers();
        const restoreMutationObserver = mockMutationObserver();
        const restoreFixtureMarkers = removeFixtureMarkerElements();

        try {
            const { collector, deliver } = createProbesCollector();
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, { pendingProbesCollector: collector });
            const bait = document.createElement('div');
            bait.className = 'late-counted-bait';

            // The mutation observer re-inserts the probe, but the marker
            // styles are not applied yet, so nothing is counted for it.
            MutationObserverMock.last!.trigger([{
                addedNodes: [bait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            const getBaitHits = (): unknown[] => onCssHitsFound.mock.calls
                .flatMap((c) => c[0])
                .filter((stat: any) => stat.filterId === 16);
            expect(getBaitHits()).toHaveLength(0);

            // The collector reports the same element later: it must still be
            // retried, so the hit is not lost when the styles arrive.
            deliver([{
                element: bait,
                target: document.body,
                previousSibling: null,
                nextSibling: null,
            }]);

            // The first pending pass runs without the marker styles.
            vi.advanceTimersByTime(0);
            expect(getBaitHits()).toHaveLength(0);

            const style = document.createElement('style');
            style.textContent = [
                'div.late-counted-bait',
                "{ display: none !important; --adguard-hit: 'adguard16%3B16' !important; }",
            ].join(' ');
            document.head.appendChild(style);

            vi.advanceTimersByTime(100);

            expect(getBaitHits()).toHaveLength(1);
            expect(bait.parentNode).toBeNull();

            counter.stop();
            style.remove();
        } finally {
            restoreFixtureMarkers();
            restoreMutationObserver();
            vi.useRealTimers();
        }
    });

    it('does not run the full scan while the document is loading', () => {
        vi.useFakeTimers();
        const restoreMutationObserver = mockMutationObserver();
        let readyState = 'loading';
        Object.defineProperty(document, 'readyState', {
            configurable: true,
            get: () => readyState,
        });

        try {
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound);

            MutationObserverMock.last!.trigger([{
                addedNodes: [],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            // The debounced full scan must be skipped while loading.
            vi.advanceTimersByTime(1000);
            expect(onCssHitsFound).not.toHaveBeenCalled();

            readyState = 'interactive';
            document.dispatchEvent(new Event('readystatechange'));

            expect(onCssHitsFound).toHaveBeenCalled();

            counter.stop();
        } finally {
            delete (document as unknown as { readyState?: string }).readyState;
            restoreMutationObserver();
            vi.useRealTimers();
        }
    });
});
