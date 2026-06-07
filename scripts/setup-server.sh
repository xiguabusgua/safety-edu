#!/usr/bin/env bash
# =============================================================================
# safety-edu · 服务器端一次性准备(配合 GitHub Actions 自动部署)
#
# 作用:
#   1. 创建 deploy 用户(非 root,符合最小权限原则)
#   2. 给 deploy 用户配 sudo 权限(限定 docker 命令)
#   3. 生成 deploy 用户的 SSH 密钥对(给 GitHub Actions 用)
#   4. 打印**公钥**(你贴到 GitHub Secrets 用)+ **私钥**(你贴到 GitHub Secrets 用)
#   5. 创建项目目录 /opt/safety-edu 和暂存 /opt/safety-edu-staging
#   6. 装 docker(如果没装)
#
# ⚠️ 警告:这个脚本要在服务器上以 root 身份跑一次,跑完**只跑这一次**。
#   跑完生成的私钥要立刻贴到 GitHub Secrets,贴完把服务器上的私钥删掉。
#
# 用法:
#   在你 Mac 上:scp scripts/setup-server.sh root@154.9.25.199:/tmp/
#   SSH 进服务器:ssh root@154.9.25.199
#   跑:bash /tmp/setup-server.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}[setup]${NC}  $1"; }
ok()   { echo -e "${GREEN}[setup]${NC}  ✅ $1"; }
warn() { echo -e "${YELLOW}[setup]${NC}  ⚠️  $1"; }
err()  { echo -e "${RED}[setup]${NC}  ❌ $1"; }

# ---- 前置检查 ----
if [ "$(id -u)" -ne 0 ]; then
  err "请用 root 跑: bash /tmp/setup-server.sh"
  exit 1
fi

DEPLOY_USER="deploy"
PROD_DIR="/opt/safety-edu"
STAGING_DIR="/opt/safety-edu-staging"
SSH_DIR="/home/${DEPLOY_USER}/.ssh"

# ---- Step 1: 创建 deploy 用户(如果不存在) ----
info "Step 1/6 · 创建 deploy 用户"
if id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  ok "用户 $DEPLOY_USER 已存在,跳过"
else
  # -m 创建 home,-s 设为 bash
  useradd -m -s /bin/bash "$DEPLOY_USER"
  ok "创建用户 $DEPLOY_USER"
fi

# ---- Step 2: 配 sudo 权限(限定 docker + docker compose) ----
info "Step 2/6 · 配 sudo(限定 docker 命令)"
SUDOERS_FILE="/etc/sudoers.d/${DEPLOY_USER}-docker"
cat > "$SUDOERS_FILE" << 'SUDOEOF'
# deploy 用户只能跑 docker 和 docker compose,不能干别的
deploy ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker compose
SUDOEOF
chmod 440 "$SUDOERS_FILE"
ok "sudo 权限: $SUDOERS_FILE"

# ---- Step 3: 装 docker(如果没装) ----
info "Step 3/6 · 检查/安装 Docker"
if ! command -v docker >/dev/null 2>&1; then
  warn "Docker 未安装,正在装..."
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
      ubuntu|debian)
        apt-get update -qq
        apt-get install -y -qq ca-certificates curl gnupg
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
        chmod a+r /etc/apt/keyrings/docker.asc
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
        ;;
      centos|rhel|rocky|almalinux)
        yum install -y -q yum-utils
        yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        yum install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
        systemctl enable --now docker
        ;;
    esac
  fi
fi
systemctl enable --now docker
usermod -aG docker "$DEPLOY_USER"
ok "Docker: $(docker --version)"
ok "用户 $DEPLOY_USER 已加入 docker 组"

# ---- Step 4: 创建项目目录 ----
info "Step 4/6 · 创建项目目录"
mkdir -p "$PROD_DIR" "$STAGING_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$PROD_DIR" "$STAGING_DIR"
ok "PROD:   $PROD_DIR"
ok "STAGING: $STAGING_DIR"

# ---- Step 5: 生成 deploy 用户的 SSH 密钥对 ----
info "Step 5/6 · 生成 SSH 密钥对"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

if [ -f "$SSH_DIR/id_ed25519" ]; then
  warn "SSH key 已存在,跳过生成"
else
  # 用 ed25519(比 RSA 快且短),no passphrase(让 GitHub Actions 免交互)
  sudo -u "$DEPLOY_USER" ssh-keygen -t ed25519 -N "" -f "$SSH_DIR/id_ed25519" -C "github-actions-deploy-$(date +%Y%m%d)"
  ok "SSH key 生成: $SSH_DIR/id_ed25519"
fi

# ---- Step 6: 打印 Secrets(关键!你贴到 GitHub) ----
info "Step 6/6 · 打印 GitHub Secrets 配置项"

# 服务器 host
HOST_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  复制下面三段,贴到 GitHub 仓库 → Settings → Secrets → Actions"
echo "  → New repository secret,各创建一个:"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "DEPLOY_HOST  =  ${HOST_IP}"
echo "DEPLOY_USER  =  ${DEPLOY_USER}"
echo "DEPLOY_KEY   =  (下面这段,从头到尾复制,包括 BEGIN/END 行)"
echo ""
echo "----- BEGIN PRIVATE KEY (复制从这里开始) -----"
sudo cat "$SSH_DIR/id_ed25519"
echo "----- END PRIVATE KEY (复制到这里结束) -----"
echo ""
echo "═══════════════════════════════════════════════════════════════"
warn "私钥已暴露在终端,复制完后执行:"
echo "  shred -u $SSH_DIR/id_ed25519  # 彻底删除,不可恢复"
echo "  rm -f $SSH_DIR/id_ed25519     # 上面那条如果不支持,用这条"
echo ""
echo "💡 提示:你也可以选择把公钥留作其他用途(比如本地 Mac 加进 known_hosts)"
echo "  公钥: $SSH_DIR/id_ed25519.pub"
echo ""

# ---- 完成 ----
echo "═══════════════════════════════════════════════════════════════"
echo "  🎉 服务器端准备完成!"
echo ""
echo "  接下来 3 步:"
echo "  1. GitHub 仓库 → Settings → Secrets → 配上面 3 个值"
echo "  2. shred 掉服务器上的私钥(上面那条命令)"
echo "  3. 推送代码触发首次部署:"
echo "       git push origin main"
echo "     或 Actions 页面 → Deploy → Run workflow"
echo "═══════════════════════════════════════════════════════════════"
