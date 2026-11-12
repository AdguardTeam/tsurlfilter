import { describe, expect, it } from 'vitest';

import { isThirdPartyRequest } from '../../../../src/lib/common/utils/url';

describe('Third-party detection with trailing underscore labels', () => {
    it.each([
        ['https://lorenne_.wehype.app/', 'https://bobajenny.wehype.app/', false],
        ['https://bobajenny.wehype.app/', 'https://lorenne_.wehype.app/', false],
        ['https://lorenne_.wehype.app/', 'https://other_.example.org/', true],
        ['https://other_.example.org/', 'https://lorenne_.wehype.app/', true],
    ])('classifies %s against %s', (url, source, thirdParty) => {
        expect(isThirdPartyRequest(url, source)).toBe(thirdParty);
    });
});
