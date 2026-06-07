# safety-edu Docker 部署教程

> 服务器一键部署，使用 Docker Compose 编排 MySQL + API + Runner 三个服务。

---

## 目录

1. [环境要求](#1-环境要求)
2. [安装 Docker](#2-安装-docker)
3. [拉取代码](#3-拉取代码)
4. [配置环境变量](#4-配置环境变量)
5. [构建并启动](#5-构建并启动)
6. [Nginx 反代 + SSL](#6-nginx-反代--ssl)
7. [管理命令](#7-管理命令)
8. [更新升级](#8-更新升级)
9. [排错指南](#9-排错指南)

---

## 1. 环境要求

| 项目 | 最低要求 | 推荐 |
|------|---------|------|
| 操作系统 | Ubuntu 20.04+ / Debian 11+ / CentOS 8+ | Ubuntu 22.04 |
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 磁盘 | 20 GB | 40 GB |
| 域名 | 一个 A 记录指向服务器 IP | — |

> 内存主要消耗在 `ddddocr` (Python 验证码 OCR 库) 的 ONNX 推理引擎上。

---

## 2. 安装 Docker

### Ubuntu / Debian

```bash
# 安装依赖
sudo apt update
sudo apt install -y ca-certificates curl

# 添加 Docker 官方 GPG 密钥
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 添加 APT 源
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 验证
sudo docker run hello-world
sudo docker compose version
```

### CentOS / RHEL

```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo docker compose version
```

---

## 3. 拉取代码

```bash
# 创建项目目录
mkdir -p /opt/safety-edu && cd /opt/safety-edu

# 克隆仓库（用你的实际仓库地址替换）
git clone https://github.com/YOUR_USER/safety-edu.git .
# 或者从本地 scp 上去：
# scp -r /path/to/安全教育与安全微伴 root@YOUR_SERVER:/opt/safety-edu

# （推荐）检出稳定版本
# git checkout v1.0.0
```

---

## 4. 配置环境变量

```bash
cp .env.example.docker .env
nano .env
```

填写以下内容（带 🔴 的必须填）：

```ini
# 🔴 MySQL root 密码 — 任意随机字符串
MYSQL_ROOT_PASSWORD=my_secure_root_pw_123

# 🔴 MySQL lens_light 用户密码 — 任意随机字符串
MYSQL_PASSWORD=my_secure_lens_light_pw_456

# 🔴 AES-256 密钥 (先运行 openssl rand -hex 32 生成)
ACCOUNT_ENC_KEY="0a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f6789"

# 🔴 Cookie 签名密钥 (至少 32 字符)
COOKIE_SECRET="your-random-cookie-secret-at-least-32-chars"

# 🔴 JWT 签名密钥 (至少 32 字符)
JWT_SECRET="your-random-jwt-secret-at-least-32-chars-long"

# 🔴 你的域名（必填，用于 CORS 校验）
CORS_ORIGIN="https://safety.yourdomain.com"

# 🔴 公开基础 URL（用于支付回调链路）
PUBLIC_BASE_URL="https://safety.yourdomain.com"

# Runner 并发数（服务器 4 核可以设 3，2 核就设 2）
RUNNER_CONCURRENCY=2

# 支付模式：mock=模拟支付，real=微信支付 V3
PAY_MODE=mock
```

> **安全密钥生成方法：**
> ```bash
> # ACCOUNT_ENC_KEY (必须 64 hex 字符)
> openssl rand -hex 32
>
> # COOKIE_SECRET / JWT_SECRET (随机 32 字符以上)
> openssl rand -base64 32 | tr -d '=+/'
> ```

> ⚠️ **ACCOUNT_ENC_KEY 特别重要** — 它是加密用户账号凭据的 AES 密钥。一旦部署上线并有了用户数据，**这个密钥就不能再改**，否则所有已加密的凭据都无法解密，所有任务会永久卡在 running 状态。

---

## 5. 构建并启动

```bash
cd /opt/safety-edu

# 第一次构建（需要下载依赖，耗时 5-15 分钟取决于网络）
sudo docker compose build --no-cache

# 启动所有服务
sudo docker compose up -d

# 查看启动日志
sudo docker compose logs --tail=50

# 等待 30 秒让 MySQL 初始化 + 数据库迁移完成
sleep 30

# 验证 API 是否正常
curl http://localhost:3002/api/health
# 期望返回: {"status":"ok","env":"production",...}

# 验证前端是否正常
curl -s http://localhost:3002 | head -5
# 期望返回 HTML（含 <!DOCTYPE html>）
```

### 各容器状态说明

```bash
sudo docker compose ps
```

你应该看到三个容器都是 `Up` 状态：

```
NAME                IMAGE                  STATUS          PORTS
safety-mysql        mysql:8.0              Up (healthy)    127.0.0.1:3306->3306/tcp
safety-api          safety-edu-api         Up              0.0.0.0:3002->3002/tcp
safety-runner       safety-edu-runner      Up              (无端口暴露)
```

---

## 6. Nginx 反代 + SSL

API 容器在 `localhost:3002` 提供服务，需要 nginx 做 HTTPS 反向代理。

### 6.1 安装 nginx

```bash
sudo apt install -y nginx
# CentOS: sudo yum install -y nginx && sudo systemctl enable --now nginx
```

### 6.2 配置站点

创建 nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/safety.yourdomain.com
```

写入以下内容（**把域名换成你的**）：

```nginx
# /etc/nginx/sites-available/safety.yourdomain.com
# 硬编码 301 到 https（Certbot 会自动补 https 配置）
server {
    listen 80;
    listen [::]:80;
    server_name safety.yourdomain.com;

    # 申请 SSL 时 Certbot 会自动填充这步
    # 等 SSL 配好后再改 return 301 https://$server_name$request_uri
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 实时推送必须关闭缓冲
        proxy_buffering off;
        proxy_cache off;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_read_timeout 3600s;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/safety.yourdomain.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6.3 申请 SSL 证书（Certbot）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书（会自动修改 nginx 配置，加 HTTPS + 301）
sudo certbot --nginx -d safety.yourdomain.com

# 检查自动续期（默认已配 systemd timer）
sudo certbot renew --dry-run
```

Certbot 完成后的 nginx 配置会自动变成：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name safety.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name safety.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/safety.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/safety.yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ⚠️ 确保 SSE 相关配置还在
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_read_timeout 3600s;
    }
}
```

> 如果 Certbot 覆盖后 `proxy_buffering off` 等行消失了，手动加回去。

### 6.4 打开防火墙

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

---

## 7. 管理命令

### 日常操作

```bash
# 进入项目目录
cd /opt/safety-edu

# 查看所有容器状态
sudo docker compose ps

# 查看实时日志
sudo docker compose logs -f          # 全部服务
sudo docker compose logs -f api      # 仅 API
sudo docker compose logs -f runner   # 仅 Runner

# 重启某个服务（不改代码，只重启进程）
sudo docker compose restart api
sudo docker compose restart runner

# 停止全部服务（不删除数据）
sudo docker compose down

# 停止全部并删除容器（数据卷保留，数据不丢）
sudo docker compose down --remove-orphans

# 彻底清除（⚠️ 会删数据库）
sudo docker compose down -v
```

### 备份数据库

```bash
# 手动备份
sudo docker exec safety-mysql mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" lens_light > /opt/backup-$(date +%Y%m%d).sql

# 恢复
cat /opt/backup-20250101.sql | sudo docker exec -i safety-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" lens_light
```

### 查看资源占用

```bash
sudo docker stats
```

---

## 8. 更新升级

```bash
cd /opt/safety-edu

# 1. 拉取最新代码
git pull

# 2. 重新构建（--no-cache 可选，依赖没变时可省略）
sudo docker compose build --no-cache

# 3. 重新创建容器
sudo docker compose up -d --force-recreate

# 4. 验证
curl http://localhost:3002/api/health
```

> 如果数据库 schema 变了（新的 Prisma migration），API 容器的 entrypoint 会在启动时自动执行 `prisma migrate deploy`，无需手动操作。

---

## 9. 排错指南

### 9.1 API 无法启动 — 数据库连接失败

```bash
sudo docker compose logs api
# 看到 "Can't connect to MySQL server" → MySQL 还没就绪

# 等一会再试，或检查 MySQL 状态
sudo docker compose logs mysql --tail=20
```

### 9.2 Runner 报 "python3: not found" 或 ModuleNotFoundError

```bash
sudo docker compose logs runner --tail=50
# 确认 Python worker 路径和环境变量
sudo docker exec safety-runner which python3
sudo docker exec safety-runner python3 -c "import requests; print('ok')"
```

### 9.3 前端白屏 / 404

```bash
# 检查 web/dist 是否存在
sudo docker exec safety-api ls -la /app/apps/web/dist
# 如果为空，说明构建阶段 web 没编译成功
```

### 9.4 端口被占用

```bash
# 查看 3002 端口被谁占用
sudo lsof -i:3002
# 或
sudo ss -tlnp | grep 3002
```

### 9.5 磁盘空间不够

```bash
sudo docker system df             # 查看 Docker 磁盘占用
sudo docker system prune -af      # 清理悬空镜像和构建缓存（谨慎，会删所有未使用的镜像）
```

### 9.6 重建从头来

```bash
cd /opt/safety-edu
sudo docker compose down -v       # ⚠️ 会删 MySQL 数据卷
sudo docker compose build --no-cache
sudo docker compose up -d
```

---

## 附录：完整部署流程速查

```bash
# === 服务器初始化 ===
# 安装 Docker（选你的 OS 对应命令）
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker

# === 项目部署 ===
mkdir -p /opt/safety-edu && cd /opt/safety-edu
git clone <你的仓库地址> .
cp .env.example.docker .env
nano .env    # 填写所有配置

# === 构建启动 ===
sudo docker compose build --no-cache
sudo docker compose up -d
sleep 30
curl http://localhost:3002/api/health

# === Nginx + SSL ===
sudo apt install -y nginx certbot python3-certbot-nginx
# 先写好 /etc/nginx/sites-available/safety.yourdomain.com (内容见 6.2 节)
sudo certbot --nginx -d safety.yourdomain.com
sudo systemctl reload nginx
```
