import { expectNotType, expectType } from 'tsd';

import {
    TsWebExtension,
    type ProtectionPolicyArtifact,
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
declare const policy: ProtectionPolicyArtifact;
expectType<Promise<RegistrationResult>>(mv2.setCanvasProtectionEnabled(true));
expectType<Promise<RegistrationResult>>(mv2.setCanvasProtectionPolicy(policy));
expectType<RegistrationResult>(mv2.getCanvasProtectionState());
expectType<Promise<RegistrationResultMV3>>(mv3.setCanvasProtectionEnabled(true));
expectType<Promise<RegistrationResultMV3>>(mv3.setCanvasProtectionPolicy(policy));
expectType<RegistrationResultMV3>(mv3.getCanvasProtectionState());
