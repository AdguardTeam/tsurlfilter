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
import { PendingProbesCollector } from '../../../../src/lib/common/content-script/pending-probes-collector';
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

    it('retries pending probes until the marker is applied', () => {
        vi.useFakeTimers();

        const bait = document.createElement('div');
        bait.className = 'late-bait';

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
            vi.useRealTimers();
        }
    });

    it('gives probes delivered during a retry their own retry budget', () => {
        vi.useFakeTimers();

        // This probe never matches any rule and consumes its retry budget.
        const staleBait = document.createElement('div');
        staleBait.className = 'never-hidden';

        try {
            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound, {
                pendingProbes: [{
                    element: staleBait,
                    target: document.body,
                    previousSibling: null,
                    nextSibling: null,
                }],
            });

            // Spend four attempts of the stale probe's budget; a retry is
            // still armed.
            vi.advanceTimersByTime(300);

            // The late probe joins while the retry is armed, so it must not
            // share the stale probe's remaining attempts.
            const lateBait = document.createElement('div');
            lateBait.className = 'late-streamed-bait';
            counter.addPendingProbes([{
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

            const onCssHitsFound = vi.fn();
            const counter = new CssHitsCounter(onCssHitsFound);

            counter.addPendingProbes([{
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
});
