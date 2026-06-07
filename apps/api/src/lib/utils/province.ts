/**
 * 省份推断(根据学校名)。
 * 后期接 schools 表可以替换。
 */
const PROVINCE_HINTS: Array<{ keys: string[]; province: string }> = [
  { keys: ['南京', '苏州', '无锡', '常州', '南通', '扬州'], province: '江苏' },
  { keys: ['北京'], province: '北京' },
  { keys: ['上海'], province: '上海' },
  { keys: ['广州', '深圳', '中山', '珠海', '佛山', '东莞'], province: '广东' },
  { keys: ['杭州', '宁波', '温州'], province: '浙江' },
  { keys: ['成都', '绵阳'], province: '四川' },
  { keys: ['武汉'], province: '湖北' },
  { keys: ['西安'], province: '陕西' },
];

export function inferProvince(
  platform: string,
  schoolName: string | null,
): string | null {
  if (!schoolName) return null;
  if (platform === 'jiangsu') return '江苏';
  for (const hint of PROVINCE_HINTS) {
    if (hint.keys.some((k) => schoolName.includes(k))) {
      return hint.province;
    }
  }
  return null;
}
