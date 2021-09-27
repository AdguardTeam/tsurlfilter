export interface IAppModifier {
    permittedApps: string[] | null;
    restrictedApps: string[] | null;
}

/**
 * This is a helper class that is used specifically to work with app restrictions.
 *
 * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#app
 *
 * Examples:
 * ||baddomain.com^$app=org.example.app
 * ||baddomain.com^$app=org.example.app1|org.example.app2
 */
export class AppModifier implements IAppModifier {
    /** list of permitted apps or null */
    public readonly permittedApps: string[] | null;

    /** list of restricted apps or null */
    public readonly restrictedApps: string[] | null;

    /**
     * Separator between apps
     */
    private readonly APPS_SEPARATOR: string = '|';

    /**
     * Parses the `apps` string
     *
     * @param apps - apps string
     *
     * @throws an error if the app string is empty or invalid
     */
    constructor(apps: string) {
        if (!apps) {
            throw new SyntaxError('$app modifier cannot be empty');
        }

        const permittedApps: string[] = [];
        const restrictedApps: string[] = [];

        const parts = apps.split(this.APPS_SEPARATOR);
        for (let i = 0; i < parts.length; i += 1) {
            let app = parts[i];
            let restricted = false;
            if (app.startsWith('~')) {
                restricted = true;
                app = app.substring(1).trim();
            }

            if (app === '') {
                throw new SyntaxError(`Empty app specified in "${apps}"`);
            }

            if (restricted) {
                restrictedApps.push(app);
            } else {
                permittedApps.push(app);
            }
        }

        this.restrictedApps = restrictedApps.length > 0 ? restrictedApps : null;
        this.permittedApps = permittedApps.length > 0 ? permittedApps : null;
    }
}
