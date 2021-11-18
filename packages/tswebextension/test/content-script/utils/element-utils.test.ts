/**
 * @jest-environment jsdom
 */

import ElementUtils from '../../../src/content-script/utils/element-utils';

describe('Element utils', () => {
    document.body.innerHTML = `
        <p>test</p>
        <div id="testDiv">
            <div id="childDiv"></div>
         </div>
        `;
    const element = document.querySelector('#testDiv') as Element;

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

        const result = document.querySelector('#testDiv');
        expect(result).not.toBeNull();
    });
});
