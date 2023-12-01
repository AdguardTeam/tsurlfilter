import { DocumentBlockingService } from '@lib/mv2/background/services/document-blocking-service';
import { NetworkRule } from '@adguard/tsurlfilter';
import { ConfigurationMV2, tabsApi } from '@lib/mv2';
import { getConfigurationMv2Fixture } from '../fixtures/configuration';

jest.mock('@lib/mv2/background/api');

describe('DocumentBlockingService', () => {
    let documentBlockingService: DocumentBlockingService;

    beforeEach(() => {
        documentBlockingService = new DocumentBlockingService(tabsApi);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should not block URLs from trusted domains', () => {
        const trustedUrl = 'https://opulent-space-telegram-g4wx56pwp9q2vp5j.github.dev/blabla';
        const trustedDomain = 'opulent-space-telegram-g4wx56pwp9q2vp5j.github.dev';
        const mockNetworkRule = new NetworkRule('example.org', 0);

        const mockConfig: ConfigurationMV2 = {
            ...getConfigurationMv2Fixture(),
            ...{
                trustedDomains: [trustedDomain],
            },
        };

        documentBlockingService.configure(mockConfig);

        const result = documentBlockingService.getDocumentBlockingResponse({
            tabId: 1,
            eventId: 'someEvent',
            rule: mockNetworkRule,
            referrerUrl: 'someReferrer',
            requestUrl: trustedUrl,
        });

        expect(result).toBeUndefined();
    });
});
