# 智能瞭望与智能问数系统 v0.3

本项目是企业实训第七阶段作业，使用 Node.js、Express 和原生 Web 技术实现前后台一体化的数据智能平台。

## 前台功能

- 用户登录与注册。
- 智能问数：自然语言查询系统业务数据，返回结论和可视化图表。
- AI 问答：支持普通问题以及 `@文案`、`@天气`、`@采集` 指令。
- 数字员工：文案编写专员、天气服务专员、智能采集专员。
- 报表呈现：舆情趋势、数据源健康、模型效果报表。
- 任务列表：记录数字员工任务、状态、进度和执行结果。
- 模型切换：在热点识别、情感分析、行业问数模型间切换。

## 后台功能

- 登录、用户管理、角色管理、功能管理、菜单管理。
- 瞭望采集、瞭源管理、数据仓库、模型引擎。
- 数字员工 CRUD、模型绑定、提示词配置、启停和在线调试。
- RBAC 服务端权限校验和动态菜单。

## DeepSeek 接入

系统会从环境变量读取 DeepSeek 密钥，密钥不会写入源码或提交包。复制 `.env.example` 中的配置到操作系统环境变量：

```powershell
$env:DEEPSEEK_API_KEY="你的 DeepSeek API Key"
$env:SESSION_SECRET="至少 32 字符的随机字符串"
npm start
```

配置密钥后，智能问数和数字员工优先调用 `deepseek-chat`；未配置或网络异常时自动使用内置离线逻辑，方便课堂演示。

## 启动

```powershell
cd "D:\Work\企业实训作业\day7"
npm install
npm start
```

访问入口：

- 前台：`http://localhost:3000/portal-login`
- 后台：`http://localhost:3000/login`

演示账号：

| 类型 | 账号 | 密码 |
| --- | --- | --- |
| 前台用户 | demo | 123456 |
| 后台管理员 | admin | admin123 |

## 自动测试

```powershell
npm test
```

测试覆盖后台原有模块、数字员工管理、前台注册、智能问数、三类数字员工、任务、模型切换、越权拦截和安全响应头。

## 安全设计

- 使用 `scrypt` 加盐哈希存储密码。
- Session Cookie 设置 `HttpOnly`、`SameSite=Lax`，生产环境启用 `Secure`。
- 登录失败频率限制。
- 同源写请求检查。
- CSP、防点击劫持、MIME 嗅探防护等安全响应头。
- 服务端 RBAC 权限校验。
- 前端动态内容统一 HTML 转义。
- API 密钥仅从环境变量读取，`.env` 被 Git 忽略。

## 目录结构

```text
day7/
├─ server.js
├─ package.json
├─ package-lock.json
├─ .env.example
├─ data/db.json
├─ public/
│  ├─ portal-login.html / register.html
│  ├─ portal.html / portal.css / portal.js
│  ├─ login.html / dashboard.html
│  └─ style.css / app.js
├─ test/system.test.js
└─ tools/create_demo_video.py
```

提交包不包含 `node_modules`、`venv`、`.venv`、真实 API 密钥和演示视频临时帧。
