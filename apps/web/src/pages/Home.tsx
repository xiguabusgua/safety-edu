import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Lightning,
  Lock,
  Fingerprint,
  GithubLogo,
  BookOpen,
  Books,
  Plus,
  Minus,
} from '@phosphor-icons/react';
import Reveal from '../components/Reveal';
import SplitChars from '../components/SplitChars';

const marqueeItems = [
  '1200万+ 用户',
  '高校全覆盖',
  '0 人工干预',
  '7×24 自动化',
  'AES-256 加密',
  '匿名 cookie',
  '断网自动重连',
  '同页面实时进度',
  '社区维护题库',
  '付完即跑',
];

const faqs = [
  {
    q: '这个工具是做什么的?',
    a: '帮大学生自动完成"安全微伴"和"江苏安全通"两个平台的安全教育课程和考试,跑完出结果。',
  },
  {
    q: '账号安全吗?',
    a: 'AES-256 加密存储,key 不落盘,跑完即清。任何人(包括站长)看不到明文密码。',
  },
  {
    q: '平台合规吗?会不会被封号?',
    a: '非营利学习工具,不存储课程内容。但账号封禁、学分处理等后果仍由用户自行评估,详见隐私与免责。',
  },
  {
    q: '支持哪些学校?',
    a: '安全微伴覆盖全国本科 + 高职,江苏安全通覆盖江苏省高校。具体能否执行取决于学校是否对接题库。',
  },
  {
    q: '跑一次多久?',
    a: '通常 20-60 分钟,跟课程数量、平台响应速度有关。SSE 实时同步进度,断网也能自动重连。',
  },
  {
    q: '退款政策?',
    a: '任务未开始前可全额退款;已开始则按完成度比例退款。联系站长处理。',
  },
];

const platforms = [
  {
    id: 'weban',
    name: '安全微伴',
    blurb: '登录学校账号,自动完成所有微课章节 + 章节测验,支持考试模式重做。',
    accent: 'pale-blue',
    count: '1200万+ 用户',
    initial: 'W',
  },
  {
    id: 'jiangsu',
    name: '江苏安全通',
    blurb: '微信扫码登录后,从 URL 复制 userid 即可免密执行,新生任务一键过。',
    accent: 'pale-yellow',
    count: '高校全覆盖',
    initial: 'J',
  },
] as const;

const features = [
  {
    icon: Lightning,
    title: '实时进度',
    desc: '服务端推送,断网自动重连,刷新也能恢复。',
    meta: 'SSE',
    emphasis: true,
  },
  {
    icon: Lock,
    title: '账号加密',
    desc: 'AES-256 加密存储,key 不落盘,跑完即清。',
    meta: 'AES-256',
    emphasis: false,
  },
  {
    icon: Fingerprint,
    title: '免注册',
    desc: '匿名 cookie 识别,2 年有效,跨设备不跟随。',
    meta: 'HttpOnly',
    emphasis: false,
  },
  {
    icon: Books,
    title: '题库共建',
    desc: '社区贡献者共同维护,只用于自动化调用。',
    meta: 'open source',
    emphasis: false,
  },
];

const accentBg: Record<string, string> = {
  'pale-blue': 'bg-accent-pale-blue-bg text-accent-pale-blue-fg',
  'pale-yellow': 'bg-accent-pale-yellow-bg text-accent-pale-yellow-fg',
  'pale-red': 'bg-accent-pale-red-bg text-accent-pale-red-fg',
  'pale-green': 'bg-accent-pale-green-bg text-accent-pale-green-fg',
  'pale-violet': 'bg-accent-pale-violet-bg text-accent-pale-violet-fg',
};

