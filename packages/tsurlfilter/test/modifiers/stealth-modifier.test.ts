import {
    describe,
    it,
    expect,
    afterEach,
    afterAll,
    vi,
} from 'vitest';

import { StealthModifier, StealthOptionName } from '../../src/modifiers/stealth-modifier';
import { loggerMocks } from '../setup';

describe('Stealth modifier api', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    afterAll(() => {
        vi.resetAllMocks();
    });

    it('handles different constructor params', () => {
        let modifier = new StealthModifier('xclientdata|referrer');
        expect(modifier.hasStealthOption(StealthOptionName.XClientData)).toBeTruthy();
        expect(modifier.hasStealthOption(StealthOptionName.HideReferrer)).toBeTruthy();

        modifier = new StealthModifier('    ');
        expect(modifier.hasValues()).toBeFalsy();
        expect(loggerMocks.trace).toHaveBeenCalledTimes(0);

        modifier = new StealthModifier('referrer|flash');
        expect(modifier.hasValues()).toBeTruthy();
        expect(modifier.hasStealthOption(StealthOptionName.HideReferrer)).toBeTruthy();
        expect(loggerMocks.trace).toHaveBeenCalledTimes(0);

        let traceCalls = 0;
        modifier = new StealthModifier('donottrack|donottrack');
        traceCalls += 1;
        expect(modifier.hasValues()).toBeTruthy();
        expect(loggerMocks.trace).toHaveBeenCalledTimes(traceCalls);
        expect(loggerMocks.trace).toHaveBeenCalledWith(
            // eslint-disable-next-line max-len
            '[tsurl.StealthModifier.constructor]: duplicate $stealth modifier value "donottrack" in "donottrack|donottrack"',
        );

        modifier = new StealthModifier('webrtc|java');
        traceCalls += 1;
        expect(modifier.hasValues()).toBeFalsy();
        expect(loggerMocks.trace).toHaveBeenCalledTimes(traceCalls);
        expect(loggerMocks.trace).toHaveBeenCalledWith(
            // eslint-disable-next-line max-len
            '[tsurl.StealthModifier.constructor]: $stealth modifier does not contain any options supported by browser extension: "webrtc|java"',
        );

        expect(() => {
            new StealthModifier('xclientdata,referrer');
        }).toThrowError('Invalid separator of stealth options used: "xclientdata,referrer"');

        expect(() => {
            new StealthModifier('not-a-valid-option');
        }).toThrowError('Invalid $stealth option in modifier value: "not-a-valid-option"');
    });

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
