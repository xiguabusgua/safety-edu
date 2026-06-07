import { Link } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';

export default function Legal() {
  return (
    <main className="min-h-screen max-w-2xl mx-auto px-6 py-12 md:py-20">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink-primary transition-colors mb-10 group"
      >
        <ArrowLeft
          size={13}
          weight="bold"
          className="group-hover:-translate-x-0.5 transition-transform duration-200"
        />
        返回首页
      </Link>

      <p className="smallcaps mb-3">法务</p>
      <h1 className="font-serif text-3xl tracking-tight mb-12">
        隐私与免责
      </h1>

      <div className="space-y-12">
        <section>
          <h2 className="font-serif text-2xl tracking-tight mb-3">
            这是做什么的
          </h2>
          <p className="text-sm text-ink-secondary leading-relaxed">
            一个大学安全教育课程自动化工具,调用平台公开接口完成学习 + 考试全流程。
            用户提交账号后,后台自动执行,结果通过页面实时返回。
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl tracking-tight mb-4">
            我们记录什么
          </h2>
          <div className="divide-y divide-line border-y border-line">
            {[
              {
                title: '匿名设备 ID',
                desc: 'HttpOnly cookie,2 年,用于识别"我的任务"和防刷,不关联任何个人信息。',
              },
              {
                title: '加密存储的账号密码',
                desc: 'AES-256 加密,仅用于执行刷课,可联系站长随时删除。',
              },
              {
                title: '任务日志',
                desc: '含学校名与地区,用于后台统计和功能改进。',
              },
            ].map((item) => (
              <div key={item.title} className="py-5 flex flex-col gap-1">
                <p className="text-sm font-medium text-ink-primary">
                  {item.title}
                </p>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl tracking-tight mb-3">免责</h2>
          <p className="text-sm text-ink-secondary leading-relaxed">
            本工具仅作为自动化执行客户端,不存储、不分发任何课程内容。
            账号封禁、学分处理等后果由用户自行评估。本项目按"现状"提供,不承诺稳定性或持续可用。
          </p>
        </section>
      </div>
    </main>
  );
}
