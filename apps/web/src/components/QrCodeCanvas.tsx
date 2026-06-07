import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeCanvasProps {
  /** QR 编码的文本/URL */
  text: string;
  /** 渲染尺寸(像素),默认 160 */
  size?: number;
  /** alt 文本(无障碍) */
  alt?: string;
  /** 额外的 className,作用在外层 wrapper 上 */
  className?: string;
}

/**
 * 本地生成二维码 — 用 qrcode 库生成 base64 dataURL。
 * - 优点:无外部网络请求,避免被公共服务的限流/宕机影响
 * - 缺点:每个 QR 一次 QR 编码计算(客户端 CPU,160x160 几乎无感)
 */
export default function QrCodeCanvas({
  text,
  size = 160,
  alt = '二维码',
  className,
}: QrCodeCanvasProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#111111',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch((err) => {
        // 不阻塞 UI — QR 失败时显示占位
        console.error('[QrCodeCanvas] 生成失败', err);
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [text, size]);

  if (!src) {
    // 占位:用和原 qrserver 一样的白色容器 + 浅边框
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-label={alt}
        role="img"
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
    />
  );
}
