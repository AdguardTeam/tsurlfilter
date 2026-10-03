import browser from 'webextension-polyfill';

import { BrowserStorage } from '../storage/core';

import { type Available, type ProtectionSession } from './contracts';

const SESSION_KEY = 'tswebextension.canvasProtectionSession';

let queue: Promise<void> = Promise.resolve();
let initialization: Promise<Available<ProtectionSession>> | undefined;

/**
 * Creates an independent 128-bit random value encoded as lowercase hex.
 *
 * @returns A 16-byte random value.
 */
const randomHex = (): string => Array.from(
    crypto.getRandomValues(new Uint8Array(16)),
    (byte) => byte.toString(16).padStart(2, '0'),
).join('');

/**
 * Reads or initializes the trusted root in extension session storage.
 *
 * @returns The shared current session or its unavailable storage dependency.
 */
const initialize = async (): Promise<Available<ProtectionSession>> => {
    if (!browser.storage.session) {
        return { status: 'unavailable', reason: 'Extension storage.session is unavailable' };
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.session?.setAccessLevel) {
        await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    }
    const storage = new BrowserStorage<ProtectionSession>(browser.storage.session);
    let session = await storage.get(SESSION_KEY);
    if (session === undefined) {
        session = { root: randomHex(), generation: randomHex() };
        await storage.set(SESSION_KEY, session);
    }
    return { status: 'available', value: Object.freeze(session) };
};

/**
 * Shares concurrent initialization while allowing native session-storage resets.
 *
 * @returns The current browser-profile session, or unavailable storage.
 */
export const getProtectionSession = (): Promise<Available<ProtectionSession>> => {
    if (initialization) {
        return initialization;
    }
    const request = queue.then(initialize);
    initialization = request;
    queue = request.then(() => undefined, () => undefined);
    const clear = (): void => {
        if (initialization === request) {
            initialization = undefined;
        }
    };
    request.then(clear, clear);
    return request;
};
