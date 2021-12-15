import browser from 'sinon-chrome';

jest.mock('webextension-polyfill', () => browser);