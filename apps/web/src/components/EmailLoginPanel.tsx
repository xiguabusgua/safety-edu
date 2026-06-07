import { useEffect, useRef, useState } from 'react';
import { CircleNotch, EnvelopeOpen } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface Props {
  boundEmail: string | null;
  onBound: (email: string) => void;
}

export default function EmailLoginPanel({ boundEmail, onBound }: Props) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown]);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function sendCode() {
    if (!valid || sending) return;
    setError(null);
    setSending(true);
    try {
      const r = await fetch('/api/auth/email-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error?.message || '发送失败');
      setSent(true);
      setCooldown(60);
      toast.success('验证码已发送', {
        description: import.meta.env.DEV ? '开发环境固定 123456' : '请查收邮箱(含垃圾邮件夹)',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送失败');
    } finally {
      setSending(false);
    }
  }

  async function verify() {
    if (verifying || code.length !== 6) return;
    setError(null);
    setVerifying(true);
    try {
      const r = await fetch('/api/auth/email-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error?.message || '验证失败');
      onBound(email);
      toast.success('邮箱已绑定', { description: email });
    } catch (e) {
      setError(e instanceof Error ? e.message : '验证失败');
    } finally {
      setVerifying(false);
    }
  }

  if (boundEmail) {
    return (
      <div className="bezel-shell">
        <div className="bezel-core">
          <div className="card !p-4 flex items-start gap-3 bg-accent-pale-green-bg border border-ink-primary/[0.05]">
            <div className="w-9 h-9 rounded-full bg-accent-pale-green-bg flex items-center justify-center flex-shrink-0">
              <EnvelopeOpen size={16} weight="duotone" className="text-accent-pale-green-fg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-primary">邮箱已绑定</p>
              <p className="text-xs text-ink-secondary mt-0.5 font-mono truncate">{boundEmail}</p>
              <p className="text-[11px] text-ink-muted mt-2 leading-relaxed">任务完成后,结果会发到此邮箱;同时作为订单凭证。</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-muted smallcaps">邮箱登录</p>
      <div className="bezel-shell">
        <div className="bezel-core">
          <div className="card !p-4 space-y-3">
            <div>
              <label className="label">邮箱地址</label>
              <div className="flex gap-2">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input flex-1" autoComplete="email" />
                <button type="button" onClick={sendCode} disabled={!valid || sending || cooldown > 0} className="btn-secondary whitespace-nowrap px-3">
                  {sending ? <CircleNotch size={12} weight="bold" className="animate-spin" /> : cooldown > 0 ? <span className="text-xs">{cooldown}s</span> : <span className="text-xs">发验证码</span>}
                </button>
              </div>
            </div>
            {sent && (
              <div>
                <label className="label">验证码</label>
                <div className="flex gap-2">
                  <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6 位数字" className="input flex-1 font-mono tracking-widest" />
                  <button type="button" onClick={verify} disabled={code.length !== 6 || verifying} className="btn-primary px-4">
                    {verifying ? <CircleNotch size={12} weight="bold" className="animate-spin" /> : <span className="text-xs">验证</span>}
                  </button>
                </div>
                <p className="text-[10px] text-ink-muted mt-1.5">
                  {import.meta.env.DEV ? (<>开发环境验证码固定为 <span className="font-mono">123456</span></>) : '验证码 10 分钟内有效,未收到请检查垃圾邮件夹'}
                </p>
              </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-ink-muted leading-relaxed">邮箱用于接收完成通知 + 订单凭证。平台账号(微伴/江苏)请仍用上方"账号密码"方式填写。</p>
    </div>
  );
}
