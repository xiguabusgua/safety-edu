#!/usr/bin/env bash
# =============================================================================
# safety-edu · 每日备份脚本
#
# 备份内容:
#   1. MySQL 全库 dump(safety-mysql 容器)
#   2. .env 文件(密钥)
#   3. 上传后的用户凭证文件(apps/api 容器里 /app/uploads,如果有)
#
# 策略:
#   - 每天凌晨 3:30 跑(crontab: 30 3 * * *)
#   - 本地保留 7 天
#   - 自动上传到 /www/backup/safety-edu/(宝塔默认 backup 目录,可选挂 oss)
#
# 用法:
#   chmod +x scripts/backup.sh
#   sudo mv scripts/backup.sh /opt/safety-edu/backup.sh
#   # 加 crontab
#   (crontab -l 2>/dev/null; echo "30 3 * * * /opt/safety-edu/backup.sh >> /var/log/safety-backup.log 2>&1") | crontab -
# =============================================================================
set -euo pipefail

PROJECT_DIR="/opt/safety-edu"
BACKUP_DIR="/www/backup/safety-edu"
KEEP_DAYS=7
DATE=$(date '+%Y%m%d-%H%M%S')
LOG_PREFIX="[backup ${DATE}]"

# ---- 颜色 ----
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}${LOG_PREFIX}${NC}  $1"; }
warn()  { echo -e "${YELLOW}${LOG_PREFIX}${NC}  $1"; }
err()   { echo -e "${RED}${LOG_PREFIX}${NC}  $1"; }

# ---- 准备 ----
mkdir -p "${BACKUP_DIR}"
cd "${PROJECT_DIR}"

# 读 MySQL 密码(从 .env)
if [ ! -f .env ]; then
  err ".env 不存在,无法备份"
  exit 1
fi
# shellcheck disable=SC1091
set -a; source .env; set +a

if [ -z "${MYSQL_PASSWORD:-}" ]; then
  err "MYSQL_PASSWORD 未在 .env 中设置"
  exit 1
fi

# ---- 1. MySQL dump ----
info "开始备份 MySQL..."
DB_DUMP_FILE="${BACKUP_DIR}/mysql-${DATE}.sql.gz"
docker exec safety-mysql mysqldump \
  -u root "-p${MYSQL_ROOT_PASSWORD}" \
  --single-transaction --routines --triggers --events \
  --hex-blob \
  lens_light 2>/dev/null \
  | gzip > "${DB_DUMP_FILE}"

if [ ! -s "${DB_DUMP_FILE}" ]; then
  err "MySQL dump 文件为空,失败"
  rm -f "${DB_DUMP_FILE}"
  exit 1
fi
DUMP_SIZE=$(du -h "${DB_DUMP_FILE}" | cut -f1)
info "MySQL dump 完成: ${DB_DUMP_FILE} (${DUMP_SIZE})"

# ---- 2. .env 备份(单独存,带 600 权限) ----
ENV_BACKUP_FILE="${BACKUP_DIR}/env-${DATE}.bak"
cp .env "${ENV_BACKUP_FILE}"
chmod 600 "${ENV_BACKUP_FILE}"
info ".env 备份完成: ${ENV_BACKUP_FILE}"

# ---- 3. 上传文件备份(如果容器里有) ----
UPLOADS_BACKUP_FILE="${BACKUP_DIR}/uploads-${DATE}.tar.gz"
if docker exec safety-api test -d /app/apps/api/uploads 2>/dev/null; then
  docker exec safety-api tar czf - -C /app/apps/api uploads 2>/dev/null > "${UPLOADS_BACKUP_FILE}"
  if [ -s "${UPLOADS_BACKUP_FILE}" ]; then
    info "uploads 备份完成: ${UPLOADS_BACKUP_FILE}"
  else
    warn "uploads 目录为空,跳过"
    rm -f "${UPLOADS_BACKUP_FILE}"
  fi
else
  info "uploads 目录不存在,跳过"
fi

# ---- 4. 清理 7 天前的旧备份 ----
DELETED=$(find "${BACKUP_DIR}" -type f \( -name 'mysql-*.sql.gz' -o -name 'env-*.bak' -o -name 'uploads-*.tar.gz' \) -mtime +${KEEP_DAYS} -delete -print | wc -l)
info "清理 ${KEEP_DAYS} 天前的备份: 删除 ${DELETED} 个"

# ---- 5. 总结 ----
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
FILE_COUNT=$(find "${BACKUP_DIR}" -type f | wc -l)
info "备份完成 — 当前备份目录: ${TOTAL_SIZE} / ${FILE_COUNT} 个文件"

# ---- 6. 可选:同步到远端(取消注释即可) ----
# 阿里云 OSS 示例:
#   /usr/local/bin/ossutil cp "${DB_DUMP_FILE}" oss://your-bucket/safety-edu/db/ --meta x-oss-storage-class:IA
#
# 腾讯云 COS 示例:
#   /usr/local/bin/coscli cp "${DB_DUMP_FILE}" cos://your-bucket-1250000000/safety-edu/db/

exit 0
