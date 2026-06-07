# 一键引导脚本（管理员初始化）

## 初始化管理员

```bash
cd /www/wwwroot/safety-edu/apps/api
node -e "
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash('CHANGE_ME_NOW', 10);
  await p.admin.upsert({
    where: { username: 'admin' },
    create: { username: 'admin', passwordHash: hash, role: 'super' },
    update: { passwordHash: hash },
  });
  console.log('admin 用户已创建/重置：username=admin, password=CHANGE_ME_NOW');
  await p.\$disconnect();
})();
"
```

## 初始化题库（导入 WeBan answer.json）

```bash
cd /www/wwwroot/safety-edu
python3 scripts/import_weiban_questions.py /path/to/answer.json
```

## 创建数据库

```sql
CREATE DATABASE safety_edu CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON safety_edu.* TO 'lens_light'@'localhost';
FLUSH PRIVILEGES;
```
