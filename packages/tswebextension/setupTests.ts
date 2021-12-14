import SinonChrome from 'sinon-chrome';

jest.mock('webextension-polyfill', () => SinonChrome);