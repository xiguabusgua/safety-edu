/**
 * 单价配置（单位：分）
 * 改这里 → 数据库 Setting 表覆盖
 */
const PRICING: Record<string, number> = {
  weban: 500,    // ¥5.00
  jiangsu: 500,  // ¥5.00
};

export function pricingForPlatform(platform: string): number {
  return PRICING[platform] ?? 500;
}
