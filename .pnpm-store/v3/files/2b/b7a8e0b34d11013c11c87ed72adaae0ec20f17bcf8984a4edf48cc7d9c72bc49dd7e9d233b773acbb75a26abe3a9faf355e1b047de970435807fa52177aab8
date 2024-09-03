"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_1 = require("path");
const pseudo_ipc_1 = require("./pseudo-ipc");
const pseudoIPCPath = process.argv[2];
const forkId = process.argv[3];
const script = (0, path_1.join)(__dirname, '../../bin/run-executor.js');
const childProcess = (0, child_process_1.fork)(script, {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
});
const pseudoIPC = new pseudo_ipc_1.PseudoIPCClient(pseudoIPCPath);
pseudoIPC.onMessageFromParent(forkId, (message) => {
    childProcess.send(message);
});
pseudoIPC.notifyChildIsReady(forkId);
process.on('message', (message) => {
    pseudoIPC.sendMessageToParent(message);
});
childProcess.on('exit', (code) => {
    pseudoIPC.close();
    process.exit(code);
});
