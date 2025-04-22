import {
    describe,
    it,
    expect,
    afterEach,
    afterAll,
    vi,
} from 'vitest';

import { StealthModifier, StealthOptionName } from '../../src/modifiers/stealth-modifier';

vi.mock('@adguard/logger', () => ({
    Logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
    },
}));

import { Logger } from '@adguard/logger';

describe('Stealth modifier api', () => {
    const logger = new Logger(console);

    afterEach(() => {
        vi.clearAllMocks();
    });

    afterAll(() => {
        vi.resetAllMocks();
    });

    // FIXME: BROKEN TEST
    // it('handles different constructor params', () => {
    //     let modifier = new StealthModifier('xclientdata|referrer');
    //     expect(modifier.hasStealthOption(StealthOptionName.XClientData)).toBeTruthy();
    //     expect(modifier.hasStealthOption(StealthOptionName.HideReferrer)).toBeTruthy();

    //     modifier = new StealthModifier('    ');
    //     expect(modifier.hasValues()).toBeFalsy();
    //     expect(logger.debug).toHaveBeenCalledTimes(0);

    //     modifier = new StealthModifier('referrer|flash');
    //     expect(modifier.hasValues()).toBeTruthy();
    //     expect(modifier.hasStealthOption(StealthOptionName.HideReferrer)).toBeTruthy();
    //     expect(logger.debug).toHaveBeenCalledTimes(0);

    //     modifier = new StealthModifier('webrtc|java');
    //     expect(modifier.hasValues()).toBeFalsy();
    //     expect(logger.debug).toHaveBeenCalledTimes(1);
    //     expect(logger.debug).toHaveBeenCalledWith(
    //         '$stealth modifier does not contain any options supported by browser extension: "webrtc|java"',
    //     );

    //     expect(() => {
    //         new StealthModifier('xclientdata,referrer');
    //     }).toThrowError('Invalid separator of stealth options used: "xclientdata,referrer"');

    //     expect(() => {
    //         new StealthModifier('not-a-valid-option');
    //     }).toThrowError('Invalid $stealth option in modifier value: "not-a-valid-option"');
    // });

    it('checks if given string is a valid stealth option', () => {
        // @ts-ignore
        const { isValidStealthOption } = StealthModifier;

        expect(isValidStealthOption(StealthOptionName.XClientData)).toBeTruthy();
        expect(isValidStealthOption('xclientdata')).toBeTruthy();
        expect(isValidStealthOption('invalid')).toBeFalsy();
    });

    it('shows if given option is present', () => {
        let modifier = new StealthModifier('xclientdata|referrer');
        expect(modifier.hasStealthOption(StealthOptionName.XClientData)).toBeTruthy();
        expect(modifier.hasStealthOption(StealthOptionName.HideReferrer)).toBeTruthy();
        expect(modifier.hasStealthOption(StealthOptionName.HideSearchQueries)).toBeFalsy();
        expect(modifier.hasStealthOption(StealthOptionName.DoNotTrack)).toBeFalsy();
        expect(modifier.hasStealthOption(StealthOptionName.FirstPartyCookies)).toBeFalsy();
        expect(modifier.hasStealthOption(StealthOptionName.ThirdPartyCookies)).toBeFalsy();

        modifier = new StealthModifier('');
        expect(modifier.hasStealthOption(StealthOptionName.XClientData)).toBeFalsy();
        expect(modifier.hasStealthOption(StealthOptionName.HideReferrer)).toBeFalsy();
        expect(modifier.hasStealthOption(StealthOptionName.HideSearchQueries)).toBeFalsy();
        expect(modifier.hasStealthOption(StealthOptionName.DoNotTrack)).toBeFalsy();
        expect(modifier.hasStealthOption(StealthOptionName.FirstPartyCookies)).toBeFalsy();
        expect(modifier.hasStealthOption(StealthOptionName.ThirdPartyCookies)).toBeFalsy();
    });

    it('specifically indicates if at least one option was set', () => {
        let modifier = new StealthModifier('3p-cookie');
        expect(modifier.hasValues()).toBeTruthy();

        modifier = new StealthModifier('1p-cookie|donottrack');
        expect(modifier.hasValues()).toBeTruthy();

        modifier = new StealthModifier('');
        expect(modifier.hasValues()).toBeFalsy();
    });
});
