import { RequestType } from '@adguard/tsurlfilter';

import { 
    hideRequestInitiatorElement,
    INITIATOR_TAG_HIDDEN_STYLE,
    BACKGROUND_TAB_ID,
    InitiatorTag,
} from '../../../src/background/request/request-initiator-element';

import { cosmeticApi } from '../../../src/background/cosmetic-api';

describe('Request Initiator Element', () => {
    beforeEach(() => {
        jest.spyOn(cosmeticApi, 'injectCss').mockImplementation(jest.fn);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('hides subdocument with third party src', () => {
        const tabId = 1;
        const frameId = 0;

        hideRequestInitiatorElement(tabId, frameId, 'https://example.org', RequestType.Subdocument, true);

        const expectedTags = [InitiatorTag.IFRAME, InitiatorTag.FRAME];

        let expectedCode = '';

        for (let i = 0; i < expectedTags.length; i++){
            expectedCode  += `${expectedTags[i]}[src$="//example.org"] ${INITIATOR_TAG_HIDDEN_STYLE}\n`;
        }

        expect(cosmeticApi.injectCss).toBeCalledWith(expectedCode, tabId, frameId);

    });

    it('hides image with third party src', () => {
        const tabId = 1;
        const frameId = 0;

        hideRequestInitiatorElement(tabId, frameId, 'https://example.org/image.png', RequestType.Image, true);

        const expectedCode = `${InitiatorTag.IMAGE}[src$="//example.org/image.png"] ${INITIATOR_TAG_HIDDEN_STYLE}\n`;

        expect(cosmeticApi.injectCss).toBeCalledWith(expectedCode, tabId, frameId);
    });

    it('hides image with first party src', () => {
        const tabId = 1;
        const frameId = 0;

        hideRequestInitiatorElement(tabId, frameId, 'https://example.org/image.png', RequestType.Image, false);

        const expectedCode = `${InitiatorTag.IMAGE}[src$="/image.png"] ${INITIATOR_TAG_HIDDEN_STYLE}\n`;

        expect(cosmeticApi.injectCss).toBeCalledWith(expectedCode, tabId, frameId);
    });

    it('doesn`t inject css on background tab', () => {
        hideRequestInitiatorElement(
            BACKGROUND_TAB_ID,
            0,
            'https://example.org/image.png',
            RequestType.Image,
            true,
        );

        expect(cosmeticApi.injectCss).toBeCalledTimes(0);
    });

    it('doesn`t inject css for unsupported request types', () => {

        hideRequestInitiatorElement(1, 0, 'https://example.org/image.png', RequestType.XmlHttpRequest, true);

        expect(cosmeticApi.injectCss).toBeCalledTimes(0);
    });
});
