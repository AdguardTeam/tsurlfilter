import Bowser from 'bowser';

// TODO: consider using common/user-agent from browser-extension instead of bowser

/**
 * BrowserDetector class detects the browser using Bowser library.
 */
export class BrowserDetector {
    /**
     * Bowser parser instance.
     */
    private browserDetector: Bowser.Parser.Parser;

    /**
     * Creates new BrowserDetector instance.
     *
     * @param globalObject Global object — Window or self.
     */
    constructor(
        // eslint-disable-next-line no-restricted-globals
        globalObject: Window | typeof self,
    ) {
        this.browserDetector = Bowser.getParser(globalObject.navigator.userAgent);
    }

    /**
     * Returns the browser.
     *
     * @returns Browser details.
     */
    private getBrowserDetails(): Bowser.Parser.BrowserDetails {
        return this.browserDetector.getBrowser();
    }

    /**
     * Returns the engine.
     *
     * @returns Engine details.
     */
    private engineDetails(): Bowser.Parser.EngineDetails {
        return this.browserDetector.getEngine();
    }

    /**
     * Checks if the browser is Opera.
     *
     * @returns True if the browser is Opera.
     */
    public isOpera(): boolean {
        return this.getBrowserDetails().name === 'Opera';
    }

    /**
     * Checks if the browser is Firefox.
     *
     * @returns True if the browser is Firefox.
     */
    public isFirefox(): boolean {
        return this.getBrowserDetails().name === 'Firefox';
    }

    /**
     * Checks if the browser is Chrome.
     *
     * @returns True if the browser is Chrome.
     */
    public isChrome(): boolean {
        return this.getBrowserDetails().name === 'Chrome';
    }

    /**
     * Checks if the browser is Chromium.
     *
     * @returns True if the browser is Chromium.
     */
    public isChromium(): boolean {
        return this.engineDetails().name === 'Blink';
    }
}
