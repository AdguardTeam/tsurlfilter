import { ConfigurationMV2 } from '@adguard/tswebextension';
import { LogDetails } from './logger';

export const addQunitListeners = (logResultFnName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let qUnit: any;

    Object.defineProperty(window, 'QUnit', {
        get: () => qUnit,
        set: (value) => {
            qUnit = value;

            // https://github.com/js-reporters/js-reporters
            qUnit.on('runEnd', (details: LogDetails) => {
                const name = document.getElementById('qunit-header')?.textContent;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (<any>window)[logResultFnName](Object.assign(details, { name }));

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any>window).testsCompleted;
};
