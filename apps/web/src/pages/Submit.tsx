import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  CircleNotch,
  ShieldCheck,
  Key,
  MagicWand,
  ArrowLeft,
  ArrowRight,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { CreateTaskInput, CreateTaskResponse, CreatePayResponse } from 'shared-types';
import { getPlatform } from '../config/platforms';
import LoginTab from '../components/LoginTab';
import EmailLoginPanel from '../components/EmailLoginPanel';
import WechatQrPanel from '../components/WechatQrPanel';
import type { LoginTabId } from '../types';

export default function Submit() {
  const { platform } = useParams<{ platform: 'weban' | 'jiangsu' }>();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [userIdInput, setUserIdInput] = useState('');
  const [loginTab, setLoginTab] = useState<LoginTabId>('account');
  const [userEmail, setUserEmailState] = useState<string | null>(
    () => localStorage.getItem('safety:boundEmail'),
  );
  const [userWechat, setUserWechatState] = useState<string | null>(
    () => localStorage.getItem('safety:boundWechat'),
  );

  const setUserEmail = (v: string | null) => {
    if (v) localStorage.setItem('safety:boundEmail', v);
    else localStorage.removeItem('safety:boundEmail');
    setUserEmailState(v);
  };
  const setUserWechat = (v: string | null) => {
    if (v) localStorage.setItem('safety:boundWechat', v);
    else localStorage.removeItem('safety:boundWechat');
    setUserWechatState(v);
  };

  const isWeBan = platform === 'weban';
  const platformConfig = getPlatform(platform);
  const platformName = platformConfig.name;
  const platformPriceYuan = (platformConfig.price / 100).toFixed(2);

  function extractValue(raw: string, key: string): { value: string; isUrl: boolean } {
    if (!raw) return { value: '', isUrl: false };
    const trimmed = raw.trim();
    if (trimmed.includes('?') || trimmed.includes('://')) {
      try {
        const u = trimmed.includes('://')
          ? new URL(trimmed)
          : new URL(`https://x${trimmed.startsWith('/') ? '' : '/'}${trimmed}`);
        const v = u.searchParams.get(key);
        if (v) return { value: v, isUrl: true };
      } catch { /* ignore */ }
      const m = trimmed.match(new RegExp(`[?&]${key}=([^&\\s#]+)`));
      if (m) return { value: decodeURIComponent(m[1]), isUrl: true };
    }
    return { value: trimmed, isUrl: false };
  }

  function onUserIdChange(raw: string) {
    const { value, isUrl } = extractValue(raw, 'userid');
    if (isUrl && value) toast.success('已从 URL 自动提取 userid', { duration: 1500 });
    setUserIdInput(value);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!platform) { toast.error('平台参数缺失'); return; }
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    let creds: Record<string, string> = {};
    if (isWeBan) {
      creds = { school: String(fd.get('school') ?? ''), userId: String(fd.get('userId') ?? ''), password: String(fd.get('password') ?? '') };
    } else {
      creds = { userId: String(fd.get('userId') ?? ''), school: String(fd.get('school') ?? '') };
    }
    const payload: CreateTaskInput = {
      platform,
      creds: creds as CreateTaskInput['creds'],
      options: { study: true, exam: true, maxExamRounds: 3 },
      ...(userEmail && !userWechat
        ? { notify: { channel: 'email' as const, target: userEmail } }
        : userWechat
          ? { notify: { channel: 'wechat' as const, target: userWechat } }
          : {}),
    };
    try {
      const r = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error?.message || d.message || '创建任务失败'); }
      const task: CreateTaskResponse = await r.json();
      const pr = await fetch('/api/pay/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ taskId: task.taskId, channel: 'wechat_native' }) });
      if (!pr.ok) { const d = await pr.json().catch(() => ({})); throw new Error(d.error?.message || d.message || '创建支付订单失败'); }
      const pay: CreatePayResponse = await pr.json();
      navigate(`/task/${pay.taskId}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] max-w-md mx-auto px-6 py-20 md:py-28">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink-primary transition-colors mb-10 group">
        <ArrowLeft size={13} weight="bold" className="group-hover:-translate-x-0.5 transition-transform duration-200" />
        返回
      </button>
      <p className="smallcaps mb-3">{platformName}</p>
      <h1 className="font-serif text-3xl tracking-tight mb-2">填账号信息</h1>
      <p className="text-sm text-ink-secondary mb-6 leading-relaxed">账号密码加密保存,仅用于本次任务执行。</p>

      <LoginTab active={loginTab} onChange={setLoginTab} emailBound={!!userEmail} wechatBound={!!userWechat} />
      <div className="my-8 border-t border-line" />

      {loginTab === 'email' && <EmailLoginPanel boundEmail={userEmail} onBound={setUserEmail} />}
      {loginTab === 'wechat' && <WechatQrPanel boundOpenId={userWechat} onBound={setUserWechat} />}

      {loginTab === 'account' && (
        <>
          <p className="text-xs text-ink-muted mb-3 smallcaps">平台账号</p>
          <form onSubmit={onSubmit} className="space-y-4">
            {isWeBan ? (
              <>
                <div><label className="label">学校 / 单位</label><input name="school" required placeholder="如:南京大学" className="input" autoComplete="off" /></div>
                <div><label className="label">学号 / 账号</label><input name="userId" required placeholder="如:2211000" className="input" /></div>
                <div><label className="label">密码</label><input name="password" type="password" required placeholder="登录密码" className="input" /></div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">userid(粘整个 URL 自动提取)</label>
                  <input name="userId" required placeholder="一串数字,或粘完整 URL 自动提" className="input font-mono" inputMode="numeric" pattern="[0-9]+" value={userIdInput} onChange={(e) => onUserIdChange(e.target.value)} />
                  <p className="text-xs text-ink-muted mt-1.5 flex items-start gap-1.5 leading-relaxed">
                    <MagicWand size={12} weight="regular" className="mt-0.5 flex-shrink-0" />
                    <span>用微信扫下方二维码 → 登录 → 复制地址栏完整 URL 粘到上面 → 自动提取 userid</span>
                  </p>
                </div>
                <div className="bezel-shell"><div className="bezel-core">
                  <div className="card !p-4 flex flex-col items-center gap-2">
                    <p className="text-xs text-ink-secondary">微信扫一扫 → 登录</p>
                    <div className="w-44 h-44 bg-white rounded-md overflow-hidden p-2 border border-line">
                      <div className="w-full h-full bg-bg-sunken rounded flex items-center justify-center text-[10px] text-ink-muted">江苏登录二维码</div>
                    </div>
                    <a href={platformConfig.loginUrl} target="_blank" rel="noreferrer" className="text-[10px] text-ink-muted hover:text-ink-secondary underline underline-offset-2">普通浏览器点此 → 会提示"请在微信打开"</a>
                  </div>
                </div></div>
                <div><label className="label">学校名(选填,用于统计)</label><input name="school" placeholder="如:南京大学" className="input" /></div>
                <div className="bezel-shell"><div className="bezel-core">
                  <div className="card !p-4 flex items-start gap-3 text-xs text-ink-secondary leading-relaxed bg-bg-elevated">
                    <Key size={14} weight="bold" className="text-accent-pale-green-fg flex-shrink-0 mt-0.5" />
                    <p>江苏平台仅支持 <strong className="text-ink-primary font-medium">微信 userid</strong> 模式(从微信扫码登录后 URL 里复制)。账号密码登录模式需要微信 openId,本平台未开放。</p>
                  </div>
                </div></div>
              </>
            )}

            <div className="bezel-shell"><div className="bezel-core">
              <div className="card !p-4 flex items-start gap-3 text-xs text-ink-secondary leading-relaxed bg-bg-elevated">
                <ShieldCheck size={14} weight="bold" className="text-accent-pale-green-fg flex-shrink-0 mt-0.5" />
                <div>
                  <p>单平台 ¥{platformPriceYuan},付完即跑。</p>
                  <p className="mt-1">结果原地验收,账号密码加密存储。<Link to="/legal" className="underline underline-offset-2 ml-1 hover:text-ink-primary">隐私条款</Link></p>
                </div>
              </div>
            </div></div>

            <button type="submit" disabled={submitting} className="btn-primary w-full mt-6 group">
              {submitting ? (
                <><CircleNotch size={14} weight="bold" className="animate-spin" /> 创建订单...</>
              ) : (
                <>下一步:扫码支付 ¥{platformPriceYuan}<span className="btn-icon-nest transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"><ArrowRight size={12} weight="bold" /></span></>
              )}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
