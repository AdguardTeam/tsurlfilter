import browser from 'sinon-chrome';
import {
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { type NetworkRule } from '@adguard/tsurlfilter';

import { CollectHitStatsNotifier, isCollectStatsEnabledForDocument } from '../../../src/lib/common/collect-hit-stats';
import { MESSAGE_HANDLER_NAME, MessageType } from '../../../src/lib/common/message-constants';

describe('CollectHitStatsNotifier', () => {
    beforeEach(() => {
        browser.tabs.query.reset();
        browser.tabs.sendMessage.reset();
    });

    it('notifies every tab and ignores tabs without content scripts', async () => {
        browser.tabs.query.resolves([{ id: 1 }, { id: 2 }, {}]);
        browser.tabs.sendMessage.withArgs(1).resolves();
        browser.tabs.sendMessage.withArgs(2).rejects(new Error('no receiver'));

        await CollectHitStatsNotifier.notify(true);

        expect(browser.tabs.sendMessage.callCount).toBe(2);
        expect(browser.tabs.sendMessage.calledWith(1, {
            handlerName: MESSAGE_HANDLER_NAME,
            type: MessageType.SetCollectHitStats,
            payload: { isCollectStats: true },
        })).toBe(true);
    });

    it('does not throw when tabs cannot be queried', async () => {
        browser.tabs.query.rejects(new Error('no access'));

        await expect(CollectHitStatsNotifier.notify(false)).resolves.toBeUndefined();
    });

    it('uses the effective state resolver for each tab', async () => {
        browser.tabs.query.resolves([{ id: 1 }, { id: 2 }]);
        browser.tabs.sendMessage.resolves();

        await CollectHitStatsNotifier.notify(true, (tabId) => tabId === 1);

        expect(browser.tabs.sendMessage.args.map(([, message]) => message)).toEqual([
            {
                handlerName: MESSAGE_HANDLER_NAME,
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: true },
            },
            {
                handlerName: MESSAGE_HANDLER_NAME,
                type: MessageType.SetCollectHitStats,
                payload: { isCollectStats: false },
            },
        ]);
    });

    it('does not wait for delivery to a frozen tab', async () => {
        browser.tabs.query.resolves([{ id: 1 }]);
        browser.tabs.sendMessage.returns(new Promise(() => {}));

        await expect(CollectHitStatsNotifier.notify(true)).resolves.toBeUndefined();
        await expect(CollectHitStatsNotifier.notify(false)).resolves.toBeUndefined();

        expect(browser.tabs.query.callCount).toBe(2);
        expect(browser.tabs.sendMessage.callCount).toBe(2);
    });

    it('sends notifications in call order', async () => {
        let queryCall = 0;
        browser.tabs.query.callsFake(async () => {
            queryCall += 1;

            if (queryCall === 1) {
                await new Promise((resolve) => {
                    setTimeout(resolve, 10);
                });
            }

            return [{ id: 1 }];
        });
        browser.tabs.sendMessage.resolves();

        const first = CollectHitStatsNotifier.notify(true);
        const second = CollectHitStatsNotifier.notify(false);

        await Promise.all([first, second]);

        expect(browser.tabs.sendMessage.callCount).toBe(2);
        expect(browser.tabs.sendMessage.firstCall.args[1]).toEqual(expect.objectContaining({
            payload: { isCollectStats: true },
        }));
        expect(browser.tabs.sendMessage.secondCall.args[1]).toEqual(expect.objectContaining({
            payload: { isCollectStats: false },
        }));
    });
});

describe('isCollectStatsEnabledForDocument', () => {
    const allowlistedRule = { isFilteringDisabled: (): boolean => true } as NetworkRule;
    const regularRule = { isFilteringDisabled: (): boolean => false } as NetworkRule;

    it('returns false when collection is disabled', () => {
        expect(isCollectStatsEnabledForDocument(false, regularRule)).toBe(false);
        expect(isCollectStatsEnabledForDocument(undefined, regularRule)).toBe(false);
    });

    it('returns false for an allowlisted document', () => {
        expect(isCollectStatsEnabledForDocument(true, allowlistedRule)).toBe(false);
    });

    it('returns true when collection is enabled and the document is not allowlisted', () => {
        expect(isCollectStatsEnabledForDocument(true, regularRule)).toBe(true);
        expect(isCollectStatsEnabledForDocument(true, null)).toBe(true);
    });
});
