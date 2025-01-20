import { type WebRequest } from 'webextension-polyfill';

export const getResponseHeaders = (): WebRequest.HttpHeaders => ([
    {
        name: 'date',
        value: 'Thu, 29 Feb 2024 13:11:37 GMT',
    },
    {
        name: 'content-type',
        value: 'text/html;charset=UTF-8',
    },
    {
        name: 'x-dw-request-base-id',
        value: 'tqcP1JhN4GUBAAB_',
    },
    {
        name: 'x-frame-options',
        value: 'SAMEORIGIN',
    },
    {
        name: 'cache-control',
        value: 'no-cache, no-store, must-revalidate',
    },
    {
        name: 'pragma',
        value: 'no-cache',
    },
    {
        name: 'expires',
        value: 'Thu, 01 Dec 1994 16:00:00 GMT',
    },
    {
        name: 'vary',
        value: 'accept-encoding',
    },
    {
        name: 'cf-cache-status',
        value: 'DYNAMIC',
    },
    {
        name: 'strict-transport-security',
        value: 'max-age=15552000; preload',
    },
    {
        name: 'server',
        value: 'cloudflare',
    },
    {
        name: 'cf-ray',
        value: '85d127776dcf9d96-DME',
    },
    {
        name: 'content-encoding',
        value: 'gzip',
    },
    {
        name: 'X-Firefox-Spdy',
        value: 'h2',
    },
]);
