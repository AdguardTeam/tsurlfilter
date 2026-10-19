/**
 * @vitest-environment jsdom
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CosmeticResult } from '@adguard/tsurlfilter';

import * as SendMessageModule from '../../../../src/lib/common/content-script/send-app-message';
import { type ContentScriptCosmeticData } from '../../../../src/lib/common/cosmetic-api';
import { MessageType } from '../../../../src/lib/common/message-constants';
import { CosmeticApi } from '../../../../src/lib/mv2/background/cosmetic-api';
import { CosmeticController } from '../../../../src/lib/mv2/content-script/cosmetic-controller';
import { mockMutationObserver, MutationObserverMock } from '../../../helpers/mutation-observer';
import { createCosmeticRule } from '../../../helpers/rule-creator';

vi.mock('../../../../src/lib/common/content-script/send-app-message', () => {
    const module = vi.importActual('../../../../src/lib/common/content-script/send-app-message');
    return module;
});

/**
 * Creates cosmetic result for elemhide rules.
 *
 * @param rules Element hiding rules.
 *
 * @returns Element hiding rules cosmetic result.
 */
const getElemhideCosmeticResult = (rules: string[]): CosmeticResult => {
    const cosmeticResult = new CosmeticResult();
    rules.forEach((rule) => {
        cosmeticResult.elementHiding.append(createCosmeticRule(rule, 0));
    });
    return cosmeticResult;
};

/**
 * Returns cosmetic data based on `rules`.
 *
 * @param rules Element hiding rules.
 * @param areHitsStatsCollected Flag for hits counter.
 *
 * @returns Cosmetic data object.
 */
const getCosmeticData = (rules: string[], areHitsStatsCollected: boolean): ContentScriptCosmeticData => {
    const cosmeticResult = getElemhideCosmeticResult(rules);
    const extCssRules = CosmeticApi.getExtCssRules(
        cosmeticResult,
        {
            areHitsStatsCollected,
        },
    );
    return {
        isAppStarted: true,
        areHitsStatsCollected,
        extCssRules,
        nativeCssSelectors: null,
    };
};

