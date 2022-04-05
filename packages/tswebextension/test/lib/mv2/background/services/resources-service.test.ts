import browser from 'sinon-chrome';
import { ResourcesService } from '@lib/mv2/background/services/resources-service';

global.fetch = jest.fn(() => {
    return Promise.resolve({
        text: () => Promise.resolve('test response'),
    } as unknown as Response);
});

browser.runtime.getURL.callsFake((str: string) => (str === '/' ? 'test' : `test${str}`));

const resourcesService = new ResourcesService(() => '12345');

describe('Resources Service', () => {
    it('guards web accessible resources', () => {
        resourcesService.init('war');

        expect(browser.webRequest.onBeforeRequest.addListener.calledOnce);

        // TODO: spy guardWar callback returns

        browser.webRequest.onBeforeRequest.dispatch({
            url: 'test/war/resources/path',
        });

        browser.webRequest.onBeforeRequest.dispatch({
            url: 'test/war/resources/path?secret=12345',
        });

        resourcesService.stop();

        expect(browser.webRequest.onBeforeRequest.removeListener.calledOnce);
    });

    it('creates resource url', () => {
        expect(() => {
            resourcesService.createResourceUrl('resources/path');
        }).toThrow();

        resourcesService.init('war');
        expect(resourcesService.createResourceUrl('resources/path'))
            .toBe('test/war/resources/path?secret=12345');
        resourcesService.stop();
    });

    it('loads Resource', async () => {
        await expect(resourcesService.loadResource('test')).rejects.toThrow();

        resourcesService.init('war');
        expect(await resourcesService.loadResource('test'))
            .toBe('test response');
        resourcesService.stop();
    });
});
