/**
 * @jest-environment jsdom
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-len */

import { CssHitsCounter } from '@lib/mv2/content-script/css-hits-counter';

describe('CssHitsCounter', () => {
    // Mock document
    document.body.innerHTML = `
        <p>test</p>
        <div id="testDiv">
            <div id="childDiv"></div>
            <div id="hiddenDiv1" style="display: none; content:'adguard1;test-rule-one';"></div>
            <div id="hiddenDiv2" style="display: none !important; content:'adguard2;test-rule-two' !important;"></div>
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
        const onCssHitsFound = jest.fn((stats: any): void => {
            expect(stats).toHaveLength(2);

            expect(stats[0].filterId).toBe(1);
            expect(stats[0].ruleText).toBe('test-rule-one');
            expect(stats[0].element).toBe('<div id="hiddenDiv1" style="display: none; content:\'adguard1;test-rule-one\';">');

            expect(stats[1].filterId).toBe(2);
            expect(stats[1].ruleText).toBe('test-rule-two');
            expect(stats[1].element).toBe('<div id="hiddenDiv2" style="display: none !important; content:\'adguard2;test-rule-two\' !important;">');
        });

        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        expect(onCssHitsFound).toHaveBeenCalled();

        cssHitsCounter.stop();
    });

    it('checks counting with mutations', () => {
        const onCssHitsFound = jest.fn((stats: any): void => {
            expect(stats).not.toBeNull();
        });

        let mutationObserverRef: any;

        /**
         * Mock mutation observer class
         * In case original class doesn't work properly in jest jsdom environment
         */
        window.MutationObserver = class {
            private callback: MutationCallback;

            constructor(callback: MutationCallback) {
                this.callback = callback;

                // Keep the link to current instance
                // eslint-disable-next-line @typescript-eslint/no-this-alias
                mutationObserverRef = this;
            }

            // eslint-disable-next-line class-methods-use-this
            disconnect() {
                // do nothing;
            }

            // eslint-disable-next-line class-methods-use-this
            observe() {
                // do nothing;
            }

            // eslint-disable-next-line class-methods-use-this
            takeRecords(): MutationRecord[] {
                // do nothing;
                return [];
            }

            /**
             * Mock trigger mutations
             * @param mutations
             */
            public trigger(mutations: MutationRecord[]) {
                this.callback(mutations, this);
            }
        };

        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const template = document.createElement('div');
        template.innerHTML = '<div id="mutationDiv" style="display: none !important; content:\'adguard3;test-rule-three\';"></div>';

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
            ruleText: 'test-rule-three',
            element: '<div id="mutationDiv" style="display: none !important; content:\'adguard3;test-rule-three\';">',
        }]);

        cssHitsCounter.stop();
    });

    it('checks if countAffectedByExtendedCss is ok', () => {
        const onCssHitsFound = jest.fn((stats: any): void => {
            expect(stats).not.toBeNull();
        });

        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        const elementToCount = {
            rules: [{ style: { content: 'some' } }],
            node: document.getElementById('testDiv')!,
        };

        let affectedElement = cssHitsCounter.countAffectedByExtendedCss(elementToCount);
        expect(affectedElement).toBe(elementToCount);

        elementToCount.rules[0].style.content = 'adguard4;test-rule-ext-css';

        affectedElement = cssHitsCounter.countAffectedByExtendedCss(elementToCount);

        expect(affectedElement).toBe(elementToCount);

        expect(onCssHitsFound).toHaveBeenCalledTimes(3);
        expect(onCssHitsFound).toHaveBeenLastCalledWith([{
            filterId: 4,
            ruleText: 'test-rule-ext-css',
            element: '<div id="testDiv">',
        }]);

        cssHitsCounter.stop();
    });
});
