#!/usr/bin/env bash
# =============================================================================
# safety-edu 一键部署脚本
# 在裸机 Ubuntu/Debian/CentOS 上从零安装 Docker、构建并启动全部服务。
#
# 用法：
#   curl -fsSL https://你的域名/install.sh | sudo bash
#   或
#   sudo bash install.sh
#
# 本脚本是交互式的，需要你输入域名并选择是否配置 HTTPS。
# =============================================================================
set -e

# ---- 颜色 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()   { echo -e "${RED}[ERR]${NC}   $1"; }
step()  { echo ""; echo -e "${GREEN}══════════════════════════════════════════════${NC}"; echo -e "${GREEN}  第 $1 步: $2${NC}"; echo -e "${GREEN}══════════════════════════════════════════════${NC}"; }

# ---- 前置检查 ----
if [ "$(id -u)" -ne 0 ]; then
  err "请用 sudo 或 root 运行此脚本"
  echo "   sudo bash install.sh"
  exit 1
fi

PROJECT_DIR="/opt/safety-edu"
GIT_REPO=""

# =============================================================================
# 第 1 步：安装 Docker
# =============================================================================
step 1 "安装 Docker"

install_docker() {
  if command -v docker &>/dev/null; then
    ok "Docker 已安装: $(docker --version)"
    if docker compose version &>/dev/null; then
      ok "Docker Compose 插件已安装"
      return 0
    fi
    warn "Docker Compose 插件未安装，尝试安装..."
  fi

  # 检测 OS
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
  else
    err "无法检测操作系统，请手动安装 Docker: https://docs.docker.com/engine/install/"
    exit 1
  fi

  case "$OS" in
    ubuntu|debian)
      info "检测到 $OS，使用 apt 安装 Docker..."
      apt-get update -qq
      apt-get install -y -qq ca-certificates curl
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL "https://download.docker.com/linux/$OS/gpg" -o /etc/apt/keyrings/docker.asc
      chmod a+r /etc/apt/keyrings/docker.asc
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$OS $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list
      apt-get update -qq
      apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
      ;;
    centos|rhel|rocky|almalinux)
      info "检测到 $OS，使用 yum 安装 Docker..."
      yum install -y -q yum-utils
      yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
      yum install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
      systemctl enable --now docker
      ;;
    *)
      err "不支持的 OS: $OS，请手动安装 Docker: https://docs.docker.com/engine/install/"
      exit 1
      ;;
  esac

  systemctl enable docker &>/dev/null || true
  ok "Docker 安装完成: $(docker --version)"
  docker compose version && ok "Docker Compose 可用"
}

install_docker

# =============================================================================
# 第 2 步：准备项目文件
# =============================================================================
step 2 "准备项目文件"

# 如果项目已存在，询问是否覆盖
if [ -d "$PROJECT_DIR/docker-compose.yml" ] || [ -f "$PROJECT_DIR/docker-compose.yml" ]; then
  echo ""
  warn "检测到 $PROJECT_DIR 已有项目文件"
  read -r -p "是否覆盖？(y/N) " overwrite
  if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
    info "使用现有项目文件"
    cd "$PROJECT_DIR"
  else
    rm -rf "$PROJECT_DIR"
    mkdir -p "$PROJECT_DIR"
  fi
else
  mkdir -p "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# 询问代码来源
