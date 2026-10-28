/**
 * @vitest-environment jsdom
 */

import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import * as SendMessageModule from '../../../../src/lib/common/content-script/send-app-message';
import { type ContentScriptCosmeticData } from '../../../../src/lib/common/cosmetic-api';
import { MessageType } from '../../../../src/lib/common/message-constants';
import { CosmeticController } from '../../../../src/lib/mv3/content-script/cosmetic-controller';
import { mockMutationObserver, MutationObserverMock } from '../../../helpers/mutation-observer';

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
