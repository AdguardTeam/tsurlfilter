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

const TEST_DOCUMENT_BODY_HTML = `
    <p>test</p>
    <div id="testDiv">
        <div id="childDiv"></div>
        <div id="hiddenDiv1" style="display: none; --adguard-hit:'adguard1%3B1';"></div>
        <div id="hiddenDiv2" style="display: none !important; --adguard-hit:'adguard2%3B2' !important;"></div>
    </div>
`;

type TriggerableMutationObserver = MutationObserver & {
    /**
     * Runs the stored MutationObserver callback with test records.
     */
    trigger: (mutations: MutationRecord[]) => void;
};

type CssHitsCounterPrivateStaticForTest = {
    /**
     * Runtime-accessible private queue cap.
     */
    MAX_PENDING_MUTATION_ROOTS: number;
};

/**
 * Temporarily changes pending mutation root cap for focused overflow tests.
 *
 * @param maxPendingMutationRoots New cap value.
 *
 * @returns Restore callback.
 */
const setMaxPendingMutationRoots = (maxPendingMutationRoots: number): (() => void) => {
    const cssHitsCounterConstructor = CssHitsCounter as unknown as CssHitsCounterPrivateStaticForTest;
    const originalMaxPendingMutationRoots = cssHitsCounterConstructor.MAX_PENDING_MUTATION_ROOTS;

    cssHitsCounterConstructor.MAX_PENDING_MUTATION_ROOTS = maxPendingMutationRoots;

    return (): void => {
        cssHitsCounterConstructor.MAX_PENDING_MUTATION_ROOTS = originalMaxPendingMutationRoots;
    };
};

/**
 * Installs a controllable MutationObserver implementation for tests where
 * jsdom's native observer timing is not precise enough.
 *
 * @returns Getter for the observer instance created by CssHitsCounter.
 */
const installMutationObserverMock = (): (() => TriggerableMutationObserver) => {
    const originalMutationObserver = window.MutationObserver;
    let mutationObserverRef: TriggerableMutationObserver | null = null;

    /**
     * Mock mutation observer class.
     * In case original class doesn't work properly in vitest jsdom environment.
     */
    window.MutationObserver = class {
        private callback: MutationCallback;

        /**
         * Mock constructor.
         *
         * @param callback Mutation callback.
         */
        constructor(callback: MutationCallback) {
            this.callback = callback;

            mutationObserverRef = this as unknown as TriggerableMutationObserver;
        }

        /**
         * Disconnect mock.
         */
        // eslint-disable-next-line class-methods-use-this
        disconnect(): void {
            // do nothing;
        }

        /**
         * Observe mock.
         */
        // eslint-disable-next-line class-methods-use-this
        observe(): void {
            // do nothing;
        }

        /**
         * Take records mock.
         *
         * @returns Empty array.
         */
        // eslint-disable-next-line class-methods-use-this
        takeRecords(): MutationRecord[] {
            // do nothing;
            return [];
        }

        /**
         * Mock trigger mutations.
         *
         * @param mutations Mutations to trigger.
         */
        public trigger(mutations: MutationRecord[]): void {
            this.callback(mutations, this as unknown as MutationObserver);
        }
    } as typeof MutationObserver;

    return (): TriggerableMutationObserver => {
        // Restore the real MutationObserver as soon as it's consumed. By this
        // point CssHitsCounter has already been constructed and captured the
        // mock class reference, so restoring here does not affect it, but it
        // prevents this test's mock from leaking into later tests that run in
        // the same suite (AG-265 test isolation).
        window.MutationObserver = originalMutationObserver;

        if (!mutationObserverRef) {
            throw new Error('MutationObserver was not created');
        }

        return mutationObserverRef;
    };
};

/**
 * Overrides document.readyState for constructor timing tests.
 *
 * @param readyState Ready state to expose.
 *
 * @returns Restore callback.
 */
const setDocumentReadyState = (readyState: DocumentReadyState): (() => void) => {
    const originalOwnDescriptor = Object.getOwnPropertyDescriptor(document, 'readyState');

    Object.defineProperty(document, 'readyState', {
        configurable: true,
        get: () => readyState,
    });

    return (): void => {
        if (originalOwnDescriptor) {
            Object.defineProperty(document, 'readyState', originalOwnDescriptor);
            return;
        }

        delete (document as unknown as { readyState?: DocumentReadyState }).readyState;
    };
};

