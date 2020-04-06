import { JSDOM } from 'jsdom';
import ElementUtils from '../../src/content-script/element-utils';

describe('Element utils', () => {
    const dom = new JSDOM(`
            <!DOCTYPE html>
            <p>test</p>
            <div id="testDiv">
                <div id="childDiv"></div>
            </div>
        `);
    const element = dom.window.document.querySelector('#testDiv') as Element;

    it('checks element to string', () => {
        expect(ElementUtils.elementToString(element)).toBe('<div id="testDiv">');
    });

    it('checks appendChildren', () => {
        const elements: Element[] = [];
        ElementUtils.appendChildren(element, elements);

        expect(elements).toHaveLength(1);
        expect(elements[0].id).toBe('childDiv');
    });

    it('checks addUnique', () => {
        const elements: Element[] = [];
        ElementUtils.addUnique(elements, [element]);

        expect(elements).toHaveLength(1);
        expect(elements[0].id).toBe('testDiv');

        // Once more
        ElementUtils.addUnique(elements, [element]);

        expect(elements).toHaveLength(1);
        expect(elements[0].id).toBe('testDiv');
    });

    it('checks removeElements', () => {
        const elements: Element[] = [];
        ElementUtils.appendChildren(element, elements);
        ElementUtils.removeElements(elements);

        const result = dom.window.document.querySelector('#testDiv');
        expect(result).not.toBeNull();
    });
});
