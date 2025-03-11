import { type AppList, AppListParser, type ModifierValue } from '@adguard/agtree';
import { isString } from '../utils/string-utils';

export interface IAppModifier {
    permittedApps: string[] | null;
    restrictedApps: string[] | null;
}

/**
 * This is a helper class that is used specifically to work with app restrictions.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#app}
 *
 * @example
 * ```adblock
 * ||baddomain.com^$app=org.example.app
 * ||baddomain.com^$app=org.example.app1|org.example.app2
 * ```
 */
export class AppModifier implements IAppModifier {
    /**
     * List of permitted apps or null.
     */
    public readonly permittedApps: string[] | null;

    /**
     * List of restricted apps or null.
     */
    public readonly restrictedApps: string[] | null;

    private static getAppListNode = (apps: string | ModifierValue): AppList => {
        if (isString(apps)) {
            if (!apps) {
                throw new Error('App list cannot be empty');
            }

            return AppListParser.parse(apps);
        }

        if (apps.type !== 'AppList') {
            throw new Error('Unsupported modifier value type');
        }

        if (apps.children.length === 0) {
            throw new Error('App list cannot be empty');
        }

        return apps;
    };

    /**
     * Parses the `apps` string.
     *
     * @param apps Apps string.
     *
     * @throws An error if the app string is empty or invalid.
     */
    constructor(apps: string | ModifierValue) {
        const appListNode = AppModifier.getAppListNode(apps);

        const permittedApps: string[] = [];
        const restrictedApps: string[] = [];

        appListNode.children.forEach((appNode) => {
            const app = appNode.value;

            if (!app) {
                throw new SyntaxError(`Empty app specified in "${apps}"`);
            }

            if (appNode.exception) {
                restrictedApps.push(app);
            } else {
                permittedApps.push(app);
            }
        });

        this.restrictedApps = restrictedApps.length > 0 ? restrictedApps : null;
        this.permittedApps = permittedApps.length > 0 ? permittedApps : null;
    }
}
