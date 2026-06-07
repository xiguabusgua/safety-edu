/**
 * 平台配置表 — 所有平台相关元数据(名称、登录方式、价格)集中在这里。
 * 新增平台只需要在这里加一项,业务代码 (Submit.tsx / Progress.tsx) 通过 id 引用。
 *
 * - loginUrl:江苏平台微信扫码登录地址(空字符串表示"账号密码登录,无扫码入口")
 * - loginHelp:用户提示语,告诉用户怎么登录这个平台
 * - price:单位"分",渲染时除以 100 显示成元。统一后端定价的入口
 */

export type PlatformId = 'weban' | 'jiangsu';

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  /** 微信扫码登录地址,空字符串 = 不支持扫码 */
  loginUrl: string;
  /** 给用户看的登录方式说明 */
  loginHelp: string;
  /** 单价(分) */
  price: number;
}

export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  weban: {
    id: 'weban',
    name: '安全微伴',
    loginUrl: '',
    loginHelp: '账号密码',
    price: 500, // ¥5
  },
  jiangsu: {
    id: 'jiangsu',
    name: '江苏安全通',
    loginUrl:
      'http://wap.xiaoyuananquantong.com/guns-vip-main/wap/wapJSLogin',
    loginHelp: '微信扫码后粘 URL',
    price: 500, // ¥5
  },
};

/** 列表展示用,顺序固定(weban 在前) */
export const PLATFORM_LIST: PlatformConfig[] = [
  PLATFORMS.weban,
  PLATFORMS.jiangsu,
];

/** 按 id 取配置,找不到就 fallback weban(防御性,不应该发生) */
export function getPlatform(id: string | undefined): PlatformConfig {
  if (id === 'jiangsu') return PLATFORMS.jiangsu;
  return PLATFORMS.weban;
}
