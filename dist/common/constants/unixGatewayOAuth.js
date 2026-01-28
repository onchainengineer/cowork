"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNIX_GATEWAY_EXCHANGE_URL = exports.UNIX_GATEWAY_AUTHORIZE_URL = exports.UNIX_GATEWAY_CLIENT_SECRET = exports.UNIX_GATEWAY_CLIENT_ID = exports.UNIX_GATEWAY_ORIGIN = void 0;
exports.buildAuthorizeUrl = buildAuthorizeUrl;
exports.buildExchangeBody = buildExchangeBody;
exports.UNIX_GATEWAY_ORIGIN = "";
exports.UNIX_GATEWAY_CLIENT_ID = "unix-client";
exports.UNIX_GATEWAY_CLIENT_SECRET = "unix-client";
exports.UNIX_GATEWAY_AUTHORIZE_URL = `${exports.UNIX_GATEWAY_ORIGIN}/oauth2/authorize`;
exports.UNIX_GATEWAY_EXCHANGE_URL = `${exports.UNIX_GATEWAY_ORIGIN}/api/v1/oauth2/exchange`;
function buildAuthorizeUrl(input) {
    const url = new URL(exports.UNIX_GATEWAY_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", exports.UNIX_GATEWAY_CLIENT_ID);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("state", input.state);
    return url.toString();
}
function buildExchangeBody(input) {
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", input.code);
    body.set("client_id", exports.UNIX_GATEWAY_CLIENT_ID);
    body.set("client_secret", exports.UNIX_GATEWAY_CLIENT_SECRET);
    return body;
}
//# sourceMappingURL=unixGatewayOAuth.js.map