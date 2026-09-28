import { expectNotType, expectType } from 'tsd';

import { TsWebExtension } from '@adguard/tswebextension';
import { type ConfigurationResult, type IStaticRuleset } from '@adguard/tswebextension/mv3';

expectNotType<any>(TsWebExtension);

// Static rule sets expose the number of their metadata rules.
declare const staticFilters: ConfigurationResult['staticFilters'];
expectType<IStaticRuleset[]>(staticFilters);
expectType<number>(staticFilters[0].getMetadataRulesCount());

console.log('Smoke test passed in index.test-d.ts');
