"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const unixGatewayOAuth_1 = require("./unixGatewayOAuth");
(0, bun_test_1.describe)("unixGatewayOAuth", () => {
    (0, bun_test_1.test)("buildAuthorizeUrl includes required params", () => {
        const urlString = (0, unixGatewayOAuth_1.buildAuthorizeUrl)({
            redirectUri: "http://localhost:1234/callback",
            state: "abc123",
        });
        const url = new URL(urlString);
        (0, bun_test_1.expect)(url.origin).toBe(unixGatewayOAuth_1.UNIX_GATEWAY_ORIGIN);
        (0, bun_test_1.expect)(url.pathname).toBe("/oauth2/authorize");
        (0, bun_test_1.expect)(url.searchParams.get("response_type")).toBe("code");
        (0, bun_test_1.expect)(url.searchParams.get("client_id")).toBe("unix-client");
        (0, bun_test_1.expect)(url.searchParams.get("redirect_uri")).toBe("http://localhost:1234/callback");
        (0, bun_test_1.expect)(url.searchParams.get("state")).toBe("abc123");
    });
    (0, bun_test_1.test)("buildExchangeBody includes required fields", () => {
        const body = (0, unixGatewayOAuth_1.buildExchangeBody)({ code: "jwt-code" });
        (0, bun_test_1.expect)(body.get("grant_type")).toBe("authorization_code");
        (0, bun_test_1.expect)(body.get("code")).toBe("jwt-code");
        (0, bun_test_1.expect)(body.get("client_id")).toBe("unix-client");
        (0, bun_test_1.expect)(body.get("client_secret")).toBe("unix-client");
    });
});
//# sourceMappingURL=unixGatewayOAuth.test.js.map