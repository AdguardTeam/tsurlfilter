"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logShowProjectCommand = void 0;
const nx_1 = require("../../nx");
function logShowProjectCommand(projectName) {
    const { output } = (0, nx_1.requireNx)();
    output.log({
        title: `👀 View Details of ${projectName}`,
        bodyLines: [
            `Run "nx show project ${projectName} --web" to view details about this project.`,
        ],
    });
}
exports.logShowProjectCommand = logShowProjectCommand;
