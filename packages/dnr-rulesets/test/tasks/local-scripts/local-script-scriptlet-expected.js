export const localScriptRules = {
    "console.log('js injection')": () => {
        try {
            const flag = "done";
            if (Window.prototype.toString["test-id"] === flag) {
                return;
            }
            console.log("js injection");
            Object.defineProperty(Window.prototype.toString, "test-id", {
                value: flag,
                enumerable: false,
                writable: false,
                configurable: false
            });
        } catch (error) {
            console.error('Error executing AG js rule with uniqueId "test-id" due to: ' + error);
        }
    },
    "document.body.style.background = 'red'": () => {
        try {
            const flag = "done";
            if (Window.prototype.toString["test-id"] === flag) {
                return;
            }
            document.body.style.background = "red";
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