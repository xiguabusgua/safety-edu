/**
 * 把一段文字拆成单字符,每个字符 staggered fade-up 入场。
 * 用法: <SplitChars text="安全教育" />
 */
export default function SplitChars({
  text,
  className = '',
  delayStep = 40,
  initialDelay = 0,
}: {
  text: string;
  className?: string;
  delayStep?: number;
  initialDelay?: number;
}) {
  const chars = Array.from(text);
  return (
    <span
      className={className}
      aria-label={text}
      style={{ display: 'inline-block' }}
    >
      {chars.map((c, i) => {
        // 空格字符保留宽度但 inline-block
        const isSpace = c === ' ';
        return (
          <span
            key={i}
            aria-hidden
            className="char-rise"
            style={{
              animationDelay: `${initialDelay + i * delayStep}ms`,
              ...(isSpace ? { width: '0.3em' } : {}),
            }}
          >
            {c === ' ' ? '\u00A0' : c}
          </span>
        );
      })}
    </span>
  );
}
