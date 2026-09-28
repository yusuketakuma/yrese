import { describe, expect, it } from 'vitest';

import {
  PartnerEndpointPolicyError,
  assertPublicHttpsEndpoint,
  assertResolvesToPublicAddress,
} from './partner-endpoint-policy.js';

describe('assertPublicHttpsEndpoint', () => {
  it('accepts a public https endpoint on the default port', () => {
    expect(() =>
      assertPublicHttpsEndpoint(new URL('https://hooks.partner.example/yrese')),
    ).not.toThrow();
    expect(() =>
      assertPublicHttpsEndpoint(
        new URL('https://hooks.partner.example:443/yrese'),
      ),
    ).not.toThrow();
  });

  it.each([
    ['http://hooks.partner.example/yrese', 'scheme'],
    ['https://hooks.partner.example:8443/yrese', 'port'],
    ['https://user:pw@hooks.partner.example/yrese', 'credentials'],
    ['https://localhost/yrese', 'not public'],
    ['https://api.internal/yrese', 'not public'],
    ['https://metadata.google.internal/computeMetadata/v1', 'not public'],
    ['https://127.0.0.1/yrese', 'private ipv4'],
    ['https://10.1.2.3/yrese', 'private ipv4'],
    ['https://169.254.169.254/latest/meta-data', 'private ipv4'],
    ['https://172.31.0.1/yrese', 'private ipv4'],
    ['https://192.168.1.1/yrese', 'private ipv4'],
    ['https://[::1]/yrese', 'private ipv6'],
    ['https://[fd00::1]/yrese', 'private ipv6'],
    ['https://203.0.113.9/yrese', 'ip literal'],
    ['https://intranet/yrese', 'public dns name'],
    ['https://localhost./yrese', 'not public'],
    ['https://api.internal./yrese', 'not public'],
    ['https://metadata.google.internal./v1', 'not public'],
    ['https://db.local./yrese', 'not public'],
    ['https://[::ffff:127.0.0.1]/yrese', 'private ipv6'],
    ['https://[::ffff:7f00:1]/yrese', 'private ipv6'],
    // fe80::/10 link-local の全範囲(fe80–febf)。prefix 文字列比較は fe90/febf を取り逃す。
    ['https://[fe80::1]/yrese', 'private ipv6'],
    ['https://[fe90::1]/yrese', 'private ipv6'],
    ['https://[febf::ffff]/yrese', 'private ipv6'],
    // site-local(廃止)・ULA・multicast。
    ['https://[fec0::1]/yrese', 'private ipv6'],
    ['https://[fc00::1]/yrese', 'private ipv6'],
    ['https://[ff02::1]/yrese', 'private ipv6'],
    // loopback / unspecified の非圧縮・別表記。
    ['https://[0:0:0:0:0:0:0:1]/yrese', 'private ipv6'],
    ['https://[0:0:0:0:0:0:0:0]/yrese', 'private ipv6'],
    // IPv4-compatible(::/96)埋め込みの private IPv4。
    ['https://[::127.0.0.1]/yrese', 'private ipv6'],
    ['https://[::7f00:1]/yrese', 'private ipv6'],
    // IPv4-translated(::ffff:0:0/96)埋め込みの private IPv4。
    ['https://[::ffff:0:127.0.0.1]/yrese', 'private ipv6'],
    ['https://[::ffff:0:7f00:1]/yrese', 'private ipv6'],
    // NAT64 / Teredo / 6to4 / 文書用・discard 等特殊用途。
    ['https://[64:ff9b::7f00:1]/yrese', 'private ipv6'],
    ['https://[2001::7f00:1]/yrese', 'private ipv6'],
    ['https://[2002:7f00:1::]/yrese', 'private ipv6'],
    ['https://[3fff::1]/yrese', 'private ipv6'],
    ['https://[100::]/yrese', 'private ipv6'],
  ])('rejects %s (%s)', (url, reason) => {
    expect(() => assertPublicHttpsEndpoint(new URL(url))).toThrow(
      PartnerEndpointPolicyError,
    );
    try {
      assertPublicHttpsEndpoint(new URL(url));
    } catch (error) {
      expect((error as PartnerEndpointPolicyError).reason).toContain(reason);
    }
  });

  it('still accepts public IPv6 resolved addresses', async () => {
    // 誤検知抑止: assertPublicHttpsEndpoint は IP リテラルを一律拒否する設計
    // のため、public IPv6 の受理は DNS 解決後の assertResolvesToPublicAddress
    // 層で検証する。判定が「全 v6 = private」の過剰拒否に倒れないことを固定する。
    await expect(
      assertResolvesToPublicAddress(new URL('https://hooks.partner.example/yrese'), async () => [
        { address: '2606:4700:4700::1111', family: 6 },
      ]),
    ).resolves.toBeUndefined();
    // mapped/public 埋め込みは public 扱い。
    await expect(
      assertResolvesToPublicAddress(new URL('https://hooks.partner.example/yrese'), async () => [
        { address: '::ffff:8.8.8.8', family: 6 },
      ]),
    ).resolves.toBeUndefined();
  });

  it('requires every resolved address to be public (DNS re-resolution)', async () => {
    const url = new URL('https://hooks.partner.example/yrese');
    await expect(
      assertResolvesToPublicAddress(url, async () => [
        { address: '203.0.113.9', family: 4 },
      ]),
    ).resolves.toBeUndefined();
    await expect(
      assertResolvesToPublicAddress(url, async () => [
        { address: '203.0.113.9', family: 4 },
        { address: '10.0.0.5', family: 4 },
      ]),
    ).rejects.toThrow(/private address/);
    await expect(
      assertResolvesToPublicAddress(url, async () => [
        { address: '::ffff:169.254.169.254', family: 6 },
      ]),
    ).rejects.toThrow(/private address/);
    await expect(
      assertResolvesToPublicAddress(url, async () => [
        { address: '::ffff:0:169.254.169.254', family: 6 },
      ]),
    ).rejects.toThrow(/private address/);
    await expect(
      assertResolvesToPublicAddress(url, async () => []),
    ).rejects.toThrow(/does not resolve/);
    await expect(
      assertResolvesToPublicAddress(url, async () => {
        throw new Error('ENOTFOUND');
      }),
    ).rejects.toThrow(/does not resolve/);
  });
});
