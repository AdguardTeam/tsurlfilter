export const localScriptRules = {
    "console.log('test')": () => {
        try {
            const flag = "done";
            if (Window.prototype.toString["test-id"] === flag) {
                return;
            }
            console.log("test");
            Object.defineProperty(Window.prototype.toString, "test-id", {
                value: flag,
                enumerable: false,
                writable: false,
                configurable: false
            });
        } catch (error) {
            console.error('Error executing AG js rule with uniqueId "test-id" due to: ' + error);
        }
    }
};