describe('invalid native CSS selectors are handled gracefully', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="target" class="ad_banner" style="display: block">ad content</div>
            <div id="valid-target" class="ad_popup" style="display: block">popup content</div>
        `;

        global.CSS = {
            supports: vi.fn((condition: string) => {
                const match = condition.match(/^selector\((.+)\)$/);
                if (!match) {
                    return false;
                }
                const selector = match[1];
                // Known invalid patterns
                if (selector.includes('#.') || selector.includes('.#')) {
                    return false;
                }
                return true;
            }),
        } as unknown as typeof CSS;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.head.querySelectorAll('style').forEach((el) => el.remove());
        // @ts-ignore Clean up global mock
        delete global.CSS;
    });

    it('applies valid selectors and skips invalid ones without error', async () => {
        const validSelectors = ['.ad_banner', '.ad_popup'];
        const invalidSelector = '#.broken';

        const cosmeticData: ContentScriptCosmeticData = {
            isAppStarted: true,
            areHitsStatsCollected: false,
            extCssRules: null,
            nativeCssSelectors: [...validSelectors, invalidSelector],
        };

        vi.spyOn(SendMessageModule, 'sendAppMessage').mockResolvedValue(cosmeticData);

        const cosmeticController = new CosmeticController();
        cosmeticController.init();

        // Wait for the cosmetic controller to process
        await new Promise((resolve) => {
            setTimeout(resolve, 20);
        });

        const styleElements = document.head.querySelectorAll('style');
        const injectedStyles = Array.from(styleElements)
            .map((el) => el.textContent)
            .join('\n');

        for (const selector of validSelectors) {
            expect(injectedStyles).toContain(selector);
        }

        expect(injectedStyles).not.toContain(invalidSelector);
    });
});

describe('some extended css rules are invalid', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="headerOff" class="ad_header" style="display: block">test text</div>
            <div id="bannerOff" style="display: block"></div>

            <div id="headerOn" class="ad_header" style="display: block">test text</div>
            <div id="bannerOn" style="display: block"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('no hits counter', async () => {
        const rules = [
            '#?##bannerOff:remove()',
            '#?#.ad_header:contains(text)',
        ];

        // Mocking the sendAppMessage function
        vi.spyOn(SendMessageModule, 'sendAppMessage').mockResolvedValue(getCosmeticData(rules, false));

        const cosmeticController = new CosmeticController();
        cosmeticController.init();

        expect(cosmeticController).toBeDefined();

        // Wait for the cosmetic controller to process (using a delay)
        await new Promise((resolve) => {
            setTimeout(resolve, 20);
        });

        const headerElement = document.getElementById('headerOff');
        if (!headerElement) {
            throw new Error('#headerOff element is required');
        }

        const headerDisplayStyleValue = headerElement.style.getPropertyValue('display');
        expect(headerDisplayStyleValue).toEqual('none');
    });

    it('hits counter enabled', async () => {
        const rules = [
            '#?##bannerOn:remove()',
            '#?#.ad_header:contains(text)',
        ];

        // Mocking the sendAppMessage function
        vi.spyOn(SendMessageModule, 'sendAppMessage').mockResolvedValue(getCosmeticData(rules, true));

        const cosmeticController = new CosmeticController();
        cosmeticController.init();

        expect(cosmeticController).toBeDefined();

        // Wait for the cosmetic controller to process (using a delay)
        await new Promise((resolve) => {
            setTimeout(resolve, 20);
        });

        const headerElement = document.getElementById('headerOn');
        if (!headerElement) {
            throw new Error('#headerOn element is required');
        }

        const headerDisplayStyleValue = headerElement.style.getPropertyValue('display');
        expect(headerDisplayStyleValue).toEqual('none');
    });
});

describe('short-lived probes', () => {
    it('starts collecting probes before the cosmetic data request and reports them', async () => {
        const restoreMutationObserver = mockMutationObserver();

        const style = document.createElement('style');
        style.textContent = [
            "@property --adguard-hit { syntax: '*'; inherits: false; initial-value: ''; }",
            "div.loading-bait { display: none !important; --adguard-hit: 'adguard0%3B42' !important; }",
        ].join('\n');
        document.head.appendChild(style);

        try {
            const cosmeticData: ContentScriptCosmeticData = {
                isAppStarted: true,
                areHitsStatsCollected: true,
                extCssRules: [],
                nativeCssSelectors: null,
            };

            const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockResolvedValue(cosmeticData);

            const cosmeticController = new CosmeticController();
            cosmeticController.init();

            // The collector must observe the DOM before the response is
            // processed, so the observer is already created at this point.
            const collectorObserver = MutationObserverMock.last!;

            const bait = document.createElement('div');
            bait.className = 'loading-bait';
            collectorObserver.trigger([{
                addedNodes: [bait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            // Wait for the cosmetic controller to process the response.
            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            const stats = sendAppMessageSpy.mock.calls
                .map(([message]) => message)
                .filter((message) => message.type === MessageType.SaveCssHitsStats)
                .flatMap((message) => message.payload as Array<{ filterId: number; ruleIndex: number }>);

            expect(stats).toContainEqual(expect.objectContaining({ filterId: 0, ruleIndex: 42 }));
            expect(bait.parentNode).toBeNull();
        } finally {
            style.remove();
            restoreMutationObserver();
        }
    });

    it('stops the collector when the background does not respond', async () => {
        const restoreMutationObserver = mockMutationObserver();

        try {
            vi.spyOn(SendMessageModule, 'sendAppMessage').mockResolvedValue(null);

            const cosmeticController = new CosmeticController();
            cosmeticController.init();

            const collectorObserver = MutationObserverMock.last!;

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            expect(collectorObserver.isDisconnected).toBe(true);
        } finally {
            restoreMutationObserver();
        }
    });

    it('stops the collector when hits stats are not collected', async () => {
        const restoreMutationObserver = mockMutationObserver();

        try {
            vi.spyOn(SendMessageModule, 'sendAppMessage').mockResolvedValue({
                isAppStarted: true,
                areHitsStatsCollected: false,
                extCssRules: [],
                nativeCssSelectors: null,
            });

            const cosmeticController = new CosmeticController();
            cosmeticController.init();

            const collectorObserver = MutationObserverMock.last!;

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            expect(collectorObserver.isDisconnected).toBe(true);
        } finally {
            restoreMutationObserver();
        }
    });
});
