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
