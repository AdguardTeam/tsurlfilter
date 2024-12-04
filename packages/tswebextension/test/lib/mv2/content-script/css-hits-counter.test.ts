/**
 * @vitest-environment jsdom
 */

import { CssHitsCounter } from '../../../../src/lib';

describe('CssHitsCounter', () => {
    // Mock document
    document.body.innerHTML = `
        <p>test</p>
        <div id="testDiv">
            <div id="childDiv"></div>
            <div id="hiddenDiv1" style="display: none; content:'adguard1;1';"></div>
            <div id="hiddenDiv2" style="display: none !important; content:'adguard2;2' !important;"></div>
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
                .toBe('<div id="hiddenDiv1" style="display: none; content:\'adguard1;1\';">');

            expect(stats[1].filterId).toBe(2);
            expect(stats[1].ruleIndex).toBe(2);
            // eslint-disable-next-line max-len
            expect(stats[1].element).toBe('<div id="hiddenDiv2" style="display: none !important; content:\'adguard2;2\' !important;">');
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
        template.innerHTML = '<div id="mutationDiv" style="display: none !important; content:\'adguard3;3\';"></div>';

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
            element: '<div id="mutationDiv" style="display: none !important; content:\'adguard3;3\';">',
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

        cssHitsCounter.stop();
    });
});
