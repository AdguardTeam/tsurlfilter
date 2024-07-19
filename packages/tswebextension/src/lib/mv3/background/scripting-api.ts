/**
 *
 */
export class ScriptingApi {
    /**
     *
     * @param css
     * @param tabId
     * @param frameId
     */
    public static async injectCss(css: string, tabId: number, frameId: number): Promise<void> {
        try {
            await chrome.scripting.insertCSS({
                css,
                origin: 'USER',
                target: { tabId, frameIds: [frameId] },
            });
        } catch (e) {
            console.log(e);
        }
    }
}
