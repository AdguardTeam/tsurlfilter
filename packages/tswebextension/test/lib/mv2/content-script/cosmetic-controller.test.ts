/**
 * @vitest-environment jsdom
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    type MockInstance,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

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

describe('uBO action pseudo-classes are applied by the content script', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <a id="link" href="https://example.org/" onclick="void 0" class="ads ad-1 other">link</a>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('remove-attr and remove-class are applied, styles of action rules are ignored', async () => {
        const rules = [
            'example.org##a:remove-attr(href)',
            'example.org##a:remove-attr(/^on[a-z]+$/)',
            'example.org##a:remove-class(ads)',
            'example.org##a:remove-class(/^ad-[0-9]+$/)',
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

        const linkElement = document.getElementById('link');
        if (!linkElement) {
            throw new Error('#link element is required');
        }

        expect(linkElement.hasAttribute('href')).toBe(false);
        expect(linkElement.hasAttribute('onclick')).toBe(false);
        expect(linkElement.classList.contains('ads')).toBe(false);
        expect(linkElement.classList.contains('ad-1')).toBe(false);
        // Unrelated classes and the element itself are kept
        expect(linkElement.classList.contains('other')).toBe(true);
        expect(linkElement.style.getPropertyValue('display')).toEqual('');
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

describe('collect hit stats changes', () => {
    afterEach(() => {
        // Remove listeners registered by controllers created in this file.
        // eslint-disable-next-line no-underscore-dangle
        (browser.runtime.onMessage as unknown as { _listeners: unknown[] })._listeners = [];
    });

    /**
     * Returns stats with the given filter id from `SaveCssHitsStats` messages.
     *
     * @param sendAppMessageSpy Spy on `sendAppMessage`.
     * @param filterId Filter id to select.
     *
     * @returns Collected stats.
     */
    const getBaitStats = (
        sendAppMessageSpy: MockInstance,
        filterId: number,
    ): Array<{ filterId: number; ruleIndex: number }> => {
        return sendAppMessageSpy.mock.calls
            .map(([message]) => message as { type: MessageType; payload: unknown })
            .filter((message) => message.type === MessageType.SaveCssHitsStats)
            .flatMap((message) => message.payload as Array<{ filterId: number; ruleIndex: number }>)
            .filter((stat) => stat.filterId === filterId);
    };

    /**
     * Triggers a runtime message as the background would.
     *
     * @param message Message to trigger.
     */
    const triggerRuntimeMessage = (message: unknown): void => {
        (browser.runtime.onMessage as unknown as {
            trigger: (value: unknown) => void;
        }).trigger(message);
    };

    it('pauses and resumes the counter on messages', async () => {
        const restoreMutationObserver = mockMutationObserver();

        const style = document.createElement('style');
        style.textContent = [
            'div.controller-pause-bait',
            "{ display: none !important; --adguard-hit: 'adguard33%3B33' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        try {
            const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockResolvedValue({
                    isAppStarted: true,
                    areHitsStatsCollected: true,
                    extCssRules: [],
                    nativeCssSelectors: null,
                });

            const cosmeticController = new CosmeticController();
            cosmeticController.init();

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: false },
            });

            const pausedBait = document.createElement('div');
            pausedBait.className = 'controller-pause-bait';
            MutationObserverMock.last!.trigger([{
                addedNodes: [pausedBait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            expect(getBaitStats(sendAppMessageSpy, 33)).toHaveLength(0);

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            const resumedBait = document.createElement('div');
            resumedBait.className = 'controller-pause-bait';
            MutationObserverMock.last!.trigger([{
                addedNodes: [resumedBait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            expect(getBaitStats(sendAppMessageSpy, 33)).toHaveLength(1);
        } finally {
            style.remove();
            restoreMutationObserver();
        }
    });

    it('applies a message received before the counter is created', async () => {
        const restoreMutationObserver = mockMutationObserver();

        const style = document.createElement('style');
        style.textContent = [
            'div.controller-early-bait',
            "{ display: none !important; --adguard-hit: 'adguard34%3B34' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        let resolveCosmeticData!: (value: ContentScriptCosmeticData) => void;
        const cosmeticDataPromise = new Promise<ContentScriptCosmeticData>((resolve) => {
            resolveCosmeticData = resolve;
        });

        try {
            const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockReturnValue(cosmeticDataPromise);

            const cosmeticController = new CosmeticController();
            cosmeticController.init();

            const collectorObserver = MutationObserverMock.last!;

            const earlyBait = document.createElement('div');
            earlyBait.className = 'controller-early-bait';
            collectorObserver.trigger([{
                addedNodes: [earlyBait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: false },
            });

            // The collector must stop even before the counter is created, and
            // its pending probes must not be reported by the counter.
            expect(collectorObserver.isDisconnected).toBe(true);

            resolveCosmeticData({
                isAppStarted: true,
                areHitsStatsCollected: true,
                extCssRules: [],
                nativeCssSelectors: null,
            });

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            expect(getBaitStats(sendAppMessageSpy, 34)).toHaveLength(0);

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            const resumedBait = document.createElement('div');
            resumedBait.className = 'controller-early-bait';
            MutationObserverMock.last!.trigger([{
                addedNodes: [resumedBait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            // Only the fresh bait is counted. The early bait was cleared when
            // the collector stopped.
            expect(getBaitStats(sendAppMessageSpy, 34)).toHaveLength(1);
        } finally {
            style.remove();
            restoreMutationObserver();
        }
    });

    it('creates the counter when collection is enabled after cosmetic data was applied', async () => {
        const restoreMutationObserver = mockMutationObserver();

        const style = document.createElement('style');
        style.textContent = [
            'div.controller-live-enable-bait',
            "{ display: none !important; --adguard-hit: 'adguard36%3B36' !important; }",
        ].join(' ');
        document.head.appendChild(style);

        try {
            const sendAppMessageSpy = vi.spyOn(SendMessageModule, 'sendAppMessage')
                .mockResolvedValue({
                    isAppStarted: true,
                    areHitsStatsCollected: false,
                    extCssRules: [],
                    nativeCssSelectors: null,
                });

            const cosmeticController = new CosmeticController();
            cosmeticController.init();

            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });

            triggerRuntimeMessage({
                handlerName: 'tsWebExtension',
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            });

            const bait = document.createElement('div');
            bait.className = 'controller-live-enable-bait';
            MutationObserverMock.last!.trigger([{
                addedNodes: [bait],
                removedNodes: [],
                type: 'childList',
                target: document.body,
            } as unknown as MutationRecord]);

            expect(getBaitStats(sendAppMessageSpy, 36)).toHaveLength(1);
        } finally {
            style.remove();
            restoreMutationObserver();
        }
    });
});
