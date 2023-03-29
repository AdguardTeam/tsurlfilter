import { ConfigurationMV2, TsWebExtension } from '@adguard/tswebextension';
import { LogDetails } from './logger';

declare global {
    interface Window {
        tsWebExtension: TsWebExtension;
    }
}

export const addQunitListeners = (logResultFnName: string) => {
    let qUnit: any;

    Object.defineProperty(window, 'QUnit', {
        get: () => qUnit,
        set: (value) => {
            qUnit = value;

            // https://github.com/js-reporters/js-reporters
            qUnit.on('runEnd', (details: LogDetails) => {
                const name = document.getElementById('qunit-header')?.textContent;

                (<any>window)[logResultFnName](Object.assign(details, { name }));

                (<any>window).testsCompleted = true;
            });
        },
        configurable: true,
    });
};


export type SetTsWebExtensionConfigArg = [ defaultConfig: ConfigurationMV2, rulesText: string ];

export const setTsWebExtensionConfig =  async (arg: SetTsWebExtensionConfigArg) => {
    const [ defaultConfig, rulesText ] = arg;
    const configuration: ConfigurationMV2 = defaultConfig;
    configuration.filters = [{
        filterId: 1,
        content: rulesText,
        trusted: true,
    }];
    await window.tsWebExtension.configure(configuration);
};

export const waitUntilTestsCompleted = () => {
    return (<any>window).testsCompleted;
};
