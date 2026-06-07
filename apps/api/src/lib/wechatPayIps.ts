/**
 * 微信支付 V3 回调(异步通知)官方 IP 段白名单。
 *
 * 来源(如有更新请同步修改本文件):
 *   https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pay/chapter5_2.shtml
 *   https://pay.weixin.qq.com/wiki/doc/api/native.php?chapter=23_2&index=2
 *
 * 微信回调服务器会从这些 IP 段向你部署的 notify-url 发起 POST 通知。
 * 部署在反代 / 容器 / 云函数后面时,务必让反代把真实客户端 IP 透传(req.ip / x-forwarded-for)
 * 然后用本白名单做最后一道过滤,防止伪造 notify 触发"已支付"状态翻转。
 */
export const WECHAT_NOTIFY_IPS: string[] = [
  '14.215.32.0/19',      // 上海
  '101.226.103.0/24',    // 上海
  '101.226.226.0/24',    // 上海
  '101.227.11.0/24',     // 上海
  '121.51.0.0/16',       // 上海
  '140.143.0.0/16',      // 深圳
  '183.61.0.0/16',       // 深圳
  '203.205.128.0/17',    // 香港
  '203.205.192.0/18',    // 香港
  '58.247.206.0/24',     // 上海
  '8.129.0.0/16',        // 深圳
];

/**
 * IPv4 CIDR 匹配(支持 /0 ~ /32)。
 * 输入不做 IPv6 校验(微信回调目前只用 IPv4)。
 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function matchCidr(ip: string, cidr: string): boolean {
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return false;
  const [base, prefixStr] = cidr.split('/');
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  if (prefix === 0) return true;
  const mask = (~((1 << (32 - prefix)) - 1)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

/**
 * 检查给定 IP 是否落在微信支付官方回调 IP 段内。
 * 接受带端口或 ::ffff: 前缀的 IP 字符串(从 req.ip 拿到的常见形态)。
 */
export function isWechatNotifyIp(ip: string | undefined | null): boolean {
  if (!ip) return false;
  // Express 形如 "::ffff:127.0.0.1" 或 "127.0.0.1" 或 "::1"
  let clean = ip.trim();
  if (clean.startsWith('::ffff:')) clean = clean.slice(7);
  // 不处理纯 IPv6,微信回调目前只发 IPv4
  if (clean.includes(':') && !clean.includes('.')) return false;
  // 去端口
  const portIdx = clean.lastIndexOf(':');
  if (portIdx > -1 && clean.indexOf(':') === portIdx) {
    clean = clean.slice(0, portIdx);
  }
  return WECHAT_NOTIFY_IPS.some((cidr) => matchCidr(clean, cidr));
}
