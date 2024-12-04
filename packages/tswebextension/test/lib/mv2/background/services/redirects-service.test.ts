import { ResourcesService } from '../../../../../src/lib/mv2/background/services/resources-service';
import { RedirectsService } from '../../../../../src/lib/mv2/background/services/redirects/redirects-service';

vi.mock('../../../../../src/lib/mv2/background/services/resources-service', async () => {
    return import('../mocks/resources-service-mock');
});

describe('RedirectsService', () => {
    let resourcesService: ResourcesService;
    let redirectsService: RedirectsService;

    beforeEach(async () => {
        vi.resetAllMocks();

        resourcesService = new ResourcesService(() => {
            return Math.floor(Math.random() * 982451653 + 982451653).toString(36);
        });

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
