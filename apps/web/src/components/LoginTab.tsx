import { CheckCircle } from '@phosphor-icons/react';
import type { LoginTabId } from '../types';

export default function LoginTab({
  active,
  onChange,
  emailBound,
  wechatBound,
}: {
  active: LoginTabId;
  onChange: (id: LoginTabId) => void;
  emailBound: boolean;
  wechatBound: boolean;
}) {
  const tabs: Array<{ id: LoginTabId; label: string; sub: string; bound: boolean }> = [
    { id: 'account', label: '账号密码', sub: '直填', bound: false },
    { id: 'email', label: '邮箱', sub: '验证码', bound: emailBound },
    { id: 'wechat', label: '微信扫码', sub: '扫码', bound: wechatBound },
  ];
  return (
    <div role="tablist" aria-label="登录方式" className="bezel-shell">
      <div className="bezel-core">
        <div className="card !p-1 grid grid-cols-3 gap-1 bg-bg-elevated">
          {tabs.map((t) => {
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(t.id)}
                className={[
                  'relative px-2 py-2.5 rounded-md text-left transition-all duration-200',
                  isActive ? 'bg-bg-base shadow-button-in-button' : 'hover:bg-bg-base/50',
                ].join(' ')}
              >
                <div className="flex items-center gap-1.5">
                  <span className={['text-xs font-medium', isActive ? 'text-ink-primary' : 'text-ink-secondary'].join(' ')}>
                    {t.label}
                  </span>
                  {t.bound && <CheckCircle size={11} weight="fill" className="text-accent-pale-green-fg" />}
                </div>
                <p className={['text-[10px] mt-0.5 smallcaps tracking-wider', isActive ? 'text-ink-muted' : 'text-ink-muted/60'].join(' ')}>
                  {t.sub}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
