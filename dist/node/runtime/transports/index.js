"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSH2Transport = exports.OpenSSHTransport = void 0;
exports.createSSHTransport = createSSHTransport;
const OpenSSHTransport_1 = require("./OpenSSHTransport");
Object.defineProperty(exports, "OpenSSHTransport", { enumerable: true, get: function () { return OpenSSHTransport_1.OpenSSHTransport; } });
const SSH2Transport_1 = require("./SSH2Transport");
Object.defineProperty(exports, "SSH2Transport", { enumerable: true, get: function () { return SSH2Transport_1.SSH2Transport; } });
function createSSHTransport(config, useSSH2) {
    return useSSH2 ? new SSH2Transport_1.SSH2Transport(config) : new OpenSSHTransport_1.OpenSSHTransport(config);
}
//# sourceMappingURL=index.js.map