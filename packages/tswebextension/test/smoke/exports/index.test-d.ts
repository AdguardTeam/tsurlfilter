import { expectNotType, expectType } from 'tsd';

import {
    TsWebExtension,
    type RegistrationResult,
} from '@adguard/tswebextension';
import {
    TsWebExtension as TsWebExtensionMV3,
    type ConfigurationResult,
    type RegistrationResult as RegistrationResultMV3,
} from '@adguard/tswebextension/mv3';

expectNotType<any>(TsWebExtension);

// Static rule sets expose the number of their metadata rules.
declare const staticFilters: ConfigurationResult['staticFilters'];
expectType<number>(staticFilters[0].getMetadataRulesCount());

console.log('Smoke test passed in index.test-d.ts');

declare const mv2: TsWebExtension;
declare const mv3: TsWebExtensionMV3;
expectType<Promise<RegistrationResult>>(mv2.setCanvasProtectionEnabled(true));
// @ts-expect-error Prepared policy setters are internal.
mv2.setCanvasProtectionPolicy;
expectType<RegistrationResult>(mv2.getCanvasProtectionState());
expectType<Promise<RegistrationResultMV3>>(mv3.setCanvasProtectionEnabled(true));
// @ts-expect-error Prepared policy setters are internal.
mv3.setCanvasProtectionPolicy;
expectType<RegistrationResultMV3>(mv3.getCanvasProtectionState());