export default function Home() {
  return (
    <main className="min-h-[100dvh] relative">
      <div className="ambient-blob" style={{ top: '-10vh', right: '-15vw' }} />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 md:pt-24 pb-20 relative">
        <Reveal>
          <p className="smallcaps mb-6">大学安全教育 · 自动化</p>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="text-serif-display max-w-3xl text-ink-primary relative">
            <span className="relative inline-block">
              <SplitChars text="安全教育," />
              <span
                aria-hidden
                className="absolute left-0 -bottom-1 h-[6px] w-full bg-brand-tint -z-10 rounded-sm"
              />
            </span>
            <br />
            <span className="text-ink-secondary italic">
              <SplitChars text="一键搞定。" initialDelay={120} />
            </span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="text-lg text-ink-secondary max-w-xl leading-relaxed mt-8">
            选平台,填账号,跑完原地验收。
          </p>
        </Reveal>
        <Reveal delay={220}>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a href="#platforms" className="btn-primary group">
              开始使用
              <span className="btn-icon-nest">
                <ArrowRight size={12} weight="bold" />
              </span>
            </a>
            <a
              href="https://github.com/Scwizard/jiangsu-safety-platform-skip"
              target="_blank"
              rel="noreferrer"
              className="btn-outline group"
            >
              <GithubLogo size={14} weight="bold" />
              查看源码
              <span className="btn-icon-nest">
                <ArrowRight size={12} weight="bold" />
              </span>
            </a>
          </div>
        </Reveal>
      </section>

      {/* Platform Selection */}
      <section
        id="platforms"
        className="max-w-5xl mx-auto px-6 py-24 md:py-32 relative"
      >
        <Reveal>
          <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
            <h2 className="text-serif-headline">选择平台</h2>
            <p className="text-sm text-ink-muted max-w-xs text-right">
              目前支持两个平台,更多适配中。
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-4">
          {platforms.map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <div className="bezel-shell h-full">
                <div className="bezel-core">
                  <Link
                    to={`/submit/${p.id}`}
                    className="group card card-hover !p-7 flex flex-col gap-7 active:scale-[0.998] h-full"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-base font-semibold ${accentBg[p.accent]}`}
                      >
                        {p.initial}
                      </div>
                      <ArrowRight
                        size={18}
                        weight="bold"
                        className="text-ink-muted group-hover:text-ink-primary group-hover:translate-x-0.5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-medium tracking-tight mb-2">
                        {p.name}
                      </h3>
                      <p className="text-sm text-ink-secondary leading-relaxed mb-5">
                        {p.blurb}
                      </p>
                      <span
                        className={`pill ${accentBg[p.accent].split(' ')[0]} ${accentBg[p.accent].split(' ')[1]}`}
                      >
                        {p.count}
                      </span>
                    </div>
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Marquee 跑马灯 — 可信度声明 + brand/accent 圆点装饰 */}
      <section className="max-w-5xl mx-auto px-6 py-12 md:py-16 relative">
        <Reveal>
          <div className="marquee">
            <div className="marquee-track">
              {[...marqueeItems, ...marqueeItems].map((item, i) => {
                const dotPalette = [
                  'bg-brand',
                  'bg-accent-pale-blue-fg',
                  'bg-accent-pale-yellow-fg',
                  'bg-accent-pale-green-fg',
                  'bg-accent-pale-violet-fg',
                ];
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-3 pr-6 text-sm"
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        dotPalette[i % dotPalette.length]
                      }`}
                    />
                    <span className="text-ink-primary font-medium tracking-tight">
                      {item}
                    </span>
                    <span className="text-ink-primary/[0.06] pl-3">·</span>
                  </span>
                );
              })}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Features - 2x2 grid + Double-Bezel 嵌套 */}
      <section className="max-w-5xl mx-auto px-6 py-24 md:py-32 relative">
        <Reveal>
          <h2 className="text-serif-headline max-w-md mb-12">
            <span className="text-ink-secondary">三件事,</span>
            我们做得认真。
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-3">
          {features.map((f, i) => {
            const isEm = f.emphasis;
            // bento 不对称:emphasis 卡片横跨两列,中间两个并列,最后一张再横跨
            // 移动端全部回退到 col-span-1
            const span =
              isEm || (i === features.length - 1 && features.length % 2 === 1)
                ? 'md:col-span-2'
                : '';
            return (
              <Reveal key={f.title} delay={i * 60}>
                <div className={`bezel-shell ${span}`}>
                  <div className="bezel-core">
                    <div
                      className={`card !p-6 h-full flex flex-col ${
                        isEm ? 'bg-bg-elevated' : ''
                      }`}
                    >
                      <div
                        className={`rounded-lg flex items-center justify-center text-ink-secondary mb-5 ${
                          isEm
                            ? 'w-12 h-12 bg-accent-pale-blue-bg text-accent-pale-blue-fg'
                            : 'w-10 h-10 bg-bg-elevated'
                        }`}
                      >
                        <f.icon size={isEm ? 22 : 18} weight="bold" />
                      </div>
                      <h3
                        className={`font-medium tracking-tight mb-2 ${
                          isEm ? 'text-lg' : 'text-base'
                        }`}
                      >
                        {f.title}
                      </h3>
                      <p className="text-sm text-ink-secondary leading-relaxed flex-1">
                        {f.desc}
                      </p>
                      <p className="mt-5 pt-5 border-t border-line smallcaps">
                        {f.meta}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* FAQ - 1px border-bottom 分隔,无容器 */}
      <section className="max-w-3xl mx-auto px-6 py-20 md:py-28">
        <Reveal>
          <h2 className="text-serif-headline max-w-md mb-12">
            <span className="text-ink-secondary">还犹豫?</span>
            问得最多的几个问题。
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <div className="border-t border-line">
            {faqs.map((item) => (
              <details
                key={item.q}
                className="group border-b border-line py-5"
              >
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="text-base font-medium text-ink-primary">
                    {item.q}
                  </span>
                  <span className="text-ink-muted group-open:text-ink-primary transition-colors flex-shrink-0">
                    <Plus
                      size={16}
                      weight="bold"
                      className="group-open:hidden"
                    />
                    <Minus
                      size={16}
                      weight="bold"
                      className="hidden group-open:block"
                    />
                  </span>
                </summary>
                <p className="mt-3 text-sm text-ink-secondary leading-relaxed pr-8">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Trust strip - 用 brand tint 装饰左侧色块 */}
      <section className="max-w-5xl mx-auto px-6 mt-12 pt-16 border-t border-line">
        <Reveal>
          <div className="bezel-shell">
            <div className="bezel-core">
              <div className="card flex items-start gap-4 !p-5 bg-brand-tint/40">
                <div className="w-9 h-9 rounded-lg bg-brand-tint flex items-center justify-center text-brand flex-shrink-0">
                  <BookOpen size={16} weight="regular" />
                </div>
                <div>
                  <p className="text-sm text-ink-primary font-medium mb-1">
                    非营利学习项目
                  </p>
                  <p className="text-xs text-ink-secondary leading-relaxed">
                    题库由社区贡献者共同维护,仅用于自动化调用。
                    {' '}
                    <Link
                      to="/legal"
                      className="underline underline-offset-2 decoration-ink-primary/20 hover:text-ink-primary"
                    >
                      隐私与免责
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="max-w-5xl mx-auto px-6 py-16 mt-8 border-t border-line">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <p className="text-xs text-ink-muted">
            safety edu · for learning only
          </p>
          <p className="text-[10px] text-ink-muted tracking-wider">
            © 2026
          </p>
        </div>
      </footer>
    </main>
  );
}
