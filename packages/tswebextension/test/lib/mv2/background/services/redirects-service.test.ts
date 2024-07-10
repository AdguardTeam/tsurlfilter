import { RedirectsService } from '@lib/mv2/background/services/redirects/redirects-service';
import { ResourcesService } from '@lib/mv2/background/services/resources-service';

jest.mock('@lib/mv2/background/services/resources-service', () => ({
    ...jest.requireActual('../mocks/resources-service-mock'),
}));

const browserDetectorMock = jest.requireMock('@lib/mv2/background/utils/browser-detector');
jest.mock('@lib/mv2/background/utils/browser-detector', () => ({
    isFirefox: false,
}));

describe('RedirectsService', () => {
    const resourcesService = new ResourcesService(() => {
        return Math.floor(Math.random() * 982451653 + 982451653).toString(36);
    });

    let redirectsService: RedirectsService;

    beforeEach(async () => {
        jest.resetAllMocks();
        // re-instantiate service before each test to clear data urls cache
        redirectsService = new RedirectsService(resourcesService);
        await redirectsService.start();
    });

    it('checks for content type', () => {
        // @ts-ignore: accessing private method
        expect(RedirectsService.isBase64EncodedContentType('text/javascript; base64')).toBeTruthy();
        // @ts-ignore: accessing private method
        expect(RedirectsService.isBase64EncodedContentType('text/javascript')).toBeFalsy();
    });

    it('creates data urls by redirect source', () => {
        // Creates data url for an already encoded content
        let redirectSource = redirectsService.redirects!.getRedirect('1x1-transparent.gif');
        let expectedDataUrl = `data:${redirectSource?.contentType},${redirectSource!.content}`;

        // @ts-ignore: accessing private method
        let dataUrl = redirectsService.createRedirectDataUrl(redirectSource);
        expect(dataUrl).toBe(expectedDataUrl);

        // Create data url for a non-encoded content
        redirectSource = redirectsService.redirects!.getRedirect('matomo');
        expectedDataUrl = `data:${redirectSource?.contentType};base64,${btoa(redirectSource!.content)}`;

        // @ts-ignore: accessing private method
        dataUrl = redirectsService.createRedirectDataUrl(redirectSource);
        expect(dataUrl).toBe(expectedDataUrl);
    });

    it('uses cache for managing data urls', () => {
        const redirectSource = redirectsService.redirects!.getRedirect('google-ima3');
        const expectedDataUrl = `data:${redirectSource?.contentType};base64,${btoa(redirectSource!.content)}`;

        const spy = jest.spyOn(global, 'btoa');

        // @ts-ignore: accessing private method
        let dataUrl = redirectsService.createRedirectDataUrl(redirectSource);
        expect(dataUrl).toBe(expectedDataUrl);

        // @ts-ignore: accessing private method
        dataUrl = redirectsService.createRedirectDataUrl(redirectSource);
        expect(dataUrl).toBe(expectedDataUrl);

        // createRedirectDataUrl was called twice, but btoa was called only once
        expect(btoa).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });

    it('creates redirect urls by redirect title', () => {
        const url = 'https://example.com';
        let redirectTitle = 'fingerprintjs3';

        let dataUrl = redirectsService.createRedirectUrl(redirectTitle, url);
        let redirectSource = redirectsService.redirects!.getRedirect(redirectTitle);
        let expectedDataUrl = `data:${redirectSource?.contentType};base64,${btoa(redirectSource!.content)}`;
        expect(dataUrl).toBe(expectedDataUrl);

        redirectTitle = '1x1-transparent.gif';
        dataUrl = redirectsService.createRedirectUrl(redirectTitle, url);
        redirectSource = redirectsService.redirects!.getRedirect(redirectTitle);
        expectedDataUrl = `data:${redirectSource?.contentType},${redirectSource!.content}`;
        expect(dataUrl).toBe(expectedDataUrl);
    });

    it('Firefox still using the legacy URL', async () => {
        const url = 'https://example.com';
        const redirectTitle = '1x1-transparent.gif';

        browserDetectorMock.isFirefox = true;

        redirectsService = new RedirectsService(resourcesService);
        await redirectsService.start();

        redirectsService.createRedirectUrl(redirectTitle, url);
        expect(resourcesService.createResourceUrl).toHaveBeenCalledWith(`redirects/${redirectTitle}`);
    });
});
