import {
    describe,
    expect,
    beforeEach,
    afterEach,
    it,
    vi,
} from 'vitest';

import { createNetworkRule } from '../../../../helpers/rule-creator';
import { getConfigurationMv2Fixture } from '../fixtures/configuration';
import { DocumentBlockingService } from '../../../../../src/lib/mv2/background/services/document-blocking-service';
import { engineApi, tabsApi } from '../../../../../src/lib/mv2/background/api';
import { type ConfigurationMV2 } from '../../../../../src/lib/mv2/background/configuration';

vi.mock('../../../../../src/lib/mv2/background/api');

describe('DocumentBlockingService', () => {
    let documentBlockingService: DocumentBlockingService;

    beforeEach(() => {
        documentBlockingService = new DocumentBlockingService(tabsApi, engineApi);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should not block URLs from trusted domains', () => {
        const trustedUrl = 'https://opulent-space-telegram-g4wx56pwp9q2vp5j.github.dev/blabla';
        const trustedDomain = 'opulent-space-telegram-g4wx56pwp9q2vp5j.github.dev';
        const mockNetworkRule = createNetworkRule('example.org', 0);

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
            requestId: '123',
        });

        expect(result).toBeUndefined();
    });
});
