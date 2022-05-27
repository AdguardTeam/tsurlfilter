import { Configuration, TsWebExtension } from '@adguard/tswebextension';

declare global {
    interface Window {
        tsWebExtension: TsWebExtension;
    }
}

export const addQunitListeners = (callbackName: string) => {
    let qUnit: any;

    Object.defineProperty(window, 'QUnit', {
        get: () => qUnit,
        set: (value) => {
            qUnit = value;

            // https://github.com/js-reporters/js-reporters
            qUnit.on('runEnd', (details: any) => {
                const name = document.getElementById('qunit-header')?.textContent;

                (<any>window)[callbackName](Object.assign(details, { name }));
            });
        },
        configurable: true,
    });
};


export type SetTsWebExtensionConfigArg = [ defaultConfig: Configuration, userrules: string ];

export const setTsWebExtensionConfig =  async (arg: SetTsWebExtensionConfigArg) => {
    const [ defaultConfig, userrules ] = arg;
    await self.tsWebExtension.configure(
        Object.assign(
            defaultConfig,
            {
                filters: [],
                userrules: [ userrules ],
            },
        ),
    );
};
