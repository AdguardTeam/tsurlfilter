import { companiesDbService } from '../../../src/lib/common/companies-db-service';

jest.mock('../../../src/lib/common/companies-db-service/trackers-min', () => ({
    rawCompaniesDb: {
        timeUpdated: '2024-09-01T00:00:00Z',
        categories: {
            0: 'unknown',
            1: 'cdn',
            2: 'hosting',
            3: 'site_analytics',
            4: 'advertising',
            5: 'social_media',
            6: 'customer_interaction',
        },
        trackerDomains: {
            'example.com': 0,
            'example.org': 1,
            'ad.subdomain.example.org': 4,
            'cloud-example.net': 2,
            'subdomain123.cloud-example.net': 3,
            'ad.subdomain123.cloud-example.net': 4,
            'example-web-service.com': 2,
            'ad.s3.example-web-service.com': 4,
            'soc-image.s3.example-web-service.com': 5,
            'comments.s3.example-web-service.com': 6,
            'chat.example.com.au': 6,
            'amazonaws.com': 2,
            'test-public.s3.amazonaws.com': 3,
        },
    },
}));

describe('CompaniesDbService', () => {
    test.each([
        {
            actual: 'https://test-public.s3.amazonaws.com',
            expected: 'site_analytics',
        },
        {
            // defined as unknown
            actual: 'https://example.com',
            expected: 'unknown',
        },
        {
            // not defined, should be unknown
            actual: 'https://example123.com',
            expected: 'unknown',
        },
        {
            actual: 'https://chat.example.com.au',
            expected: 'customer_interaction',
        },
        {
            actual: 'https://cloud-example.net',
            expected: 'hosting',
        },
        // it is possible that subdomains has different category than the main domain
        {
            actual: 'https://subdomain123.cloud-example.net',
            expected: 'site_analytics',
        },
        {
            actual: 'https://ad.subdomain123.cloud-example.net',
            expected: 'advertising',
        },
        {
            actual: 'https://sub.ad.subdomain123.cloud-example.net',
            expected: 'advertising',
        },
        // but if there is no category for a subdomain, the main domain category should be used
        // except for the case when "sub-subdomain" has a category
        {
            actual: 'https://subdomain.example.org',
            expected: 'cdn',
        },
        {
            actual: 'https://example.org',
            expected: 'cdn',
        },
        {
            actual: 'https://ad.subdomain.example.org',
            expected: 'advertising',
        },
        // more than 1 level of subdomains
        {
            actual: 'https://example-web-service.com',
            expected: 'hosting',
        },
        {
            actual: 'https://ad.s3.example-web-service.com',
            expected: 'advertising',
        },
        {
            actual: 'https://soc-image.s3.example-web-service.com',
            expected: 'social_media',
        },
        {
            actual: 'https://comments.s3.example-web-service.com',
            expected: 'customer_interaction',
        },
    ])('url: "$actual" -> category name: "$expected"', ({ actual, expected }) => {
        expect(companiesDbService.match(actual)).toBe(expected);
    });
});
