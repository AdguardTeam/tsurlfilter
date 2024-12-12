import {
    describe,
    beforeEach,
    afterEach,
    it,
    expect,
    vi,
} from 'vitest';
import { RequestType } from '@adguard/tsurlfilter/es/request-type';

import { CosmeticApi } from '../../../../../src/lib/mv2/background/cosmetic-api';
import { hideRequestInitiatorElement, InitiatorTag } from '../../../../../src/lib';
import { HIDING_STYLE } from '../../../../../src/lib/mv2/common/hidden-style';
import { BACKGROUND_TAB_ID } from '../../../../../src/lib/common/constants';

describe('Request Initiator Element', () => {
    beforeEach(() => {
        vi.spyOn(CosmeticApi, 'injectCss');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('hides subdocument with third party src', () => {
        const tabId = 1;
        const frameId = 0;

        hideRequestInitiatorElement(
            tabId,
            frameId,
            'https://example.org',
            'https://another.org',
            RequestType.SubDocument,
            true,
        );

        const expectedTags = [InitiatorTag.Iframe, InitiatorTag.Frame];

        let expectedCode = '';

        for (let i = 0; i < expectedTags.length; i += 1) {
            expectedCode += `${expectedTags[i]}[src$="//example.org"] ${HIDING_STYLE}\n`;
        }

        expect(CosmeticApi.injectCss).toBeCalledWith(expectedCode, tabId, frameId);
    });

    it('hides image with third party src', () => {
        const tabId = 1;
        const frameId = 0;

        hideRequestInitiatorElement(
            tabId,
            frameId,
            'https://example.org/image.png',
            'https://another/image.png',
            RequestType.Image,
            true,
        );

        const expectedCode = `${InitiatorTag.Image}[src$="//example.org/image.png"] ${HIDING_STYLE}\n`;

        expect(CosmeticApi.injectCss).toBeCalledWith(expectedCode, tabId, frameId);
    });

    describe('hides image with first party src', () => {
        const tabId = 1;
        const frameId = 0;

        // [requestUrl, documentUrl, expectedSrcAttribute]
        const cases = [
            ['https://example.org', 'https://example.org', '/'],
            ['https://example.org/image.png', 'https://example.org', '/image.png'],
            ['https://example.org/foo/image.png', 'https://example.org/foo', 'image.png'],
            ['https://example.org/foo/image.png', 'https://example.org/foo?test=1#test', 'image.png'],
            ['https://example.org/foo/image.png', 'https://example.org', '/foo/image.png'],
            ['https://example.org/foo/bar/image.png', 'https://example.org/foo/', 'bar/image.png'],
            ['https://example.org/foo/bar/image.png', 'https://example.org/baz', '/foo/bar/image.png'],
            ['https://example.org/foo/bar/image.png', 'https://example.org/foo/baz/', 'bar/image.png'],
            ['https://example.org/foo/bar/baz/image.png', 'https://example.org/foo/baz/', 'bar/baz/image.png'],
            ['https://example.org/foo/bar/baz/image.png', 'https://example.org/foo/bar/baz#test', 'image.png'],
        ];

        it.each(cases)('%s loaded at %s', (requestUrl, documentUrl, expectedSrcAttribute) => {
            hideRequestInitiatorElement(
                tabId,
                frameId,
                requestUrl,
                documentUrl,
                RequestType.Image,
                false,
            );

            const expectedCode = `${InitiatorTag.Image}[src="${
                expectedSrcAttribute
            }"] ${HIDING_STYLE}\n`;

            expect(CosmeticApi.injectCss).toBeCalledWith(expectedCode, tabId, frameId);
        });
    });

    it('doesn`t inject css on background tab', () => {
        hideRequestInitiatorElement(
            BACKGROUND_TAB_ID,
            0,
            'https://example.org/image.png',
            'https://another.org',
            RequestType.Image,
            true,
        );

        expect(CosmeticApi.injectCss).toBeCalledTimes(0);
    });

    it('doesn`t inject css for unsupported request types', () => {
        hideRequestInitiatorElement(
            1,
            0,
            'https://example.org/image.png',
            'https://example.org',
            RequestType.XmlHttpRequest,
            true,
        );

        expect(CosmeticApi.injectCss).toBeCalledTimes(0);
    });
});
