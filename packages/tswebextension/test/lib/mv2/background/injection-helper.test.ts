import { buildScriptText } from '@lib/mv2/background/injection-helper';

const timestamp = Date.now();

jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

const trim = (str: string): string => str.replace(/\s+/g, '');

const expectedScriptTemplate = (text: string): string => `(function() {\
    if (window.scriptExecuted${timestamp} || document instanceof XMLDocument) {\
        return;\
    }\
    var script = document.createElement("script");\
    script.setAttribute("type", "text/javascript");\
    script.textContent ="${text}";\
    var FRAME_REQUESTS_LIMIT = 500;\
    var frameRequests = 0;\
    function waitParent () {\
        frameRequests += 1;\
        var parent = document.head || document.documentElement;\
        if (parent) {\
            try {\
                parent.appendChild(script);\
                parent.removeChild(script);\
            } catch (e) {\
            } finally {\
                window.scriptExecuted${timestamp} = true;\
                return true;\
            }\
        }\
        if(frameRequests < FRAME_REQUESTS_LIMIT) {\
            requestAnimationFrame(waitParent);\
        } else {\
            console.log("AdGuard: document.head or document.documentElement were unavailable too long");\
        }\
    }\
    waitParent();\
})()`;

describe('Injection Helper', () => {
    it('builds script text without escaped symbols', () => {
        const scriptText = 'alert(1);';

        const expected = expectedScriptTemplate('alert(1);');

        expect(trim(buildScriptText(scriptText))).toBe(trim(expected));
    });

    it('builds script text with escaped symbols', () => {
        const scriptText = 'alert("hello");\r\n\u2028\u2029';

        const expected = expectedScriptTemplate('alert(\\"hello\\");\\n\\\\u2028\\u2029');

        expect(trim(buildScriptText(scriptText))).toBe(trim(expected));
    });
});
