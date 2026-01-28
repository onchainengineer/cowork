"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const muxGatewayOAuth_1 = require("./muxGatewayOAuth");
(0, bun_test_1.describe)("muxGatewayOAuth", () => {
    (0, bun_test_1.test)("buildAuthorizeUrl includes required params", () => {
        const urlString = (0, muxGatewayOAuth_1.buildAuthorizeUrl)({
            redirectUri: "http://localhost:1234/callback",
            state: "abc123",
        });
        const url = new URL(urlString);
        (0, bun_test_1.expect)(url.origin).toBe(muxGatewayOAuth_1.MUX_GATEWAY_ORIGIN);
        (0, bun_test_1.expect)(url.pathname).toBe("/oauth2/authorize");
        (0, bun_test_1.expect)(url.searchParams.get("response_type")).toBe("code");
        (0, bun_test_1.expect)(url.searchParams.get("client_id")).toBe("mux-client");
        (0, bun_test_1.expect)(url.searchParams.get("redirect_uri")).toBe("http://localhost:1234/callback");
        (0, bun_test_1.expect)(url.searchParams.get("state")).toBe("abc123");
    });
    (0, bun_test_1.test)("buildExchangeBody includes required fields", () => {
        const body = (0, muxGatewayOAuth_1.buildExchangeBody)({ code: "jwt-code" });
        (0, bun_test_1.expect)(body.get("grant_type")).toBe("authorization_code");
        (0, bun_test_1.expect)(body.get("code")).toBe("jwt-code");
        (0, bun_test_1.expect)(body.get("client_id")).toBe("mux-client");
        (0, bun_test_1.expect)(body.get("client_secret")).toBe("mux-client");
    });
});
//# sourceMappingURL=muxGatewayOAuth.test.js.map