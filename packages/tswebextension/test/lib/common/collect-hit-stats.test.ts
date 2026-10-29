import browser from 'sinon-chrome';
import {
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { CollectHitStatsNotifier } from '../../../src/lib/common/collect-hit-stats';
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
