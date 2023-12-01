import browser, { WebRequest } from 'webextension-polyfill';

export interface ResourcesServiceInterface {
    init: (warDir: string) => void;
    stop: () => void;

    createResourceUrl: (path: string, params: URLSearchParams) => string;
    loadResource: (path: string) => Promise<string>;
}

/**
 * Prevent web pages to identify extension through its web accessible resources.
 *
 * Inspired by:
 *  https://github.com/gorhill/uBlock/blob/7f999b759fe540e457e297363f55b25d9860dd3e/platform/chromium/vapi-background.
 */
export class ResourcesService implements ResourcesServiceInterface {
    private secrets: string[] = [];

    private root = browser.runtime.getURL('/');

    private lastSecretTime = 0;

    private warDir: string | undefined;

    private generateSecretKey: () => string;

    /**
     * Constructor.
     *
     * @param generateSecretKey Function to generate secret key.
     */
    constructor(generateSecretKey: () => string) {
        this.generateSecretKey = generateSecretKey;
        this.guardWar = this.guardWar.bind(this);
    }

    /**
     * Init service.
     *
     * @param warDir Web accessible resources directory.
     */
    public init(warDir: string): void {
        this.warDir = warDir;

        const filter: WebRequest.RequestFilter = {
            urls: [`${this.root}${this.warDir}/*`],
        };

        const extraInfoSpec: WebRequest.OnBeforeRequestOptions[] = ['blocking'];

        browser.webRequest.onBeforeRequest.addListener(this.guardWar, filter, extraInfoSpec);
    }

    /**
     * Stops service.
     */
    public stop(): void {
        this.warDir = undefined;
        this.secrets = [];
        browser.webRequest.onBeforeRequest.removeListener(this.guardWar);
    }

    /**
     * Creates url for war file.
     *
     * @param path Resource relative path.
     * @param params Additional params appended to url, by default empty.
     * @throws Error, if web accessible resources path is not defined.
     *
     * @returns Url to resource with secret param.
     */
    public createResourceUrl(path: string, params: URLSearchParams = new URLSearchParams()): string {
        if (!this.warDir) {
            throw new Error('Resources path is not defined. Did you init the service?');
        }

        const secretParams = new URLSearchParams(this.createSecretParam());
        const resultParams = new URLSearchParams([...secretParams, ...params]);

        return browser.runtime.getURL(`/${this.warDir}/${path}?${resultParams.toString()}`);
    }

    /**
     * Loads war resource by path.
     *
     * @param path Resource relative path.
     *
     * @returns Promise resolved with resource content as a string.
     */
    public async loadResource(path: string): Promise<string> {
        const url = this.createResourceUrl(path);
        const response = await fetch(url);
        return response.text();
    }

    /**
     * Generates secret key, persists it in the secrets array and formats querystring.
     *
     * @returns Querystring with secret.
     */
    private createSecretParam(): string {
        if (this.secrets.length !== 0) {
            // TODO move magic numbers to constants
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

    /**
     * If secret is not found redirects to the main url of extension, otherwise removes secret from the stored values.
     *
     * @param details Web request details.
     * @returns Redirect or nothing.
     */
    private guardWar(details: WebRequest.OnBeforeRequestDetailsType): WebRequest.BlockingResponse | undefined {
        const { url } = details;
        const pos = this.secrets.findIndex((secret) => url.lastIndexOf(`?secret=${secret}`) !== -1);
        if (pos === -1) {
            return { redirectUrl: this.root };
        }

        this.secrets.splice(pos, 1);
        return undefined;
    }
}
