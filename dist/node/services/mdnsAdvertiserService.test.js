"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const mdnsAdvertiserService_1 = require("./mdnsAdvertiserService");
(0, bun_test_1.describe)("buildUnixMdnsServiceOptions", () => {
    (0, bun_test_1.test)("0.0.0.0 disables IPv6 and avoids advertising loopback addresses", () => {
        const networkInterfaces = {
            lo0: [
                {
                    address: "127.0.0.1",
                    netmask: "255.0.0.0",
                    family: "IPv4",
                    mac: "00:00:00:00:00:00",
                    internal: true,
                    cidr: "127.0.0.1/8",
                },
            ],
            en0: [
                {
                    address: "192.168.1.10",
                    netmask: "255.255.255.0",
                    family: "IPv4",
                    mac: "00:00:00:00:00:00",
                    internal: false,
                    cidr: "192.168.1.10/24",
                },
            ],
        };
        const serviceOptions = (0, mdnsAdvertiserService_1.buildUnixMdnsServiceOptions)({
            bindHost: "0.0.0.0",
            port: 3000,
            instanceName: "unix-test",
            version: "0.0.0-test",
            authRequired: true,
            networkInterfaces,
        });
        (0, bun_test_1.expect)(serviceOptions.type).toBe(mdnsAdvertiserService_1.UNIX_MDNS_SERVICE_TYPE);
        (0, bun_test_1.expect)(serviceOptions.protocol).toBe("tcp" /* Protocol.TCP */);
        (0, bun_test_1.expect)(serviceOptions.disabledIpv6).toBe(true);
        (0, bun_test_1.expect)(serviceOptions.restrictedAddresses).toEqual(["en0"]);
    });
    (0, bun_test_1.test)("IPv6 wildcard avoids advertising loopback addresses", () => {
        const networkInterfaces = {
            lo0: [
                {
                    address: "::1",
                    netmask: "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff",
                    family: "IPv6",
                    mac: "00:00:00:00:00:00",
                    internal: true,
                    cidr: "::1/128",
                    scopeid: 0,
                },
            ],
            en0: [
                {
                    address: "2001:db8::1",
                    netmask: "ffff:ffff:ffff:ffff::",
                    family: "IPv6",
                    mac: "00:00:00:00:00:00",
                    internal: false,
                    cidr: "2001:db8::1/64",
                    scopeid: 0,
                },
            ],
            awdl0: [
                {
                    address: "fe80::1",
                    netmask: "ffff:ffff:ffff:ffff::",
                    family: "IPv6",
                    mac: "00:00:00:00:00:00",
                    internal: false,
                    cidr: "fe80::1/64",
                    scopeid: 0,
                },
            ],
        };
        const serviceOptions = (0, mdnsAdvertiserService_1.buildUnixMdnsServiceOptions)({
            bindHost: "::",
            port: 3000,
            instanceName: "unix-test",
            version: "0.0.0-test",
            authRequired: false,
            networkInterfaces,
        });
        (0, bun_test_1.expect)(serviceOptions.restrictedAddresses).toEqual(["en0"]);
        (0, bun_test_1.expect)(serviceOptions.disabledIpv6).toBeUndefined();
    });
    (0, bun_test_1.test)("sanitizes dots in instanceName so DNS-SD clients can browse/resolve", () => {
        const serviceOptions = (0, mdnsAdvertiserService_1.buildUnixMdnsServiceOptions)({
            bindHost: "192.168.1.10",
            port: 3000,
            instanceName: "unix-host.home",
            version: "0.0.0-test",
            authRequired: false,
        });
        (0, bun_test_1.expect)(serviceOptions.name).toBe("unix-host-home");
    });
    (0, bun_test_1.test)("specific IP restricts addresses", () => {
        const serviceOptions = (0, mdnsAdvertiserService_1.buildUnixMdnsServiceOptions)({
            bindHost: "192.168.1.10",
            port: 3000,
            instanceName: "unix-test",
            version: "0.0.0-test",
            authRequired: false,
        });
        (0, bun_test_1.expect)(serviceOptions.restrictedAddresses).toEqual(["192.168.1.10"]);
        (0, bun_test_1.expect)(serviceOptions.disabledIpv6).toBeUndefined();
    });
});
//# sourceMappingURL=mdnsAdvertiserService.test.js.map