import type { ConfigurationMV2Context } from './configuration';
import { sessionDecorator, SessionStorageKey } from './session-storage';

/**
 * Top level app context storage.
 *
 * This context is needed to share data between other modules without cyclic dependencies.
 *
 * TODO (v.zhelvis) delete this context after DI is implemented.
 */
export class AppContext {
    /**
     * Is app started.
     */
    @sessionDecorator(SessionStorageKey.IsAppStarted)
    accessor isAppStarted!: boolean;

    /**
     * MV2 ConfigurationMV2 excludes heavyweight fields with rules.
     */
    @sessionDecorator(SessionStorageKey.Configuration)
    accessor configuration: ConfigurationMV2Context | undefined;
}

export const appContext = new AppContext();
