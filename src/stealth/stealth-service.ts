import { Request, RequestType } from '../request';
import { NetworkRule } from '../rules/network-rule';

/**
 * Stealth service configuration
 */
export interface StealthConfig {
    /**
     * Is strip tracking query params enabled
     */
    stripTrackingParameters: boolean;

    /**
     * Parameters to clean
     */
    trackingParameters: string;

    /**
     * Is destruct first-party cookies enabled
     */
    selfDestructFirstPartyCookies: boolean;

    /**
     * Cookie maxAge in minutes
     */
    selfDestructFirstPartyCookiesTime: number;

    /**
     * Is destruct third-party cookies enabled
     */
    selfDestructThirdPartyCookies: boolean;

    /**
     * Cookie maxAge in minutes
     */
    selfDestructThirdPartyCookiesTime: number;
}

/**
 * Stealth service module
 */
export class StealthService {
    /**
     * Configuration
     */
    private readonly config: StealthConfig;

    /**
     * Constructor
     *
     * @param config
     */
    constructor(config: StealthConfig) {
        this.config = config;
    }

    /**
     * Strips out the tracking codes/parameters from a URL and return the cleansed URL
     *
     * @param request
     */
    public removeTrackersFromUrl(request: Request): string | null {
        if (!this.config.stripTrackingParameters) {
            return null;
        }

        const { url, requestType } = request;
        if (requestType !== RequestType.Document) {
            return null;
        }

        const urlPieces = url.split('?');

        // If no params, nothing to modify
        if (urlPieces.length === 1) {
            return null;
        }

        const trackingParameters = this.config.trackingParameters
            .trim()
            .split(',')
            .map((x) => x.replace('=', '').replace(/\*/g, '[^&#=]*').trim())
            .filter((x) => x);

        const trackingParametersRegExp = new RegExp(`((^|&)(${trackingParameters.join('|')})=[^&#]*)`, 'ig');
        urlPieces[1] = urlPieces[1].replace(trackingParametersRegExp, '');

        // If we've collapsed the URL to the point where there's an '&' against the '?'
        // then we need to get rid of that.
        while (urlPieces[1].charAt(0) === '&') {
            urlPieces[1] = urlPieces[1].substr(1);
        }

        const result = urlPieces[1] ? urlPieces.join('?') : urlPieces[0];

        if (result !== url) {
            return result;
        }

        return null;
    }

    /**
     * Returns synthetic set of rules matching the specified request
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public getCookieRules(request: Request): NetworkRule[] {
        const result: NetworkRule[] = [];

        // Remove cookie header for first-party requests
        const blockCookies = this.config.selfDestructFirstPartyCookies;
        if (blockCookies) {
            result.push(StealthService.generateRemoveRule(this.config.selfDestructFirstPartyCookiesTime));
        }

        const blockThirdPartyCookies = this.config.selfDestructThirdPartyCookies;
        if (!blockThirdPartyCookies) {
            return result;
        }

        // eslint-disable-next-line prefer-destructuring
        const thirdParty = request.thirdParty;
        const isMainFrame = request.requestType === RequestType.Document;

        if (thirdParty && !isMainFrame) {
            result.push(StealthService.generateRemoveRule(this.config.selfDestructThirdPartyCookiesTime));
        }

        return result;
    }

    /**
     * Generates rule removing cookies
     *
     * @param {number} maxAgeMinutes Cookie maxAge in minutes
     */
    private static generateRemoveRule(maxAgeMinutes: number): NetworkRule {
        const maxAgeOption = maxAgeMinutes > 0 ? `;maxAge=${maxAgeMinutes * 60}` : '';
        return new NetworkRule(`$cookie=/.+/${maxAgeOption}`, 0);
    }
}
