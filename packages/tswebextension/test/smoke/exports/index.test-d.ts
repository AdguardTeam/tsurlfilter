import { expectAssignable, expectNotType, expectType } from 'tsd';

import {
    CanvasAvailabilityStatus,
    CanvasOperationStatus,
    CanvasRegistrationOperation,
    CanvasRegistrationStatus,
    TsWebExtension,
    type RegistrationOperationOutcome,
    type RegistrationResult,
} from '@adguard/tswebextension';
import {
    CanvasAvailabilityStatus as CanvasAvailabilityStatusMV3,
    CanvasOperationStatus as CanvasOperationStatusMV3,
    CanvasRegistrationOperation as CanvasRegistrationOperationMV3,
    CanvasRegistrationStatus as CanvasRegistrationStatusMV3,
    TsWebExtension as TsWebExtensionMV3,
    type ConfigurationResult,
    type RegistrationOperationOutcome as RegistrationOperationOutcomeMV3,
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

const mv2State = mv2.getCanvasProtectionState();
expectAssignable<CanvasRegistrationStatus>(mv2State.status);
expectAssignable<CanvasAvailabilityStatus>(mv2State.installed.status);
expectType<readonly RegistrationOperationOutcome[]>(mv2State.operations);
expectType<CanvasRegistrationOperation>(mv2State.operations[0].operation);
expectType<CanvasOperationStatus>(mv2State.operations[0].status);
const mv3State = mv3.getCanvasProtectionState();
expectAssignable<CanvasRegistrationStatusMV3>(mv3State.status);
expectAssignable<CanvasAvailabilityStatusMV3>(mv3State.installed.status);
expectType<readonly RegistrationOperationOutcomeMV3[]>(mv3State.operations);
expectType<CanvasRegistrationOperationMV3>(mv3State.operations[0].operation);
expectType<CanvasOperationStatusMV3>(mv3State.operations[0].status);
// @ts-expect-error Chromium MV2 canvas delivery is internal.
import { canvasInjection, canvasDeliveryChannel } from '@adguard/tswebextension';
