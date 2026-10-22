import browser from 'sinon-chrome';
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { ChromiumMv2CanvasDeliveryChannel } from '../../../../src/lib/mv2/background/canvas-delivery-channel';
import { type ChromiumMv2CanvasInjection } from '../../../../src/lib/mv2/background/canvas-injection';
import { type OnBeforeRequestDetailsType } from '../../../../src/lib/mv2/background/request/events/request-events';
import { type TabsApi } from '../../../../src/lib/mv2/background/tabs/tabs-api';
import { CanvasDeliveryUrl } from '../../../../src/lib/mv2/common/canvas-delivery';

const DATA_URL_PREFIX = 'data:text/javascript;charset=utf-8,';

/**
 * Decodes the page script from an answer.
 *
 * @param answer Answer of the channel.
 * @param answer.redirectUrl Redirect URL carrying the script.
 *
 * @returns The script text.
 */
const decode = ({ redirectUrl }: { redirectUrl: string }): string => {
    expect(redirectUrl.startsWith(DATA_URL_PREFIX)).toBe(true);
    return decodeURIComponent(redirectUrl.slice(DATA_URL_PREFIX.length));
};

describe('Chromium MV2 canvas delivery channel', () => {
    const TOP_URL = 'https://top.example/page';
    const FRAME_URL = 'https://frame.example/f';
    const SCRIPT = 'protect();';

    let injection: { getPageScript: ReturnType<typeof vi.fn> };
    let tabsApi: {
        getFrameContext: ReturnType<typeof vi.fn>;
        getMainFrameUrl: ReturnType<typeof vi.fn>;
        getTabContext: ReturnType<typeof vi.fn>;
    };
    let channel: ChromiumMv2CanvasDeliveryChannel;
    let frames: Map<number, string>;
    let mainFrameUrl: string | undefined;
    let tabUrl: string | undefined;
    let hasTabContext: boolean;

    /**
     * Builds request details of the content script XHR.
     *
     * @param overrides Details replacing the defaults of a top document request.
     *
     * @returns Request details.
     */
    const createDetails = (overrides: Partial<OnBeforeRequestDetailsType> = {}): OnBeforeRequestDetailsType => ({
        requestId: '1',
        url: CanvasDeliveryUrl.URL,
        method: 'GET',
        frameId: 0,
        parentFrameId: -1,
        tabId: 1,
        type: 'xmlhttprequest',
        timeStamp: 0,
        thirdParty: false,
        initiator: 'https://top.example',
        documentId: 'doc-1',
        ...overrides,
    });

    /**
     * Builds request details of a cross-origin subframe.
     *
     * @param overrides Details replacing the subframe defaults.
     *
     * @returns Request details.
     */
    const createSubframeDetails = (overrides: Partial<OnBeforeRequestDetailsType> = {}): OnBeforeRequestDetailsType => {
        return createDetails({
            frameId: 3,
            parentFrameId: 0,
            initiator: 'https://frame.example',
            ...overrides,
        });
    };

    beforeEach(() => {
        browser.webRequest.onBeforeRequest.addListener.resetHistory();
        frames = new Map([[0, TOP_URL], [3, FRAME_URL]]);
        mainFrameUrl = TOP_URL;
        tabUrl = TOP_URL;
        hasTabContext = true;
        injection = { getPageScript: vi.fn(() => SCRIPT) };
        tabsApi = {
            getFrameContext: vi.fn((tabId: number, frameId: number) => {
                const url = frames.get(frameId);
                return url === undefined ? undefined : { url };
            }),
            getMainFrameUrl: vi.fn(() => mainFrameUrl),
            getTabContext: vi.fn(() => (hasTabContext ? { info: { url: tabUrl } } : undefined)),
        };
        channel = new ChromiumMv2CanvasDeliveryChannel(
            injection as unknown as ChromiumMv2CanvasInjection,
            tabsApi as unknown as TabsApi,
        );
    });

    it('listens once to the reserved host with a blocking listener', () => {
        channel.listen();
        channel.listen();
        expect(browser.webRequest.onBeforeRequest.addListener.callCount).toBe(1);
        const [, filter, extraInfoSpec] = browser.webRequest.onBeforeRequest.addListener.lastCall.args;
        expect(filter).toEqual({ urls: ['*://tswebextension.invalid/*'] });
        expect(extraInfoSpec).toEqual(['blocking']);
    });

    it('answers through the registered listener', () => {
        channel.listen();
        const listener = browser.webRequest.onBeforeRequest.addListener.lastCall.args[0];
        expect(decode(listener(createDetails()))).toBe(SCRIPT);
    });

    it('answers the page script for the top document', () => {
        expect(decode(channel.answer(createDetails()))).toBe(SCRIPT);
        expect(injection.getPageScript).toHaveBeenCalledExactlyOnceWith({ url: TOP_URL, topUrl: TOP_URL });
    });

    it('treats an outermost frame with a non-zero frame ID as top', () => {
        frames.set(5, 'https://prerender.example/p');
        expect(decode(channel.answer(createDetails({
            frameId: 5,
            initiator: 'https://prerender.example',
        })))).toBe(SCRIPT);
        expect(injection.getPageScript).toHaveBeenCalledExactlyOnceWith({
            url: 'https://prerender.example/p',
            topUrl: 'https://prerender.example/p',
        });
        expect(tabsApi.getMainFrameUrl).not.toHaveBeenCalled();
        expect(tabsApi.getTabContext).not.toHaveBeenCalled();
    });

    it('takes the committed top-level URL of a subframe from the tab context', () => {
        mainFrameUrl = 'https://www.top.example/a#x';
        tabUrl = 'https://www.top.example/b';
        expect(decode(channel.answer(createSubframeDetails()))).toBe(SCRIPT);
        expect(injection.getPageScript).toHaveBeenCalledExactlyOnceWith({
            url: FRAME_URL,
            topUrl: 'https://www.top.example/b',
        });
    });

    it('answers empty while the main frame context differs from the committed tab URL', () => {
        mainFrameUrl = 'https://next.example/';
        tabUrl = 'https://top.example/';
        expect(decode(channel.answer(createSubframeDetails({ documentId: 'doc-a' })))).toBe('');

        mainFrameUrl = 'https://www.top.example/';
        expect(decode(channel.answer(createSubframeDetails({ documentId: 'doc-b' })))).toBe('');

        expect(injection.getPageScript).not.toHaveBeenCalled();
    });

    it('answers once per document', () => {
        expect(decode(channel.answer(createDetails()))).toBe(SCRIPT);
        expect(decode(channel.answer(createDetails()))).toBe('');
        expect(injection.getPageScript).toHaveBeenCalledTimes(1);
    });

    it('consumes the document on an empty first answer', () => {
        injection.getPageScript.mockReturnValue(undefined);
        expect(decode(channel.answer(createDetails()))).toBe('');
        injection.getPageScript.mockReturnValue(SCRIPT);
        expect(decode(channel.answer(createDetails()))).toBe('');
    });

    it('forgets the oldest document beyond the bound', () => {
        expect(ChromiumMv2CanvasDeliveryChannel.MAX_ANSWERED_DOCUMENTS).toBe(4096);
        channel.answer(createDetails({ documentId: 'first' }));
        for (let i = 0; i < 4095; i += 1) {
            channel.answer(createDetails({ documentId: `other-${i}` }));
        }
        expect(decode(channel.answer(createDetails({ documentId: 'first' })))).toBe('');

        channel.answer(createDetails({ documentId: 'other-4095' }));
        expect(decode(channel.answer(createDetails({ documentId: 'first' })))).toBe(SCRIPT);
    });

    it('answers empty without a documentId', () => {
        expect(decode(channel.answer(createDetails({ documentId: undefined })))).toBe('');
        expect(injection.getPageScript).not.toHaveBeenCalled();
    });

    it('answers empty without a frame context', () => {
        frames.clear();
        expect(decode(channel.answer(createDetails()))).toBe('');
        expect(injection.getPageScript).not.toHaveBeenCalled();
    });

    it('answers empty for an initiator that differs from the frame origin', () => {
        expect(decode(channel.answer(createDetails({ initiator: 'https://other.example' })))).toBe('');
        expect(injection.getPageScript).not.toHaveBeenCalled();
    });

    it('answers empty for an opaque initiator', () => {
        expect(decode(channel.answer(createDetails({ initiator: 'null' })))).toBe('');
        expect(decode(channel.answer(createDetails({ documentId: 'doc-2', initiator: undefined })))).toBe('');
        expect(injection.getPageScript).not.toHaveBeenCalled();
    });

    it('answers empty when the top-level URL is not a web page', () => {
        mainFrameUrl = 'about:blank';
        tabUrl = 'about:blank';
        expect(decode(channel.answer(createSubframeDetails({ documentId: 'doc-a' })))).toBe('');

        mainFrameUrl = TOP_URL;
        tabUrl = TOP_URL;
        hasTabContext = false;
        expect(decode(channel.answer(createSubframeDetails({ documentId: 'doc-b' })))).toBe('');

        hasTabContext = true;
        mainFrameUrl = undefined;
        expect(decode(channel.answer(createSubframeDetails({ documentId: 'doc-c' })))).toBe('');

        expect(injection.getPageScript).not.toHaveBeenCalled();
    });

    it('answers empty when the delivery has no script', () => {
        injection.getPageScript.mockReturnValue(undefined);
        expect(decode(channel.answer(createDetails()))).toBe('');
    });

    it('encodes the script losslessly', () => {
        const script = 'a="100%";b="#x";c=[1,2];\nd="\u2028";';
        injection.getPageScript.mockReturnValue(script);
        expect(decode(channel.answer(createDetails()))).toBe(script);
    });
});
