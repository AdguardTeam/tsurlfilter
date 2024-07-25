import { type AppContext } from '../../../../../src/lib/mv2/background/context';
import { type ConfigurationMV2Context } from '../../../../../src/lib';

/**
 * Mock for {@link AppContext}.
 */
export class MockAppContext implements AppContext {
    isAppStarted: boolean = false;

    isStorageInitialized: boolean = false;

    configuration: ConfigurationMV2Context | undefined = undefined;

    startTimeMs: number | undefined = undefined;
}
