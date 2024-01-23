import { AppContext } from '@lib/mv2/background/context';

/**
 * Returns mock for {@link AppContext}.
 *
 * @returns Mock for {@link AppContext}.
 */
export const getMockAppContext = (): AppContext => {
    const appContext = new AppContext();

    appContext.isAppStarted = false;
    appContext.configuration = undefined;

    return appContext;
};
