import { RedirectsService } from '@lib/mv2/background/services/redirects/redirects-service';
import { ResourcesService } from '@lib/mv2/background/services/resources-service';

jest.mock('@lib/mv2/background/services/resources-service', () => ({
    ...jest.requireActual('../mocks/resources-service-mock'),
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

    it('createResourceUrl is called', async () => {
        const url = 'https://example.com';
        const redirectTitle = '1x1-transparent.gif';

        redirectsService = new RedirectsService(resourcesService);
        await redirectsService.start();

        redirectsService.createRedirectUrl(redirectTitle, url);
        expect(resourcesService.createResourceUrl)
            .toHaveBeenCalledWith(`redirects/${redirectTitle}`, new URLSearchParams());
    });
});
