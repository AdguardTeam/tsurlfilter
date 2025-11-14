export const localScriptRules = {
    "console.log('valid')": () => {
        try {
            const flag = "done";
            if (Window.prototype.toString["test-id"] === flag) {
                return;
            }
            console.log("valid");
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
    "alert('another valid')": () => {
        try {
            const flag = "done";
            if (Window.prototype.toString["test-id"] === flag) {
                return;
            }
            alert("another valid");
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