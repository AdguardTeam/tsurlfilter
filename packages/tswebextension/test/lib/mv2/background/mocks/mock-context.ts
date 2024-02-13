import type { ConfigurationMV2Context } from '@lib/mv2/background/configuration';
import type { AppContext } from '@lib/mv2/background/context';

/**
 * Mock for {@link AppContext}.
 */
export class MockAppContext implements AppContext {
    isAppStarted: boolean = false;

    isStorageInitialized: boolean = false;

    configuration: ConfigurationMV2Context | undefined = undefined;
}
