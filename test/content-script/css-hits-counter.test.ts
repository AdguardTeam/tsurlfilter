/**
 * @jest-environment jsdom
 */

/* eslint-disable max-len */

import MutationObserver from 'mutation-observer';
import CssHitsCounter from '../../src/content-script/css-hits-counter';

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
            console.log(stats);

            expect(stats).toHaveLength(2);

            expect(stats[0].filterId).toBe(1);
            expect(stats[0].ruleText).toBe('test-rule-one');
            expect(stats[0].element).toBe('<div id="hiddenDiv1" style="display: none; content:\'adguard1;test-rule-one\';">');

            expect(stats[1].filterId).toBe(2);
            expect(stats[1].ruleText).toBe('test-rule-two');
            expect(stats[1].element).toBe('<div id="hiddenDiv2" style="display: none !important; content:\'adguard2;test-rule-two\' !important;">');
        });

        window.MutationObserver = MutationObserver;

        const cssHitsCounter = new CssHitsCounter(onCssHitsFound);

        expect(onCssHitsFound).toHaveBeenCalled();

        // Do some mutations
        document.body.setAttribute('test-attr', 'test-attr-value');

        const template = document.createElement('div');
        template.innerHTML = '<div id="mutationDiv" style="display: none !important; content:\'adguard3;test-rule-three\';"></div>';
        document.body.appendChild(template);

        // TODO: Check mutations

        expect(onCssHitsFound).toHaveBeenCalled();

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
