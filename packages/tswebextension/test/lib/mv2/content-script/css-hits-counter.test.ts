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

        let mutationObserverRef: any;

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

                // Keep the link to current instance
                // eslint-disable-next-line @typescript-eslint/no-this-alias
                mutationObserverRef = this;
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
                this.callback(mutations, this);
            }
        };

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
        mutationObserverRef!.trigger([mutationRecord]);

        expect(onCssHitsFound).toHaveBeenCalledTimes(2);
        expect(onCssHitsFound).toHaveBeenLastCalledWith([{
            filterId: 3,
            ruleIndex: 3,
            element: '<div id="mutationDiv" style="display: none !important; --adguard-hit:\'adguard3%3B3\';">',
        }]);

        cssHitsCounter.stop();
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

    it('counts every element matched by the same ExtendedCSS rule', () => {
        const onCssHitsFound = vi.fn();
        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);
        // Drop the native hits of the fixture counted on construction.
        onCssHitsFound.mockClear();

        // One parsed rule object shared by every element it matches, as
        // ExtendedCss keeps it.
        const sharedRule = { style: { content: 'adguard7%3B7' } };
        const firstNode = document.createElement('div');
        firstNode.id = 'firstExtCss';
        const secondNode = document.createElement('div');
        secondNode.id = 'secondExtCss';
        document.body.append(firstNode, secondNode);

        const firstEl = { rules: [sharedRule], node: firstNode };
        cssHitsCounter.countAffectedByExtendedCss(firstEl);
        cssHitsCounter.countAffectedByExtendedCss({ rules: [sharedRule], node: secondNode });

        const reported = onCssHitsFound.mock.calls.flatMap(([batch]) => batch);
        expect(reported).toEqual([
            { filterId: 7, ruleIndex: 7, element: '<div id="firstExtCss">' },
            { filterId: 7, ruleIndex: 7, element: '<div id="secondExtCss">' },
        ]);
        // The marker is stripped from the copy applied to the element only, so
        // the shared rule keeps it for the remaining elements.
        expect(firstEl.rules[0].style.content).toBe('');
        expect(sharedRule.style.content).toBe('adguard7%3B7');

        // The same node and rule pair is reported once, even when ExtendedCss
        // re-matches the node later.
        cssHitsCounter.countAffectedByExtendedCss({ rules: [sharedRule], node: firstNode });
        expect(onCssHitsFound.mock.calls.flatMap(([batch]) => batch)).toEqual(reported);

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
});
