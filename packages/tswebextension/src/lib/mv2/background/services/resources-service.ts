import browser, { WebRequest } from 'webextension-polyfill';

export interface ResourcesServiceInterface {
    init: (warDir: string) => void;
    stop: () => void;

    createResourceUrl: (path: string) => string;
    loadResource: (path: string) => Promise<string>;
}

/**
 * Foil ability of web pages to identify extension through its web accessible resources.
 *
 * Inspired by:
 * https://github.com/gorhill/uBlock/blob/7f999b759fe540e457e297363f55b25d9860dd3e/platform/chromium/vapi-background
 */
export class ResourcesService implements ResourcesServiceInterface {
    private secrets: string[] = [];

    private root = browser.runtime.getURL('/');

    private lastSecretTime = 0;

    private warDir: string | undefined;

    private generateSecretKey: () => string;

    constructor(generateSecretKey: () => string) {
        this.generateSecretKey = generateSecretKey;
        this.guardWar = this.guardWar.bind(this);
    }

    public init(warDir: string): void {
        this.warDir = warDir;

        const filter: WebRequest.RequestFilter = {
            urls: [`${this.root}${this.warDir}/*`],
        };

        const extraInfoSpec: WebRequest.OnBeforeRequestOptions[] = ['blocking'];

        browser.webRequest.onBeforeRequest.addListener(this.guardWar, filter, extraInfoSpec);
    }

    public stop(): void {
        this.warDir = undefined;
        this.secrets = [];
        browser.webRequest.onBeforeRequest.removeListener(this.guardWar);
    }

    /**
     * Create url for war file
     */
    public createResourceUrl(path: string): string {
        if (!this.warDir) {
            throw new Error('Resources path is not defined. Did you init the service?');
        }

        return browser.runtime.getURL(`/${this.warDir}/${path}${this.createSecretParam()}`);
    }

    /**
     * Load war resource by path
     */
    public async loadResource(path: string): Promise<string> {
        const url = this.createResourceUrl(path);
        const response = await fetch(url);
        return response.text();
    }

    private createSecretParam(): string {
        if (this.secrets.length !== 0) {
            if ((Date.now() - this.lastSecretTime) > 5000) {
                this.secrets.splice(0);
            } else if (this.secrets.length > 256) {
                this.secrets.splice(0, this.secrets.length - 192);
            }
        }
        this.lastSecretTime = Date.now();
        const secret = this.generateSecretKey();
        this.secrets.push(secret);
        return `?secret=${secret}`;
    }

    private guardWar(details: WebRequest.OnBeforeRequestDetailsType) {
        const { url } = details;
        const pos = this.secrets.findIndex((secret) => url.lastIndexOf(`?secret=${secret}`) !== -1);
        if (pos === -1) {
            return { redirectUrl: this.root };
        }

        this.secrets.splice(pos, 1);
    }
}

export const resourcesService = new ResourcesService(() => {
    return Math.floor(Math.random() * 982451653 + 982451653).toString(36);
});