describe('CssHitsCounter', () => {
    // Mock document
    document.body.innerHTML = TEST_DOCUMENT_BODY_HTML;

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

    it('does not publish stale full-scan batch results after stop', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '';

        for (let i = 0; i < 60; i += 1) {
            const element = document.createElement('div');
            if (i === 59) {
                element.setAttribute('style', 'display: none !important; --adguard-hit:\'adguard17%3B17\' !important;');
            }
            document.body.appendChild(element);
        }

        const onCssHitsFound = vi.fn();
        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        cssHitsCounter.stop();
        vi.advanceTimersByTime(1000);

        expect(onCssHitsFound).not.toHaveBeenCalled();

        vi.useRealTimers();
    });

    it('suppresses full-scan fallback during the mutation cooldown window', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div style="display: none !important; '
            + '--adguard-hit:\'adguard18%3B18\' !important;"></div>';

        const getMutationObserver = installMutationObserverMock();
        const onCssHitsFound = vi.fn();
        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        expect(onCssHitsFound).toHaveBeenCalledTimes(1);

        const lateFullScanElement = document.createElement('div');
        lateFullScanElement.setAttribute(
            'style',
            'display: none !important; --adguard-hit:\'adguard19%3B19\' !important;',
        );
        document.body.appendChild(lateFullScanElement);

        getMutationObserver().trigger([{
            addedNodes: [],
            type: 'attributes',
            target: document.body,
            attributeName: 'class',
        } as unknown as MutationRecord]);

        vi.advanceTimersByTime(4900);

        expect(onCssHitsFound).toHaveBeenCalledTimes(1);

        getMutationObserver().trigger([{
            addedNodes: [],
            type: 'attributes',
            target: document.body,
            attributeName: 'class',
        } as unknown as MutationRecord]);

        vi.advanceTimersByTime(99);

        expect(onCssHitsFound).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1);

        expect(onCssHitsFound).toHaveBeenCalledTimes(2);
        expect(onCssHitsFound).toHaveBeenLastCalledWith([expect.objectContaining({
            filterId: 19,
            ruleIndex: 19,
        })]);

        cssHitsCounter.stop();
        vi.useRealTimers();
    });

    it('checks counting with mutations', () => {
        vi.useFakeTimers();

        const onCssHitsFound = vi.fn((stats: any): void => {
            expect(stats).not.toBeNull();
        });

        const getMutationObserver = installMutationObserverMock();

        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const template = document.createElement('div');
        // eslint-disable-next-line max-len
        template.innerHTML = '<div id="mutationDiv" style="display: none !important; --adguard-hit:\'adguard3%3B3\';"></div>';

        const mutationRecord = {
            addedNodes: [template],
            type: 'childList',
            attributeName: 'style',
            target: document.body,
        };
        getMutationObserver().trigger([mutationRecord as unknown as MutationRecord]);

        // The observer callback is queued; advance the clock to flush pending roots.
        vi.advanceTimersByTime(200);

        expect(onCssHitsFound).toHaveBeenCalledTimes(2);
        expect(onCssHitsFound).toHaveBeenLastCalledWith([{
            filterId: 3,
            ruleIndex: 3,
            element: '<div id="mutationDiv" style="display: none !important; --adguard-hit:\'adguard3%3B3\';">',
        }]);

        cssHitsCounter.stop();
        vi.useRealTimers();
    });

    it('counts mutation subtrees that are larger than one css hit batch', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '';

        const getMutationObserver = installMutationObserverMock();
        const onCssHitsFound = vi.fn();
        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const mutationRoot = document.createElement('div');
        for (let i = 0; i < 30; i += 1) {
            const child = document.createElement('div');
            child.setAttribute('id', `largeMutationDiv${i}`);
            child.setAttribute('style', `display: none !important; --adguard-hit:'adguard7%3B${i}' !important;`);
            mutationRoot.appendChild(child);
        }

        const mutationRecord = {
            addedNodes: [mutationRoot],
            type: 'childList',
            target: document.body,
        };

        getMutationObserver().trigger([mutationRecord as unknown as MutationRecord]);

        vi.advanceTimersByTime(1000);

        expect(onCssHitsFound).toHaveBeenCalledTimes(1);

        const [stats] = onCssHitsFound.mock.lastCall!;
        expect(stats).toHaveLength(30);
        expect(stats[0]).toMatchObject({
            filterId: 7,
            ruleIndex: 0,
        });
        expect(stats[29]).toMatchObject({
            filterId: 7,
            ruleIndex: 29,
        });

        cssHitsCounter.stop();
        vi.useRealTimers();
    });

    it('observes mutation roots before the document becomes interactive', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '';

        const restoreReadyState = setDocumentReadyState('loading');
        const getMutationObserver = installMutationObserverMock();
        const onCssHitsFound = vi.fn();
        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const mutationRoot = document.createElement('div');
        mutationRoot.setAttribute('id', 'loadingMutationDiv');
        mutationRoot.setAttribute('style', 'display: none !important; --adguard-hit:\'adguard6%3B6\' !important;');
        document.body.appendChild(mutationRoot);

        const mutationRecord = {
            addedNodes: [mutationRoot],
            type: 'childList',
            target: document.body,
        };

        getMutationObserver().trigger([mutationRecord as unknown as MutationRecord]);

        vi.advanceTimersByTime(1000);

        expect(onCssHitsFound).toHaveBeenCalledTimes(1);
        expect(onCssHitsFound).toHaveBeenLastCalledWith([expect.objectContaining({
            filterId: 6,
            ruleIndex: 6,
            element: '<div id="loadingMutationDiv" '
                + 'style="display: none !important; --adguard-hit:\'adguard6%3B6\' !important;">',
        })]);

        cssHitsCounter.stop();
        restoreReadyState();
        vi.useRealTimers();
    });

    it('counts a mutation root that is removed before queued mutation processing', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '';

        const getMutationObserver = installMutationObserverMock();
        const onCssHitsFound = vi.fn();
        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const mutationRoot = document.createElement('div');
        mutationRoot.setAttribute('id', 'fastRemovedMutationDiv');
        mutationRoot.setAttribute('style', 'display: none !important; --adguard-hit:\'adguard8%3B8\' !important;');
        document.body.appendChild(mutationRoot);

        const mutationRecord = {
            addedNodes: [mutationRoot],
            type: 'childList',
            target: document.body,
        };

        getMutationObserver().trigger([mutationRecord as unknown as MutationRecord]);
        mutationRoot.remove();

        vi.advanceTimersByTime(1000);

        expect(onCssHitsFound).toHaveBeenCalledTimes(1);
        expect(onCssHitsFound).toHaveBeenLastCalledWith([expect.objectContaining({
            filterId: 8,
            ruleIndex: 8,
            element: '<div id="fastRemovedMutationDiv" '
                + 'style="display: none !important; --adguard-hit:\'adguard8%3B8\' !important;">',
        })]);
        expect(document.getElementById('fastRemovedMutationDiv')).toBeNull();

        cssHitsCounter.stop();
        vi.useRealTimers();
    });

    it('retries captured mutation roots while waiting for css hit marker to appear', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '';

        const getMutationObserver = installMutationObserverMock();
        const onCssHitsFound = vi.fn();
        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const mutationRoot = document.createElement('div');
        mutationRoot.setAttribute('id', 'delayedMarkerMutationDiv');
        document.body.appendChild(mutationRoot);

        const mutationRecord = {
            addedNodes: [mutationRoot],
            type: 'childList',
            target: document.body,
        };

        getMutationObserver().trigger([mutationRecord as unknown as MutationRecord]);

        window.setTimeout(() => {
            mutationRoot.setAttribute('style', 'display: none !important; --adguard-hit:\'adguard9%3B9\' !important;');
        }, 250);

        vi.advanceTimersByTime(200);
        expect(onCssHitsFound).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);

        expect(onCssHitsFound).toHaveBeenCalledTimes(1);
        expect(onCssHitsFound).toHaveBeenLastCalledWith([expect.objectContaining({
            filterId: 9,
            ruleIndex: 9,
            element: '<div id="delayedMarkerMutationDiv" '
                + 'style="display: none !important; --adguard-hit:\'adguard9%3B9\' !important;">',
        })]);

        cssHitsCounter.stop();
        vi.useRealTimers();
    });

    it('falls back to a full scan when pending mutation roots exceed the queue cap', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '';

        const restoreMaxPendingMutationRoots = setMaxPendingMutationRoots(1);
        const getMutationObserver = installMutationObserverMock();
        const onCssHitsFound = vi.fn();
        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const queuedRoot = document.createElement('div');
        queuedRoot.setAttribute('id', 'queuedMutationDiv');
        queuedRoot.setAttribute('style', 'display: none !important; --adguard-hit:\'adguard10%3B10\' !important;');

        const overflowRoot = document.createElement('div');
        overflowRoot.setAttribute('id', 'overflowMutationDiv');
        overflowRoot.setAttribute('style', 'display: none !important; --adguard-hit:\'adguard11%3B11\' !important;');

        document.body.append(queuedRoot, overflowRoot);

        const mutationRecord = {
            addedNodes: [queuedRoot, overflowRoot],
            type: 'childList',
            target: document.body,
        };

        getMutationObserver().trigger([mutationRecord as unknown as MutationRecord]);

        vi.advanceTimersByTime(200);

        expect(onCssHitsFound).toHaveBeenCalledTimes(1);
        expect(onCssHitsFound).toHaveBeenLastCalledWith([expect.objectContaining({
            filterId: 10,
            ruleIndex: 10,
        })]);

        vi.advanceTimersByTime(6000);

        expect(onCssHitsFound).toHaveBeenCalledTimes(2);
        expect(onCssHitsFound).toHaveBeenLastCalledWith([expect.objectContaining({
            filterId: 11,
            ruleIndex: 11,
        })]);

        cssHitsCounter.stop();
        restoreMaxPendingMutationRoots();
        vi.useRealTimers();
    });

    it('removes restored probe roots when stopped during mutation retry window', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '';

        const getMutationObserver = installMutationObserverMock();
        const onCssHitsFound = vi.fn();
        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const mutationRoot = document.createElement('div');
        mutationRoot.setAttribute('id', 'stopCleanupProbeDiv');
        mutationRoot.setAttribute('style', 'display: none !important; --adguard-hit:\'adguard12%3B12\' !important;');
        document.body.appendChild(mutationRoot);

        const mutationRecord = {
            addedNodes: [mutationRoot],
            type: 'childList',
            target: document.body,
        };

        getMutationObserver().trigger([mutationRecord as unknown as MutationRecord]);
        mutationRoot.remove();

        vi.advanceTimersByTime(100);

        expect(document.getElementById('stopCleanupProbeDiv')).not.toBeNull();

        cssHitsCounter.stop();

        expect(document.getElementById('stopCleanupProbeDiv')).toBeNull();

        vi.useRealTimers();
    });

    it('does not let duplicate mutation roots consume queue capacity', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '';

        const restoreMaxPendingMutationRoots = setMaxPendingMutationRoots(2);
        const getMutationObserver = installMutationObserverMock();
        const onCssHitsFound = vi.fn();
        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const duplicateRoot = document.createElement('div');
        duplicateRoot.setAttribute('id', 'duplicateMutationDiv');
        duplicateRoot.setAttribute('style', 'display: none !important; --adguard-hit:\'adguard13%3B13\' !important;');

        const uniqueRoot = document.createElement('div');
        uniqueRoot.setAttribute('id', 'uniqueMutationDiv');
        uniqueRoot.setAttribute('style', 'display: none !important; --adguard-hit:\'adguard14%3B14\' !important;');

        document.body.append(duplicateRoot, uniqueRoot);

        getMutationObserver().trigger([
            {
                addedNodes: [duplicateRoot],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord,
            {
                addedNodes: [duplicateRoot],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord,
            {
                addedNodes: [uniqueRoot],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord,
        ]);

        duplicateRoot.remove();
        uniqueRoot.remove();

        vi.advanceTimersByTime(1000);

        const countedRules = onCssHitsFound.mock.calls
            .flatMap(([stats]) => stats)
            .map(({ filterId, ruleIndex }) => `${filterId};${ruleIndex}`);

        expect(countedRules).toContain('13;13');
        expect(countedRules).toContain('14;14');

        cssHitsCounter.stop();
        restoreMaxPendingMutationRoots();
        vi.useRealTimers();
    });

    it('restores detached probes under documentElement when original target is detached', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '';

        const getMutationObserver = installMutationObserverMock();
        const onCssHitsFound = vi.fn();
        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const detachedTarget = document.createElement('section');
        const mutationRoot = document.createElement('div');
        mutationRoot.setAttribute('id', 'detachedTargetProbeDiv');
        mutationRoot.setAttribute('style', 'display: none !important; --adguard-hit:\'adguard15%3B15\' !important;');
        detachedTarget.appendChild(mutationRoot);

        const mutationRecord = {
            addedNodes: [mutationRoot],
            type: 'childList',
            target: detachedTarget,
        };

        getMutationObserver().trigger([mutationRecord as unknown as MutationRecord]);
        mutationRoot.remove();

        vi.advanceTimersByTime(1000);

        expect(onCssHitsFound).toHaveBeenCalledTimes(1);
        expect(onCssHitsFound).toHaveBeenLastCalledWith([expect.objectContaining({
            filterId: 15,
            ruleIndex: 15,
        })]);
        expect(document.getElementById('detachedTargetProbeDiv')).toBeNull();

        cssHitsCounter.stop();
        vi.useRealTimers();
    });

    it('skips already counted mutation elements during retry attempts', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '';

        // Keep constructor's initial full-DOM scan from calling getComputedStyle
        // so spies below only capture the mutation retry path.
        const restoreReadyState = setDocumentReadyState('loading');
        const getComputedStyleSpy = vi.spyOn(globalThis, 'getComputedStyle');
        const querySelectorAllSpy = vi.spyOn(Element.prototype, 'querySelectorAll');
        const getMutationObserver = installMutationObserverMock();
        const onCssHitsFound = vi.fn();
        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const mutationRoot = document.createElement('div');
        mutationRoot.setAttribute('id', 'countedOnceMutationDiv');
        mutationRoot.setAttribute('style', 'display: none !important; --adguard-hit:\'adguard16%3B16\' !important;');
        document.body.appendChild(mutationRoot);

        const mutationRecord = {
            addedNodes: [mutationRoot],
            type: 'childList',
            target: document.body,
        };

        getMutationObserver().trigger([mutationRecord as unknown as MutationRecord]);

        vi.advanceTimersByTime(450);

        expect(onCssHitsFound).toHaveBeenCalledTimes(1);
        expect(getComputedStyleSpy).toHaveBeenCalledTimes(1);
        expect(querySelectorAllSpy).toHaveBeenCalledTimes(1);

        cssHitsCounter.stop();
        querySelectorAllSpy.mockRestore();
        getComputedStyleSpy.mockRestore();
        restoreReadyState();
        vi.useRealTimers();
    });

    it('checks if countAffectedByExtendedCss is ok', () => {
        document.body.innerHTML = TEST_DOCUMENT_BODY_HTML;

        const onCssHitsFound = vi.fn((stats: any): void => {
            expect(stats).not.toBeNull();
        });

        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const targetDiv = document.createElement('div');
        targetDiv.id = 'extCssTarget';
        document.body.appendChild(targetDiv);

        // ExtendedCss path uses the legacy `content:` marker carried in
        // the parsed rule object. The reader blanks it after parsing so
        // the marker text never reaches the DOM.
        const rule = { style: { content: "'adguard4%3B4'" } };
        cssHitsCounter.countAffectedByExtendedCss({
            rules: [rule],
            node: targetDiv,
        });

        expect(onCssHitsFound).toHaveBeenLastCalledWith([{
            filterId: 4,
            ruleIndex: 4,
            element: '<div id="extCssTarget">',
        }]);
        // The reader is expected to clear the marker so it cannot be
        // painted on rules that don't also hide the element.
        expect(rule.style.content).toBe('');

        cssHitsCounter.stop();
        targetDiv.remove();
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
});