if [ ! -f "$PROJECT_DIR/docker-compose.yml" ]; then
  echo ""
  echo "项目代码来源："
  echo "  1) 从 Git 仓库克隆"
  echo "  2) 从本地目录上传 (需要你手动 scp 到服务器)"
  read -r -p "请选择 (1/2，默认 1): " src_choice

  if [ "$src_choice" = "2" ]; then
    info "请在另一个终端执行:"
    echo ""
    echo "  在本地电脑上:"
    echo "    scp -r /path/to/安全教育与安全微伴/* root@$(curl -s ifconfig.me):$PROJECT_DIR/"
    echo ""
    read -r -p "文件传输完成后，按回车继续..."
  else
    read -r -p "请输入 Git 仓库地址: " GIT_REPO
    if [ -z "$GIT_REPO" ]; then
      err "仓库地址不能为空"
      exit 1
    fi
    info "克隆仓库 $GIT_REPO ..."
    git clone "$GIT_REPO" tmp_repo
    shopt -s dotglob
    mv tmp_repo/* . 2>/dev/null || true
    mv tmp_repo/.* . 2>/dev/null || true
    rmdir tmp_repo
    shopt -u dotglob
  fi
fi

# 验证关键文件
if [ ! -f "$PROJECT_DIR/docker-compose.yml" ]; then
  err "docker-compose.yml 不存在，请确认代码已正确放置到 $PROJECT_DIR"
  ls -la "$PROJECT_DIR"
  exit 1
fi
ok "项目文件就绪"

# =============================================================================
# 第 3 步：生成密钥并配置 .env
# =============================================================================
step 3 "配置环境变量"

# 生成安全密钥
ACCOUNT_ENC_KEY=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-40)
JWT_SECRET=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-40)
MYSQL_ROOT_PW=$(openssl rand -base64 16 | tr -d '=+/')
MYSQL_PW=$(openssl rand -base64 16 | tr -d '=+/')

# 已有 .env 则加载，否则交互填写
if [ -f "$PROJECT_DIR/.env" ]; then
  info "检测到已有 .env 文件"
  cat "$PROJECT_DIR/.env"
  echo ""
  read -r -p "是否重新配置？(y/N) " reconfigure
  if [ "$reconfigure" != "y" ] && [ "$reconfigure" != "Y" ]; then
    ok  "使用现有 .env 配置"
    set -a; source "$PROJECT_DIR/.env"; set +a
    # 补全可能缺少的变量
    MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-$MYSQL_ROOT_PW}"
    MYSQL_PASSWORD="${MYSQL_PASSWORD:-$MYSQL_PW}"
    ACCOUNT_ENC_KEY="${ACCOUNT_ENC_KEY:-$ACCOUNT_ENC_KEY}"
    COOKIE_SECRET="${COOKIE_SECRET:-$COOKIE_SECRET}"
    JWT_SECRET="${JWT_SECRET:-$JWT_SECRET}"
    CORS_ORIGIN="${CORS_ORIGIN:-}"
    PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"
    PAY_MODE="${PAY_MODE:-mock}"
    RUNNER_CONCURRENCY="${RUNNER_CONCURRENCY:-2}"
  fi
fi

# 需要交互的配置项
if [ ! -f "$PROJECT_DIR/.env" ] || [ "$reconfigure" = "y" ] || [ "$reconfigure" = "Y" ]; then
  echo ""
  info "接下来需要输入一些配置信息（可以按回车跳过用自动生成的随机值）"
  echo ""

  # 域名
  while [ -z "$CORS_ORIGIN" ]; do
    read -r -p "🔴 请输入你的域名 (例如 safety.example.com): " DOMAIN
    if [ -n "$DOMAIN" ]; then
      # 去掉可能的协议前缀
      DOMAIN="${DOMAIN#https://}"
      DOMAIN="${DOMAIN#http://}"
      DOMAIN="${DOMAIN%%/*}"
      CORS_ORIGIN="https://$DOMAIN"
      PUBLIC_BASE_URL="https://$DOMAIN"
    else
      warn "域名不能为空，将使用占位符（后续需手动修改 .env）"
      CORS_ORIGIN="https://safety.example.com"
      PUBLIC_BASE_URL="https://safety.example.com"
    fi
  done
  ok "域名: $CORS_ORIGIN"

  # MySQL 密码
  read -r -p "MySQL root 密码 (回车自动生成: $MYSQL_ROOT_PW): " input
  MYSQL_ROOT_PASSWORD="${input:-$MYSQL_ROOT_PW}"
  read -r -p "MySQL lens_light 密码 (回车自动生成: $MYSQL_PW): " input
  MYSQL_PASSWORD="${input:-$MYSQL_PW}"

  # Runner 并发
  read -r -p "Runner 并发数 (默认 2): " input
  RUNNER_CONCURRENCY="${input:-2}"

  # 支付模式
  echo ""
  echo "支付模式："
  echo "  1) mock  — 模拟支付（不上线微信支付就用这个）"
  echo "  2) real  — 微信支付 V3 (需填写商户信息)"
  read -r -p "请选择 (1/2，默认 1): " pay_choice
  if [ "$pay_choice" = "2" ]; then
    PAY_MODE="real"
    warn "微信支付模式已选择，请部署后手动编辑 .env 填写 WECHAT_PAY_* 参数"
    echo "   nano $PROJECT_DIR/.env"
  else
    PAY_MODE="mock"
  fi

  # 写入 .env
  cat > "$PROJECT_DIR/.env" << EOF
# ====== safety-edu 环境配置 (由 install.sh 自动生成) ======
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')

# ----- 数据库 -----
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
MYSQL_PASSWORD=${MYSQL_PASSWORD}

# ----- 安全密钥 (请勿泄露) -----
ACCOUNT_ENC_KEY="${ACCOUNT_ENC_KEY}"
COOKIE_SECRET="${COOKIE_SECRET}"
JWT_SECRET="${JWT_SECRET}"

# ----- CORS / 公开 URL -----
CORS_ORIGIN="${CORS_ORIGIN}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL}"

# ----- Runner -----
RUNNER_CONCURRENCY=${RUNNER_CONCURRENCY}

# ----- 支付模式 (mock=模拟, real=微信支付 V3) -----
PAY_MODE=${PAY_MODE}
EOF

  ok ".env 已生成"
fi

# 打印配置摘要
echo ""
info "========== 配置摘要 =========="
echo "  项目目录:      $PROJECT_DIR"
echo "  域名:          ${CORS_ORIGIN:-未设置}"
echo "  MySQL root:    ${MYSQL_ROOT_PASSWORD:0:8}... (已隐藏)"
echo "  MySQL 用户:    ${MYSQL_PASSWORD:0:8}... (已隐藏)"
echo "  支付模式:      ${PAY_MODE:-mock}"
echo "  Runner 并发:   ${RUNNER_CONCURRENCY:-2}"
echo "=============================="

# =============================================================================
# 第 4 步：构建 Docker 镜像
# =============================================================================
step 4 "构建 Docker 镜像"

info "首次构建需要下载依赖，耗时 5-15 分钟..."
info "可查看日志: tail -f /tmp/safety-build.log"

# 检查 docker-compose.yml 里的 image 名称
# 如果没有 image 字段，compose 会自动根据 project name 命名
cd "$PROJECT_DIR"
sudo docker compose build 2>&1 | tee /tmp/safety-build.log

if [ "${PIPESTATUS[0]}" -ne 0 ]; then
  err "构建失败，查看日志: cat /tmp/safety-build.log"
  exit 1
fi
ok "镜像构建完成"

# =============================================================================
# 第 5 步：启动服务
# =============================================================================
step 5 "启动服务"

info "启动所有容器..."
cd "$PROJECT_DIR"
sudo docker compose up -d

info "等待 MySQL 初始化 + 数据库迁移 (约 30 秒)..."
# 等待 API 健康检查通过
for i in $(seq 1 30); do
  if curl -sf http://localhost:3002/api/health > /dev/null 2>&1; then
    echo ""
    ok "API 健康检查通过！"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo ""
    warn "健康检查超时，请稍后手动检查: curl http://localhost:3002/api/health"
    warn "查看日志: sudo docker compose logs api"
  fi
  echo -n "."
  sleep 2
done

echo ""
ok "所有容器状态:"
sudo docker compose ps

# =============================================================================
# 第 6 步：可选 — 配置 Nginx + SSL
# =============================================================================
step 6 "配置 Nginx + SSL（可选）"

echo ""
read -r -p "是否配置 Nginx 反代和 HTTPS？(y/N) " setup_nginx

if [ "$setup_nginx" = "y" ] || [ "$setup_nginx" = "Y" ]; then

  # 安装 nginx
  if ! command -v nginx &>/dev/null; then
    info "安装 Nginx..."
    if [ -f /etc/os-release ]; then
      . /etc/os-release
      case "$ID" in
        ubuntu|debian) apt-get install -y -qq nginx ;;
        centos|rhel|rocky|almalinux) yum install -y -q nginx && systemctl enable --now nginx ;;
      esac
    fi
    ok "Nginx 已安装"
  else
    ok "Nginx 已安装"
  fi

  # 生成 nginx 配置
  DOMAIN="${CORS_ORIGIN#https://}"
  DOMAIN="${DOMAIN#http://}"

  NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
  if [ -f /etc/nginx/conf.d ]; then
    NGINX_CONF="/etc/nginx/conf.d/$DOMAIN.conf"
  fi

  info "写入 nginx 配置: $NGINX_CONF"
  cat > "$NGINX_CONF" << 'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;

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
NGINXEOF
  sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$NGINX_CONF"

  # 启用站点
  if [ -d /etc/nginx/sites-enabled ]; then
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/ 2>/dev/null || true
  fi

  nginx -t && systemctl reload nginx
  ok "Nginx 已配置 (HTTP 80 端口)"

  # 申请 SSL
  echo ""
  info "接下来为 $DOMAIN 申请免费 SSL 证书"
  warn "请确保域名 $DOMAIN 的 DNS 已指向本机 IP ($(curl -s ifconfig.me 2>/dev/null || echo '?') )"
  read -r -p "是否继续申请 SSL 证书？(y/N) " setup_ssl

  if [ "$setup_ssl" = "y" ] || [ "$setup_ssl" = "Y" ]; then
    if ! command -v certbot &>/dev/null; then
      info "安装 Certbot..."
      if [ -f /etc/os-release ]; then
        . /etc/os-release
        case "$ID" in
          ubuntu|debian)
            apt-get install -y -qq certbot python3-certbot-nginx
            ;;
          centos|rhel|rocky|almalinux)
            yum install -y -q certbot python3-certbot-nginx
            ;;
        esac
      fi
    fi

    info "申请证书中，按提示操作..."
    sudo certbot --nginx -d "$DOMAIN"

    ok "SSL 证书配置完成！"
  else
    info "跳过 SSL，稍后可手动执行: sudo certbot --nginx -d $DOMAIN"
  fi
else
  info "跳过 Nginx 配置。API 可直接通过 http://YOUR_SERVER_IP:3002 访问"
  info "如需配置 HTTPS，稍后可手动执行:"
  echo "  1. 安装 nginx: sudo apt install -y nginx"
  echo "  2. 参考 docs/DEPLOY_DOCKER.md 配置站点"
  echo "  3. 申请证书: sudo certbot --nginx -d $DOMAIN"
fi

# =============================================================================
# 完成
# =============================================================================
step "完成" "部署成功 🎉"

DOMAIN="${CORS_ORIGIN#https://}"
DOMAIN="${DOMAIN#http://}"

echo ""
echo -e "  ${GREEN}✅ safety-edu 已部署完成！${NC}"
echo ""
echo "  ┌─────────────────────────────────────────────────┐"
echo "  │                                                 │"
echo -e "  │  站点地址:  ${CYAN}https://$DOMAIN${NC}               │"
echo -e "  │  API 地址:  ${CYAN}http://localhost:3002${NC}          │"
echo "  │                                                 │"
echo "  │  管理命令:                                       │"
echo -e "  │    ${YELLOW}sudo docker compose logs -f api${NC}      │"
echo -e "  │    ${YELLOW}sudo docker compose logs -f runner${NC}   │"
echo -e "  │    ${YELLOW}sudo docker compose restart api${NC}      │"
echo "  │                                                 │"
echo "  │  项目目录: /opt/safety-edu                       │"
echo "  │  配置文件: /opt/safety-edu/.env                  │"
echo "  │                                                 │"
echo "  └─────────────────────────────────────────────────┘"
echo ""

# 显示密钥提醒
echo -e "  ${YELLOW}⚠️  重要提醒${NC}"
echo "  1. 备份 .env 文件！里面包含数据库密码和加密密钥"
echo "  2. ACCOUNT_ENC_KEY 一旦上线产生数据后就不要再改"
echo "  3. 定期备份数据库:"
echo "     sudo docker exec safety-mysql mysqldump -u root -p\"\$MYSQL_ROOT_PASSWORD\" lens_light > ~/backup.sql"
echo ""
echo -e "  ${CYAN}查看完整文档: cat docs/DEPLOY_DOCKER.md${NC}"
echo ""
