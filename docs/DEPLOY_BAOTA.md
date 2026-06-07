# 宝塔面板 · 反向代理 + SSL 配置指引

> 适用:部署完 `docker compose up -d` 之后,让域名 `safety.52akuya.asia` 真正能访问到 API 容器。

## 前置确认

部署脚本跑完,确认以下三条都 OK 再继续:

```bash
# 1. API 容器在跑
docker compose ps   # 应该看到 safety-api / safety-runner / safety-mysql 三个 Up

# 2. 本地能访问
curl -s http://localhost:3002/api/health
# → {"status":"ok",...}

# 3. 域名 DNS 已解析到 154.9.25.199
nslookup safety.52akuya.asia  # 答案应该指向 154.9.25.199
# 没解析的话去你域名服务商加 A 记录
```

## Step 1 · 宝塔添加站点

1. 登录宝塔面板 → 左侧 **网站** → 顶部 **添加站点**
2. 填写:
   - **域名**:`safety.52akuya.asia`
   - **根目录**:`/www/wwwroot/safety.52akuya.asia`(默认即可,后面会改反代)
   - **PHP**:纯静态
   - **数据库**:不创建
3. 提交

## Step 2 · 配置反向代理(关键)

1. 左侧 **网站** → 找到 `safety.52akuya.asia` → 点 **设置** → 左侧 **反向代理**
2. 顶部 **添加反向代理**:
   - **代理名称**:`safety-api`
   - **目标 URL**:`http://127.0.0.1:3002`
   - **发送域名**:`$host`
3. 提交

**⚠️ 关键:必须手动改配置文件加 SSE 长连接头**

宝塔默认反代会**截断 SSE 长连接**(我们用 SSE 实时推任务进度,60 分钟一节课会一直连着)。

去 **网站设置 → 配置文件**,找到 `location / { ... }` 整段,替换成:

```nginx
location / {
    proxy_pass http://127.0.0.1:3002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # === SSE 实时推送必须配置(项目用 /api/events/:taskId 推进度) ===
    proxy_buffering off;
    proxy_cache off;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_read_timeout 3600s;        # 1 小时(单任务最长)
    proxy_send_timeout 3600s;
}
```

保存。宝塔会自动 reload nginx。

## Step 3 · 申请 SSL(Let's Encrypt)

1. 站点设置 → 左侧 **SSL** → 选 **Let's Encrypt** 标签
2. 勾选 `safety.52akuya.asia` → **申请**
3. 申请成功后,切到 **强制 HTTPS** 标签 → 打开

**⚠️ 申请失败排查**:
- 失败原因 90% 是 DNS 没解析(回 Step 0 验证)
- 也可能是 80 端口被占:`netstat -tlnp | grep :80`,如果不是 nginx 占用先 kill
- 宝塔自签证书也可以(浏览器会报红叉),但至少能用

## Step 4 · 验证(全部 6 条都得过)

```bash
# 1. HTTPS 健康检查
curl -s https://safety.52akuya.asia/api/health
# 期望: {"status":"ok",...}

# 2. SSE 端点(用 curl --max-time 测 3 秒能看到 headers)
curl -sI --max-time 3 https://safety.52akuya.asia/api/events/test
# 期望:HTTP/1.1 200,Content-Type: text/event-stream

# 3. 前端首页
curl -sI https://safety.52akuya.asia/
# 期望:HTTP/1.1 200,Content-Type: text/html

# 4. 强制 HTTPS(80 → 443)
curl -sI http://safety.52akuya.asia/
# 期望:HTTP/1.1 301/308 Location: https://...

# 5. 静态资源
curl -sI https://safety.52akuya.asia/assets/  # Vite 输出的 chunk
# 期望:200,Content-Type: application/javascript 或类似

# 6. 支付回调(微信会用 POST 调,GET 应该是 405 或 401)
curl -sI https://safety.52akuya.asia/api/pay/notify-wechat
# 期望:405 Method Not Allowed(说明路由存在,只是不接 GET)
```

## Step 5 · 上线微信支付回调前的最后一步

SSL 通了 + 域名能访问后,登录微信支付商户平台:

**产品中心 → 开发配置 → 支付回调** → 改成:

```
https://safety.52akuya.asia/api/pay/notify-wechat
```

保存。**微信会主动 POST 一次验证**(用空 payload),你 `docker compose logs -f api` 应该能看到一行 incoming request。

## 常见坑

| 现象 | 原因 | 修法 |
|---|---|---|
| 反代 502 | API 容器没起来 | `docker compose ps`,看 safety-api 状态 |
| 反代 504 | SSE 缓冲没关 | 看 Step 2 nginx 配置,确认 `proxy_buffering off` |
| SSL 申请失败 | DNS 没解析 / 80 被占 | `nslookup` + `netstat -tlnp \| grep :80` |
| 浏览器 Mixed Content | 某个资源走 http | 全站反代 + 强制 HTTPS 应该解决,实在不行前端 vite build 时设 `base: '/'` |
| SSE 几秒就断 | proxy_read_timeout 太短 | 改 3600s |
| POST /api/pay/notify-wechat 404 | 路由前缀没配对 | 确认 `proxy_pass http://127.0.0.1:3002;` 没多 `/` 也没少 |
| 微信回调验签失败 | 微信回调没走白名单 | `apps/api/src/lib/wechatPayIps.ts`,确认 IP 段包含微信出口 IP |

## 端口清单(部署完核对一次)

```bash
# 服务器本机端口监听
netstat -tlnp | grep -E ':(80|443|3002|3306) '

# 期望:
#   80    → nginx (宝塔)
#   443   → nginx (宝塔)
#   3002  → docker-proxy → safety-api 容器
#   3306  → docker-proxy → safety-mysql 容器(只绑 127.0.0.1)
```

`3306` 应该**只绑 127.0.0.1**(docker-compose.yml 写的是 `127.0.0.1:3306:3306`),不要出现 `0.0.0.0:3306`,否则 MySQL 暴露公网。
