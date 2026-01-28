"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = createClient;
const client_1 = require("@orpc/client");
function createClient(link) {
    return (0, client_1.createORPCClient)(link);
}
//# sourceMappingURL=client.js.map