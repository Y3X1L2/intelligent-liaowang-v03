const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function id(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

const DUMMY_PASSWORD_HASH = hashPassword('invalid-login-placeholder');

function permissionRows() {
  return [
    ['dashboard', '工作台', [['view', '查看工作台', 'GET', '/api/dashboard']]],
    ['collection', '瞭望采集', [['view', '查看采集任务', 'GET', '/api/collections'], ['create', '新增采集任务', 'POST', '/api/collections'], ['update', '编辑采集任务', 'PUT', '/api/collections/:id'], ['delete', '删除采集任务', 'DELETE', '/api/collections/:id'], ['run', '执行采集任务', 'POST', '/api/collections/:id/run']]],
    ['source', '瞭源管理', [['view', '查看数据源', 'GET', '/api/sources'], ['create', '新增数据源', 'POST', '/api/sources'], ['update', '编辑数据源', 'PUT', '/api/sources/:id'], ['delete', '删除数据源', 'DELETE', '/api/sources/:id'], ['test', '测试数据源', 'POST', '/api/sources/:id/test']]],
    ['warehouse', '数据仓库', [['view', '查看数据资产', 'GET', '/api/warehouse'], ['create', '新增数据资产', 'POST', '/api/warehouse'], ['update', '编辑数据资产', 'PUT', '/api/warehouse/:id'], ['delete', '删除数据资产', 'DELETE', '/api/warehouse/:id'], ['sync', '同步数据资产', 'POST', '/api/warehouse/:id/sync']]],
    ['model', '模型引擎', [['view', '查看模型', 'GET', '/api/models'], ['create', '新增模型', 'POST', '/api/models'], ['update', '编辑模型', 'PUT', '/api/models/:id'], ['delete', '删除模型', 'DELETE', '/api/models/:id'], ['run', '运行模型', 'POST', '/api/models/:id/run']]],
    ['user', '用户管理', [['view', '查看用户', 'GET', '/api/users'], ['create', '新增用户', 'POST', '/api/users'], ['update', '编辑用户', 'PUT', '/api/users/:id'], ['delete', '删除用户', 'DELETE', '/api/users/:id'], ['reset', '重置密码', 'POST', '/api/users/:id/reset-password']]],
    ['function', '功能管理', [['view', '查看功能', 'GET', '/api/functions'], ['create', '新增功能', 'POST', '/api/functions'], ['update', '编辑功能', 'PUT', '/api/functions/:id'], ['delete', '删除功能', 'DELETE', '/api/functions/:id']]],
    ['role', '角色管理', [['view', '查看角色', 'GET', '/api/roles'], ['create', '新增角色', 'POST', '/api/roles'], ['update', '编辑角色', 'PUT', '/api/roles/:id'], ['delete', '删除角色', 'DELETE', '/api/roles/:id']]],
    ['menu', '菜单管理', [['view', '查看菜单', 'GET', '/api/menus'], ['create', '新增菜单', 'POST', '/api/menus'], ['update', '编辑菜单', 'PUT', '/api/menus/:id'], ['delete', '删除菜单', 'DELETE', '/api/menus/:id']]]
  ];
}

function seedData() {
  const now = new Date().toISOString();
  const functions = permissionRows().flatMap(([prefix, module, actions]) => actions.map(([action, name, method, route]) => ({
    id: `fn-${prefix}-${action}`,
    name,
    code: `${prefix}:${action}`,
    module,
    method,
    route,
    description: `${module}的${name}权限`,
    status: 'enabled',
    createdAt: now
  })));

  const menus = [
    { id: 'menu-dashboard', name: '工作台', icon: 'DB', path: 'dashboard', parentId: null, permission: 'dashboard:view', sort: 1 },
    { id: 'menu-business', name: '数据业务', icon: 'OP', path: '', parentId: null, permission: '', sort: 2 },
    { id: 'menu-collections', name: '瞭望采集', icon: 'C', path: 'collections', parentId: 'menu-business', permission: 'collection:view', sort: 1 },
    { id: 'menu-sources', name: '瞭源管理', icon: 'S', path: 'sources', parentId: 'menu-business', permission: 'source:view', sort: 2 },
    { id: 'menu-warehouse', name: '数据仓库', icon: 'W', path: 'warehouse', parentId: 'menu-business', permission: 'warehouse:view', sort: 3 },
    { id: 'menu-models', name: '模型引擎', icon: 'AI', path: 'models', parentId: 'menu-business', permission: 'model:view', sort: 4 },
    { id: 'menu-system', name: '权限管理', icon: 'RB', path: '', parentId: null, permission: '', sort: 3 },
    { id: 'menu-users', name: '用户管理', icon: 'U', path: 'users', parentId: 'menu-system', permission: 'user:view', sort: 1 },
    { id: 'menu-functions', name: '功能管理', icon: 'F', path: 'functions', parentId: 'menu-system', permission: 'function:view', sort: 2 },
    { id: 'menu-roles', name: '角色管理', icon: 'R', path: 'roles', parentId: 'menu-system', permission: 'role:view', sort: 3 },
    { id: 'menu-menus', name: '菜单管理', icon: 'M', path: 'menus', parentId: 'menu-system', permission: 'menu:view', sort: 4 }
  ].map((menu) => ({ ...menu, visible: true, status: 'enabled', createdAt: now }));

  const allFunctionIds = functions.map((item) => item.id);
  const allMenuIds = menus.map((item) => item.id);
  const analystPermissions = ['dashboard:view', 'collection:view', 'source:view', 'warehouse:view', 'model:view'];
  const analystFunctionIds = functions.filter((item) => analystPermissions.includes(item.code)).map((item) => item.id);
  const analystMenuIds = ['menu-dashboard', 'menu-business', 'menu-collections', 'menu-sources', 'menu-warehouse', 'menu-models'];

  const db = {
    meta: { version: '0.2.0', updatedAt: now },
    users: [
      { id: 'user-admin', username: 'admin', realName: '系统管理员', passwordHash: hashPassword('admin123'), email: 'admin@liaowang.local', phone: '13800000000', roleIds: ['role-admin'], status: 'enabled', createdAt: now },
      { id: 'user-analyst', username: 'analyst', realName: '数据分析员', passwordHash: hashPassword('123456'), email: 'analyst@liaowang.local', phone: '13900000000', roleIds: ['role-analyst'], status: 'enabled', createdAt: now }
    ],
    roles: [
      { id: 'role-admin', name: '超级管理员', code: 'SUPER_ADMIN', description: '拥有系统全部业务与管理权限', functionIds: allFunctionIds, menuIds: allMenuIds, status: 'enabled', builtIn: true, createdAt: now },
      { id: 'role-analyst', name: '数据分析员', code: 'DATA_ANALYST', description: '可查看采集、数据源、仓库和模型运行情况', functionIds: analystFunctionIds, menuIds: analystMenuIds, status: 'enabled', builtIn: false, createdAt: now }
    ],
    functions,
    menus,
    sources: [
      { id: 'source-news', name: '主流新闻站点', type: 'Web API', endpoint: 'https://news.example/api', owner: '采集一组', status: 'connected', lastCheck: now, description: '新闻资讯实时接口', createdAt: now },
      { id: 'source-social', name: '公开社交数据', type: 'Crawler', endpoint: 'https://social.example', owner: '采集二组', status: 'connected', lastCheck: now, description: '公开话题与传播数据', createdAt: now },
      { id: 'source-report', name: '行业报告库', type: 'SFTP', endpoint: 'sftp://report.example/data', owner: '研究中心', status: 'disconnected', lastCheck: now, description: '定期同步行业报告文件', createdAt: now }
    ],
    collectionTasks: [
      { id: 'collection-news', name: '新闻热点实时采集', sourceId: 'source-news', frequency: '每 10 分钟', target: 'ods_news_event', status: 'enabled', records: 128640, lastRun: now, nextRun: new Date(Date.now() + 10 * 60 * 1000).toISOString(), description: '采集新闻标题、正文及来源', createdAt: now },
      { id: 'collection-social', name: '社交话题趋势采集', sourceId: 'source-social', frequency: '每 30 分钟', target: 'ods_social_topic', status: 'enabled', records: 85320, lastRun: now, nextRun: new Date(Date.now() + 30 * 60 * 1000).toISOString(), description: '采集公开话题趋势数据', createdAt: now },
      { id: 'collection-report', name: '行业报告每日同步', sourceId: 'source-report', frequency: '每天 02:00', target: 'ods_industry_report', status: 'paused', records: 4860, lastRun: now, nextRun: null, description: '同步行业研究报告', createdAt: now }
    ],
    warehouse: [
      { id: 'warehouse-news', name: '新闻事件明细表', layer: 'DWD', format: 'Parquet', owner: '数据平台组', source: 'ods_news_event', rowCount: 2368000, size: '6.8 GB', status: 'active', updatedAt: now, description: '清洗后的新闻事件明细', createdAt: now },
      { id: 'warehouse-topic', name: '话题趋势汇总表', layer: 'DWS', format: 'Iceberg', owner: '数据分析组', source: 'ods_social_topic', rowCount: 685000, size: '2.1 GB', status: 'active', updatedAt: now, description: '按小时汇总的话题热度', createdAt: now },
      { id: 'warehouse-report', name: '行业知识文档库', layer: 'ADS', format: 'Vector', owner: '模型研发组', source: 'ods_industry_report', rowCount: 4860, size: '12.4 GB', status: 'active', updatedAt: now, description: '供问数模型检索的向量库', createdAt: now }
    ],
    models: [
      { id: 'model-topic', name: '热点主题识别模型', type: '文本分类', version: 'v2.3.1', framework: 'Transformers', accuracy: 94.6, status: 'ready', lastRun: now, description: '识别新闻与社交内容主题', createdAt: now },
      { id: 'model-sentiment', name: '舆情情感分析模型', type: '情感分析', version: 'v1.8.0', framework: 'PyTorch', accuracy: 92.8, status: 'ready', lastRun: now, description: '判断文本情感倾向', createdAt: now },
      { id: 'model-qa', name: '行业问数模型', type: 'RAG 问答', version: 'v0.9.5', framework: 'LLM + Vector', accuracy: 88.4, status: 'training', lastRun: now, description: '基于数据仓库的行业问答模型', createdAt: now }
    ]
  };

  const employeeFunctions = [
    ['view', '查看数字员工', 'GET', '/api/employees'],
    ['create', '新增数字员工', 'POST', '/api/employees'],
    ['update', '编辑数字员工', 'PUT', '/api/employees/:id'],
    ['delete', '删除数字员工', 'DELETE', '/api/employees/:id'],
    ['run', '调试数字员工', 'POST', '/api/employees/:id/run']
  ].map(([action, name, method, route]) => ({
    id: `fn-employee-${action}`,
    name,
    code: `employee:${action}`,
    module: '数字员工',
    method,
    route,
    description: `数字员工的${name}权限`,
    status: 'enabled',
    createdAt: now
  }));
  db.functions.push(...employeeFunctions);

  const employeeMenu = { id: 'menu-employees', name: '数字员工', icon: 'DE', path: 'employees', parentId: 'menu-business', permission: 'employee:view', sort: 5, visible: true, status: 'enabled', createdAt: now };
  db.menus.push(employeeMenu);
  const adminRole = db.roles.find((role) => role.id === 'role-admin');
  adminRole.functionIds.push(...employeeFunctions.map((item) => item.id));
  adminRole.menuIds.push(employeeMenu.id);

  db.roles.push({ id: 'role-member', name: '前台用户', code: 'PORTAL_MEMBER', description: '使用智能问数与数字员工前台', functionIds: [], menuIds: [], status: 'enabled', builtIn: true, createdAt: now });
  db.users.push({ id: 'user-demo', username: 'demo', realName: '演示用户', passwordHash: hashPassword('123456'), email: 'demo@liaowang.local', phone: '', roleIds: ['role-member'], status: 'enabled', createdAt: now });
  db.digitalEmployees = [
    { id: 'employee-writer', code: 'writer', name: '文案编写专员', avatar: 'WR', specialty: '新闻稿、宣传文案、摘要与标题生成', modelId: 'model-qa', prompt: '根据用户主题生成结构清晰、语言专业的中文文案。', status: 'enabled', callCount: 128, createdAt: now },
    { id: 'employee-weather', code: 'weather', name: '天气服务专员', avatar: 'WT', specialty: '城市天气查询、出行与采集窗口建议', modelId: 'model-topic', prompt: '提供模拟天气信息，并给出出行和数据采集建议。', status: 'enabled', callCount: 86, createdAt: now },
    { id: 'employee-collector', code: 'collector', name: '智能采集专员', avatar: 'CL', specialty: '采集方案设计、任务拆解与数据源推荐', modelId: 'model-topic', prompt: '将采集需求转换为可执行任务方案。', status: 'enabled', callCount: 203, createdAt: now }
  ];
  db.portalTasks = [
    { id: 'task-demo-1', userId: 'user-demo', title: '生成本周行业热点摘要', employeeCode: 'writer', status: 'completed', progress: 100, result: '已生成 6 条热点摘要与标题建议。', createdAt: now, updatedAt: now },
    { id: 'task-demo-2', userId: 'user-demo', title: '检查新闻数据源采集状态', employeeCode: 'collector', status: 'running', progress: 65, result: '', createdAt: now, updatedAt: now }
  ];
  db.reports = [
    { id: 'report-trend', name: '舆情趋势周报', type: '趋势分析', period: '本周', metric: '热点事件', value: 128, change: 18.6, color: '#18a999', createdAt: now },
    { id: 'report-source', name: '数据源健康报告', type: '运行质量', period: '今日', metric: '连接成功率', value: 96.4, change: 2.1, color: '#3b78a6', createdAt: now },
    { id: 'report-model', name: '模型效果报告', type: '模型评估', period: 'v0.3', metric: '平均准确率', value: 92.1, change: 1.7, color: '#7e61b6', createdAt: now }
  ];
  db.userPreferences = { 'user-demo': { modelId: 'model-qa' } };
  db.conversations = [];
  db.meta.version = '0.3.0';
  return db;
}

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(seedData(), null, 2), 'utf8');
}

function readDb() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeDb(db) {
  db.meta.updatedAt = new Date().toISOString();
  const temp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(temp, DATA_FILE);
}

function publicUser(user, db) {
  const { passwordHash, ...safe } = user;
  return { ...safe, roles: db.roles.filter((role) => user.roleIds.includes(role.id)).map(({ id: roleId, name, code }) => ({ id: roleId, name, code })) };
}

function getAccess(user, db) {
  const roles = db.roles.filter((role) => user.roleIds.includes(role.id) && role.status === 'enabled');
  const functionIds = new Set(roles.flatMap((role) => role.functionIds));
  const permissions = db.functions.filter((item) => functionIds.has(item.id) && item.status === 'enabled').map((item) => item.code);
  const menuIds = new Set(roles.flatMap((role) => role.menuIds));
  const menus = db.menus.filter((menu) => menuIds.has(menu.id) && menu.status === 'enabled' && menu.visible)
    .filter((menu) => !menu.permission || permissions.includes(menu.permission)).sort((a, b) => a.sort - b.sort);
  return { permissions, menus };
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(session({ name: 'liaowang.sid', secret: SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 } }));
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== req.get('host')) return res.status(403).json({ success: false, message: '跨站请求已被拦截' });
    } catch { return res.status(403).json({ success: false, message: '请求来源无效' }); }
  }
  return next();
});
app.use(express.static(path.join(__dirname, 'public')));

const loginAttempts = new Map();

function isLoginBlocked(key) {
  const record = loginAttempts.get(key);
  if (!record || Date.now() - record.startedAt > 10 * 60 * 1000) return false;
  return record.count >= 8;
}

function recordLoginFailure(key) {
  if (loginAttempts.size > 5000) {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [itemKey, record] of loginAttempts) if (record.startedAt < cutoff) loginAttempts.delete(itemKey);
  }
  const record = loginAttempts.get(key);
  if (!record || Date.now() - record.startedAt > 10 * 60 * 1000) loginAttempts.set(key, { count: 1, startedAt: Date.now() });
  else record.count += 1;
}

function cleanText(value, maxLength = 200) {
  return String(value || '').trim().slice(0, maxLength);
}

async function callDeepSeek(systemPrompt, userMessage) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', temperature: 0.5, max_tokens: 900, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) return null;
    const data = await response.json();
    return cleanText(data.choices?.[0]?.message?.content, 4000) || null;
  } catch {
    return null;
  }
}

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ success: false, message: '登录状态已失效，请重新登录' });
  const db = readDb();
  const user = db.users.find((item) => item.id === req.session.userId && item.status === 'enabled');
  if (!user) return req.session.destroy(() => res.status(401).json({ success: false, message: '用户不存在或已停用' }));
  req.db = db;
  req.currentUser = user;
  req.access = getAccess(user, db);
  next();
}

function allow(permission) {
  return [requireLogin, (req, res, next) => req.access.permissions.includes(permission) ? next() : res.status(403).json({ success: false, message: `无权限执行此操作：${permission}` })];
}

function required(value, label) {
  return String(value || '').trim() ? null : `${label}不能为空`;
}

function badRequest(res, message) {
  return res.status(400).json({ success: false, message });
}

app.get('/', (req, res) => res.redirect(req.session.userId ? '/app' : '/portal-login'));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/portal-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'portal-login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/app', (req, res) => req.session.userId ? res.sendFile(path.join(__dirname, 'public', 'portal.html')) : res.redirect('/portal-login'));
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const db = readDb();
  const user = db.users.find((item) => item.id === req.session.userId);
  if (!user || getAccess(user, db).permissions.length === 0) return res.redirect('/app');
  return res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post(['/api/login', '/api/auth/login'], (req, res) => {
  const attemptKey = `${req.ip}:${cleanText(req.body.username, 40).toLowerCase()}`;
  if (isLoginBlocked(attemptKey)) return res.status(429).json({ success: false, message: '登录尝试过于频繁，请 10 分钟后重试' });
  const db = readDb();
  const user = db.users.find((item) => item.username === cleanText(req.body.username, 40));
  const passwordValid = verifyPassword(String(req.body.password || ''), user?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!user || user.status !== 'enabled' || !passwordValid) {
    recordLoginFailure(attemptKey);
    return res.status(401).json({ success: false, message: '用户名或密码错误，或账号已停用' });
  }
  loginAttempts.delete(attemptKey);
  const access = getAccess(user, db);
  return req.session.regenerate((error) => {
    if (error) return res.status(500).json({ success: false, message: '会话初始化失败' });
    req.session.userId = user.id;
    return res.json({ success: true, message: '登录成功', destination: access.permissions.length ? '/dashboard' : '/app', data: { ...publicUser(user, db), ...access } });
  });
});

app.post('/api/auth/register', (req, res) => {
  const db = readDb();
  const username = cleanText(req.body.username, 30);
  const realName = cleanText(req.body.realName, 40);
  const password = String(req.body.password || '');
  const email = cleanText(req.body.email, 100);
  if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) return badRequest(res, '用户名只能包含字母、数字、下划线，长度 3-30 位');
  if (!realName) return badRequest(res, '姓名不能为空');
  if (password.length < 6 || password.length > 72) return badRequest(res, '密码长度应为 6-72 位');
  if (db.users.some((item) => item.username.toLowerCase() === username.toLowerCase())) return badRequest(res, '用户名已存在');
  const user = { id: id('user'), username, realName, passwordHash: hashPassword(password), email, phone: '', roleIds: ['role-member'], status: 'enabled', createdAt: new Date().toISOString() };
  db.users.push(user);
  db.userPreferences[user.id] = { modelId: 'model-qa' };
  writeDb(db);
  return req.session.regenerate((error) => {
    if (error) return res.status(500).json({ success: false, message: '会话初始化失败' });
    req.session.userId = user.id;
    return res.status(201).json({ success: true, message: '注册成功', destination: '/app', data: publicUser(user, db) });
  });
});

app.post(['/api/legacy-login-disabled'], (req, res) => {
  const db = readDb();
  const user = db.users.find((item) => item.username === String(req.body.username || '').trim());
  if (!user || user.status !== 'enabled' || !verifyPassword(String(req.body.password || ''), user.passwordHash)) return res.status(401).json({ success: false, message: '用户名或密码错误，或账号已停用' });
  req.session.userId = user.id;
  res.json({ success: true, message: '登录成功', data: publicUser(user, db) });
});

app.post(['/api/logout', '/api/auth/logout'], (req, res) => req.session.destroy(() => res.json({ success: true, message: '已退出登录' })));
app.get(['/api/user', '/api/auth/me'], requireLogin, (req, res) => res.json({ success: true, loggedIn: true, data: { ...publicUser(req.currentUser, req.db), ...req.access } }));

app.get('/api/dashboard', ...allow('dashboard:view'), (req, res) => {
  const db = req.db;
  res.json({ success: true, data: {
    counts: {
      collections: db.collectionTasks.length,
      runningCollections: db.collectionTasks.filter((item) => item.status === 'enabled').length,
      sources: db.sources.length,
      connectedSources: db.sources.filter((item) => item.status === 'connected').length,
      warehouse: db.warehouse.length,
      warehouseRows: db.warehouse.reduce((sum, item) => sum + Number(item.rowCount || 0), 0),
      models: db.models.length,
      readyModels: db.models.filter((item) => item.status === 'ready').length,
      users: db.users.length,
      roles: db.roles.length,
      functions: db.functions.length,
      menus: db.menus.length,
      employees: db.digitalEmployees.length,
      enabledEmployees: db.digitalEmployees.filter((item) => item.status === 'enabled').length
    },
    recentTasks: db.collectionTasks.slice().sort((a, b) => String(b.lastRun).localeCompare(String(a.lastRun))).slice(0, 5),
    sourceHealth: db.sources.map((item) => ({ id: item.id, name: item.name, type: item.type, status: item.status, lastCheck: item.lastCheck })),
    modelOverview: db.models.map((item) => ({ id: item.id, name: item.name, accuracy: item.accuracy, status: item.status }))
  }});
});

const businessConfigs = {
  collections: {
    key: 'collectionTasks', prefix: 'collection', label: '采集任务',
    normalize(body, current, db) {
      const sourceId = String(body.sourceId || '');
      if (!db.sources.some((source) => source.id === sourceId)) throw new Error('请选择有效的数据源');
      return { name: String(body.name).trim(), sourceId, frequency: String(body.frequency || '每天').trim(), target: String(body.target || '').trim(), status: body.status === 'paused' ? 'paused' : 'enabled', records: current?.records || 0, lastRun: current?.lastRun || null, nextRun: body.nextRun || current?.nextRun || null, description: String(body.description || '').trim() };
    }
  },
  sources: {
    key: 'sources', prefix: 'source', label: '数据源',
    normalize(body, current) { return { name: String(body.name).trim(), type: String(body.type || 'Web API').trim(), endpoint: String(body.endpoint || '').trim(), owner: String(body.owner || '').trim(), status: ['connected', 'disconnected'].includes(body.status) ? body.status : (current?.status || 'disconnected'), lastCheck: current?.lastCheck || null, description: String(body.description || '').trim() }; }
  },
  warehouse: {
    key: 'warehouse', prefix: 'warehouse', label: '数据资产',
    normalize(body, current) { return { name: String(body.name).trim(), layer: String(body.layer || 'ODS').trim().toUpperCase(), format: String(body.format || 'Parquet').trim(), owner: String(body.owner || '').trim(), source: String(body.source || '').trim(), rowCount: Number(body.rowCount || current?.rowCount || 0), size: String(body.size || '0 MB').trim(), status: body.status === 'archived' ? 'archived' : 'active', updatedAt: current?.updatedAt || new Date().toISOString(), description: String(body.description || '').trim() }; }
  },
  models: {
    key: 'models', prefix: 'model', label: '模型',
    normalize(body, current) { return { name: String(body.name).trim(), type: String(body.type || '').trim(), version: String(body.version || 'v1.0.0').trim(), framework: String(body.framework || '').trim(), accuracy: Number(body.accuracy || current?.accuracy || 0), status: ['ready', 'training', 'offline'].includes(body.status) ? body.status : 'ready', lastRun: current?.lastRun || null, description: String(body.description || '').trim() }; }
  }
};

Object.entries(businessConfigs).forEach(([route, config]) => {
  app.get(`/api/${route}`, ...allow(`${config.prefix}:view`), (req, res) => res.json({ success: true, data: req.db[config.key] }));
  app.post(`/api/${route}`, ...allow(`${config.prefix}:create`), (req, res) => {
    const error = required(req.body.name, `${config.label}名称`);
    if (error) return badRequest(res, error);
    try {
      const item = { id: id(config.prefix), ...config.normalize(req.body, null, req.db), createdAt: new Date().toISOString() };
      req.db[config.key].push(item);
      writeDb(req.db);
      return res.status(201).json({ success: true, message: `${config.label}创建成功`, data: item });
    } catch (errorValue) { return badRequest(res, errorValue.message); }
  });
  app.put(`/api/${route}/:id`, ...allow(`${config.prefix}:update`), (req, res) => {
    const item = req.db[config.key].find((value) => value.id === req.params.id);
    if (!item) return res.status(404).json({ success: false, message: `${config.label}不存在` });
    const error = required(req.body.name, `${config.label}名称`);
    if (error) return badRequest(res, error);
    try {
      Object.assign(item, config.normalize(req.body, item, req.db), { updatedAt: new Date().toISOString() });
      writeDb(req.db);
      return res.json({ success: true, message: `${config.label}更新成功`, data: item });
    } catch (errorValue) { return badRequest(res, errorValue.message); }
  });
  app.delete(`/api/${route}/:id`, ...allow(`${config.prefix}:delete`), (req, res) => {
    const item = req.db[config.key].find((value) => value.id === req.params.id);
    if (!item) return res.status(404).json({ success: false, message: `${config.label}不存在` });
    if (route === 'sources' && req.db.collectionTasks.some((task) => task.sourceId === item.id)) return badRequest(res, '该数据源仍被采集任务使用，不能删除');
    req.db[config.key] = req.db[config.key].filter((value) => value.id !== item.id);
    writeDb(req.db);
    return res.json({ success: true, message: `${config.label}已删除` });
  });
});

app.post('/api/collections/:id/run', ...allow('collection:run'), (req, res) => {
  const task = req.db.collectionTasks.find((item) => item.id === req.params.id);
  if (!task) return res.status(404).json({ success: false, message: '采集任务不存在' });
  const added = Math.floor(Math.random() * 900 + 100);
  task.lastRun = new Date().toISOString();
  task.records += added;
  task.status = 'enabled';
  task.nextRun = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  writeDb(req.db);
  res.json({ success: true, message: `采集完成，新增 ${added} 条数据`, data: task });
});

app.post('/api/sources/:id/test', ...allow('source:test'), (req, res) => {
  const source = req.db.sources.find((item) => item.id === req.params.id);
  if (!source) return res.status(404).json({ success: false, message: '数据源不存在' });
  source.status = source.endpoint ? 'connected' : 'disconnected';
  source.lastCheck = new Date().toISOString();
  writeDb(req.db);
  res.json({ success: true, message: source.status === 'connected' ? '连接测试成功' : '连接测试失败：缺少连接地址', data: source });
});

app.post('/api/warehouse/:id/sync', ...allow('warehouse:sync'), (req, res) => {
  const asset = req.db.warehouse.find((item) => item.id === req.params.id);
  if (!asset) return res.status(404).json({ success: false, message: '数据资产不存在' });
  asset.rowCount += Math.floor(Math.random() * 5000 + 500);
  asset.updatedAt = new Date().toISOString();
  asset.status = 'active';
  writeDb(req.db);
  res.json({ success: true, message: '数据资产同步完成', data: asset });
});

app.post('/api/models/:id/run', ...allow('model:run'), (req, res) => {
  const model = req.db.models.find((item) => item.id === req.params.id);
  if (!model) return res.status(404).json({ success: false, message: '模型不存在' });
  model.lastRun = new Date().toISOString();
  model.status = 'ready';
  model.accuracy = Math.min(99.9, Number((model.accuracy + Math.random() * 0.2).toFixed(1)));
  writeDb(req.db);
  res.json({ success: true, message: '模型推理任务执行成功', data: model });
});

app.get('/api/employees', ...allow('employee:view'), (req, res) => res.json({ success: true, data: req.db.digitalEmployees }));
app.post('/api/employees', ...allow('employee:create'), (req, res) => {
  const name = cleanText(req.body.name, 50);
  const code = cleanText(req.body.code, 30).toLowerCase();
  if (!name || !/^[a-z][a-z0-9_-]{2,29}$/.test(code)) return badRequest(res, '员工名称不能为空，编码需为 3-30 位小写字母、数字或连接符');
  if (req.db.digitalEmployees.some((item) => item.code === code)) return badRequest(res, '数字员工编码已存在');
  const employee = { id: id('employee'), code, name, avatar: cleanText(req.body.avatar, 3) || 'AI', specialty: cleanText(req.body.specialty, 160), modelId: cleanText(req.body.modelId, 60), prompt: cleanText(req.body.prompt, 500), status: req.body.status === 'disabled' ? 'disabled' : 'enabled', callCount: 0, createdAt: new Date().toISOString() };
  req.db.digitalEmployees.push(employee); writeDb(req.db);
  res.status(201).json({ success: true, message: '数字员工创建成功', data: employee });
});
app.put('/api/employees/:id', ...allow('employee:update'), (req, res) => {
  const employee = req.db.digitalEmployees.find((item) => item.id === req.params.id);
  if (!employee) return res.status(404).json({ success: false, message: '数字员工不存在' });
  const name = cleanText(req.body.name, 50); const code = cleanText(req.body.code, 30).toLowerCase();
  if (!name || !/^[a-z][a-z0-9_-]{2,29}$/.test(code)) return badRequest(res, '员工名称或编码格式无效');
  if (req.db.digitalEmployees.some((item) => item.id !== employee.id && item.code === code)) return badRequest(res, '数字员工编码已存在');
  Object.assign(employee, { code, name, avatar: cleanText(req.body.avatar, 3) || 'AI', specialty: cleanText(req.body.specialty, 160), modelId: cleanText(req.body.modelId, 60), prompt: cleanText(req.body.prompt, 500), status: req.body.status === 'disabled' ? 'disabled' : 'enabled', updatedAt: new Date().toISOString() });
  writeDb(req.db); res.json({ success: true, message: '数字员工更新成功', data: employee });
});
app.delete('/api/employees/:id', ...allow('employee:delete'), (req, res) => {
  const employee = req.db.digitalEmployees.find((item) => item.id === req.params.id);
  if (!employee) return res.status(404).json({ success: false, message: '数字员工不存在' });
  if (['writer', 'weather', 'collector'].includes(employee.code)) return badRequest(res, '内置数字员工不能删除，可设置为停用');
  req.db.digitalEmployees = req.db.digitalEmployees.filter((item) => item.id !== employee.id); writeDb(req.db); res.json({ success: true, message: '数字员工已删除' });
});
app.post('/api/employees/:id/run', ...allow('employee:run'), (req, res) => {
  const employee = req.db.digitalEmployees.find((item) => item.id === req.params.id);
  if (!employee) return res.status(404).json({ success: false, message: '数字员工不存在' });
  employee.callCount += 1; employee.lastRun = new Date().toISOString(); writeDb(req.db);
  res.json({ success: true, message: '数字员工调试成功', data: { reply: `${employee.name} 已成功响应测试指令。`, employee } });
});

function buildQuestionAnswer(question, model, db) {
  const text = cleanText(question, 500);
  if (/用户|账号/.test(text)) return { answer: `当前系统共有 ${db.users.length} 个用户，其中 ${db.users.filter((item) => item.status === 'enabled').length} 个账号处于启用状态。`, chart: { title: '用户状态', labels: ['启用', '停用'], values: [db.users.filter((item) => item.status === 'enabled').length, db.users.filter((item) => item.status !== 'enabled').length] } };
  if (/采集|数据量/.test(text)) return { answer: `当前有 ${db.collectionTasks.length} 个采集任务，累计采集 ${db.collectionTasks.reduce((sum, item) => sum + item.records, 0).toLocaleString('zh-CN')} 条数据。`, chart: { title: '采集任务数据量', labels: db.collectionTasks.map((item) => item.name), values: db.collectionTasks.map((item) => item.records) } };
  if (/数据源|连接/.test(text)) return { answer: `${db.sources.length} 个数据源中有 ${db.sources.filter((item) => item.status === 'connected').length} 个连接正常。`, chart: { title: '数据源状态', labels: db.sources.map((item) => item.name), values: db.sources.map((item) => item.status === 'connected' ? 100 : 0) } };
  if (/模型|准确率/.test(text)) return { answer: `当前模型平均准确率为 ${(db.models.reduce((sum, item) => sum + item.accuracy, 0) / db.models.length).toFixed(1)}%，本次由 ${model.name} 完成分析。`, chart: { title: '模型准确率', labels: db.models.map((item) => item.name), values: db.models.map((item) => item.accuracy) } };
  return { answer: `已使用 ${model.name} 分析“${text}”。系统建议先查看采集任务与数据源健康度，再结合仓库资产和模型结果形成结论。`, chart: { title: '平台业务概览', labels: ['采集任务', '数据源', '仓库资产', '模型'], values: [db.collectionTasks.length, db.sources.length, db.warehouse.length, db.models.length] } };
}

function employeeReply(code, message, db) {
  const text = cleanText(message, 500);
  if (code === 'writer') return { reply: `【智能文案】\n标题：${text || '智能瞭望数据洞察'}\n\n正文：围绕“${text || '数据智能'}”，瞭望与问数系统通过多源采集、统一数仓和模型分析，形成从数据获取到洞察输出的完整闭环。建议结合目标受众补充真实案例与关键指标。`, taskTitle: `编写文案：${text || '数据智能'}` };
  if (code === 'weather') {
    const city = text.replace(/天气|怎么样|如何|查询/g, '').trim() || '成都';
    const temperature = 20 + (city.length * 3) % 12;
    return { reply: `${city}模拟天气：多云，${temperature}℃，湿度 62%，东南风 2 级。适合安排公开数据采集，建议避开 12:00-14:00 的接口高峰。`, taskTitle: `查询${city}天气` };
  }
  const sourceNames = db.sources.filter((item) => item.status === 'connected').map((item) => item.name).join('、');
  return { reply: `【采集方案】\n1. 需求：${text || '行业热点数据'}\n2. 推荐数据源：${sourceNames}\n3. 调度：每 30 分钟增量采集\n4. 入仓：ODS 原始层后进入 DWD 清洗层\n5. 质量检查：去重率、字段完整率、连接成功率。`, taskTitle: `制定采集方案：${text || '行业热点'}` };
}

app.get('/api/portal/bootstrap', requireLogin, (req, res) => {
  const preference = req.db.userPreferences[req.currentUser.id] || { modelId: 'model-qa' };
  const tasks = req.db.portalTasks.filter((item) => item.userId === req.currentUser.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ success: true, data: { user: publicUser(req.currentUser, req.db), models: req.db.models.filter((item) => item.status !== 'offline'), employees: req.db.digitalEmployees.filter((item) => item.status === 'enabled'), reports: req.db.reports, tasks, preference } });
});
app.post('/api/portal/ask', requireLogin, async (req, res) => {
  const question = cleanText(req.body.question, 500); if (!question) return badRequest(res, '问题不能为空');
  const preference = req.db.userPreferences[req.currentUser.id] || { modelId: 'model-qa' };
  const model = req.db.models.find((item) => item.id === cleanText(req.body.modelId, 60)) || req.db.models.find((item) => item.id === preference.modelId) || req.db.models[0];
  const result = buildQuestionAnswer(question, model, req.db);
  const deepSeekAnswer = await callDeepSeek('你是智能瞭望与智能问数系统的数据分析助手。请使用简体中文，根据提供的平台统计上下文回答，结论清晰、简洁，不编造外部事实。', `用户问题：${question}\n平台统计上下文：${result.answer}`);
  if (deepSeekAnswer) result.answer = deepSeekAnswer;
  req.db.conversations.push({ id: id('conversation'), userId: req.currentUser.id, type: 'question', modelId: model.id, question, answer: result.answer, createdAt: new Date().toISOString() });
  writeDb(req.db); res.json({ success: true, data: { ...result, model: { id: model.id, name: model.name, version: model.version } } });
});
app.post('/api/portal/agents/:code/chat', requireLogin, async (req, res) => {
  const employee = req.db.digitalEmployees.find((item) => item.code === req.params.code && item.status === 'enabled');
  if (!employee) return res.status(404).json({ success: false, message: '数字员工不存在或已停用' });
  const result = employeeReply(employee.code, req.body.message, req.db);
  const deepSeekReply = await callDeepSeek(employee.prompt, cleanText(req.body.message, 500));
  if (deepSeekReply) result.reply = deepSeekReply;
  employee.callCount += 1; employee.lastRun = new Date().toISOString();
  const task = { id: id('task'), userId: req.currentUser.id, title: result.taskTitle, employeeCode: employee.code, status: 'completed', progress: 100, result: result.reply, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  req.db.portalTasks.push(task); writeDb(req.db);
  res.json({ success: true, data: { employee: { code: employee.code, name: employee.name, avatar: employee.avatar }, reply: result.reply, task } });
});
app.get('/api/portal/tasks', requireLogin, (req, res) => res.json({ success: true, data: req.db.portalTasks.filter((item) => item.userId === req.currentUser.id) }));
app.patch('/api/portal/tasks/:id', requireLogin, (req, res) => {
  const task = req.db.portalTasks.find((item) => item.id === req.params.id && item.userId === req.currentUser.id);
  if (!task) return res.status(404).json({ success: false, message: '任务不存在' });
  if (['pending', 'running', 'completed', 'cancelled'].includes(req.body.status)) task.status = req.body.status;
  task.updatedAt = new Date().toISOString(); writeDb(req.db); res.json({ success: true, message: '任务状态已更新', data: task });
});
app.put('/api/portal/preference', requireLogin, (req, res) => {
  const modelId = cleanText(req.body.modelId, 60);
  if (!req.db.models.some((item) => item.id === modelId && item.status !== 'offline')) return badRequest(res, '模型不存在或不可用');
  req.db.userPreferences[req.currentUser.id] = { modelId }; writeDb(req.db); res.json({ success: true, message: '默认模型已切换', data: { modelId } });
});

app.get('/api/users', ...allow('user:view'), (req, res) => res.json({ success: true, data: req.db.users.map((user) => publicUser(user, req.db)) }));
app.post('/api/users', ...allow('user:create'), (req, res) => {
  const db = req.db;
  const error = required(req.body.username, '用户名') || required(req.body.realName, '姓名') || required(req.body.password, '初始密码');
  if (error) return badRequest(res, error);
  const username = String(req.body.username).trim();
  if (db.users.some((item) => item.username === username)) return badRequest(res, '用户名已存在');
  const roleIds = Array.isArray(req.body.roleIds) ? req.body.roleIds.filter((roleId) => db.roles.some((role) => role.id === roleId)) : [];
  const user = { id: id('user'), username, realName: String(req.body.realName).trim(), passwordHash: hashPassword(String(req.body.password)), email: String(req.body.email || '').trim(), phone: String(req.body.phone || '').trim(), roleIds, status: req.body.status === 'disabled' ? 'disabled' : 'enabled', createdAt: new Date().toISOString() };
  db.users.push(user); writeDb(db);
  res.status(201).json({ success: true, message: '用户创建成功', data: publicUser(user, db) });
});
app.put('/api/users/:id', ...allow('user:update'), (req, res) => {
  const db = req.db;
  const user = db.users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
  const error = required(req.body.realName, '姓名'); if (error) return badRequest(res, error);
  if (user.id === req.currentUser.id && req.body.status === 'disabled') return badRequest(res, '不能停用当前登录账号');
  const roleIds = Array.isArray(req.body.roleIds) ? req.body.roleIds.filter((roleId) => db.roles.some((role) => role.id === roleId)) : [];
  Object.assign(user, { realName: String(req.body.realName).trim(), email: String(req.body.email || '').trim(), phone: String(req.body.phone || '').trim(), roleIds, status: req.body.status === 'disabled' ? 'disabled' : 'enabled', updatedAt: new Date().toISOString() });
  writeDb(db); res.json({ success: true, message: '用户更新成功', data: publicUser(user, db) });
});
app.delete('/api/users/:id', ...allow('user:delete'), (req, res) => {
  const user = req.db.users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
  if (user.id === req.currentUser.id || user.id === 'user-admin') return badRequest(res, '不能删除当前账号或内置管理员');
  req.db.users = req.db.users.filter((item) => item.id !== user.id);
  req.db.portalTasks = req.db.portalTasks.filter((item) => item.userId !== user.id);
  req.db.conversations = req.db.conversations.filter((item) => item.userId !== user.id);
  delete req.db.userPreferences[user.id];
  writeDb(req.db); res.json({ success: true, message: '用户已删除' });
});
app.post('/api/users/:id/reset-password', ...allow('user:reset'), (req, res) => {
  const user = req.db.users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
  const password = String(req.body.password || '123456'); if (password.length < 6) return badRequest(res, '密码长度不能少于 6 位');
  user.passwordHash = hashPassword(password); user.updatedAt = new Date().toISOString(); writeDb(req.db); res.json({ success: true, message: '密码重置成功' });
});

app.get('/api/roles', ...allow('role:view'), (req, res) => res.json({ success: true, data: req.db.roles.map((role) => ({ ...role, userCount: req.db.users.filter((user) => user.roleIds.includes(role.id)).length })) }));
app.post('/api/roles', ...allow('role:create'), (req, res) => {
  const db = req.db; const error = required(req.body.name, '角色名称') || required(req.body.code, '角色编码'); if (error) return badRequest(res, error);
  const code = String(req.body.code).trim().toUpperCase(); if (db.roles.some((item) => item.code === code)) return badRequest(res, '角色编码已存在');
  const role = { id: id('role'), name: String(req.body.name).trim(), code, description: String(req.body.description || '').trim(), functionIds: Array.isArray(req.body.functionIds) ? req.body.functionIds.filter((value) => db.functions.some((item) => item.id === value)) : [], menuIds: Array.isArray(req.body.menuIds) ? req.body.menuIds.filter((value) => db.menus.some((item) => item.id === value)) : [], status: req.body.status === 'disabled' ? 'disabled' : 'enabled', builtIn: false, createdAt: new Date().toISOString() };
  db.roles.push(role); writeDb(db); res.status(201).json({ success: true, message: '角色创建成功', data: role });
});
app.put('/api/roles/:id', ...allow('role:update'), (req, res) => {
  const db = req.db; const role = db.roles.find((item) => item.id === req.params.id); if (!role) return res.status(404).json({ success: false, message: '角色不存在' });
  const error = required(req.body.name, '角色名称') || required(req.body.code, '角色编码'); if (error) return badRequest(res, error);
  const code = String(req.body.code).trim().toUpperCase(); if (db.roles.some((item) => item.id !== role.id && item.code === code)) return badRequest(res, '角色编码已存在');
  Object.assign(role, { name: String(req.body.name).trim(), code, description: String(req.body.description || '').trim(), functionIds: Array.isArray(req.body.functionIds) ? req.body.functionIds.filter((value) => db.functions.some((item) => item.id === value)) : [], menuIds: Array.isArray(req.body.menuIds) ? req.body.menuIds.filter((value) => db.menus.some((item) => item.id === value)) : [], status: role.builtIn ? 'enabled' : (req.body.status === 'disabled' ? 'disabled' : 'enabled'), updatedAt: new Date().toISOString() });
  writeDb(db); res.json({ success: true, message: '角色更新成功', data: role });
});
app.delete('/api/roles/:id', ...allow('role:delete'), (req, res) => {
  const role = req.db.roles.find((item) => item.id === req.params.id); if (!role) return res.status(404).json({ success: false, message: '角色不存在' });
  if (role.builtIn) return badRequest(res, '内置角色不能删除'); if (req.db.users.some((user) => user.roleIds.includes(role.id))) return badRequest(res, '该角色仍有关联用户，不能删除');
  req.db.roles = req.db.roles.filter((item) => item.id !== role.id); writeDb(req.db); res.json({ success: true, message: '角色已删除' });
});

app.get('/api/functions', ...allow('function:view'), (req, res) => res.json({ success: true, data: req.db.functions }));
app.post('/api/functions', ...allow('function:create'), (req, res) => {
  const db = req.db; const error = required(req.body.name, '功能名称') || required(req.body.code, '权限标识') || required(req.body.module, '所属模块'); if (error) return badRequest(res, error);
  const code = String(req.body.code).trim(); if (db.functions.some((item) => item.code === code)) return badRequest(res, '权限标识已存在');
  const item = { id: id('fn'), name: String(req.body.name).trim(), code, module: String(req.body.module).trim(), method: String(req.body.method || 'GET').toUpperCase(), route: String(req.body.route || '').trim(), description: String(req.body.description || '').trim(), status: req.body.status === 'disabled' ? 'disabled' : 'enabled', createdAt: new Date().toISOString() };
  db.functions.push(item); writeDb(db); res.status(201).json({ success: true, message: '功能创建成功', data: item });
});
app.put('/api/functions/:id', ...allow('function:update'), (req, res) => {
  const db = req.db; const item = db.functions.find((value) => value.id === req.params.id); if (!item) return res.status(404).json({ success: false, message: '功能不存在' });
  const error = required(req.body.name, '功能名称') || required(req.body.code, '权限标识') || required(req.body.module, '所属模块'); if (error) return badRequest(res, error);
  const code = String(req.body.code).trim(); if (db.functions.some((value) => value.id !== item.id && value.code === code)) return badRequest(res, '权限标识已存在');
  const previousCode = item.code; Object.assign(item, { name: String(req.body.name).trim(), code, module: String(req.body.module).trim(), method: String(req.body.method || 'GET').toUpperCase(), route: String(req.body.route || '').trim(), description: String(req.body.description || '').trim(), status: req.body.status === 'disabled' ? 'disabled' : 'enabled', updatedAt: new Date().toISOString() });
  db.menus.filter((menu) => menu.permission === previousCode).forEach((menu) => { menu.permission = code; }); writeDb(db); res.json({ success: true, message: '功能更新成功', data: item });
});
app.delete('/api/functions/:id', ...allow('function:delete'), (req, res) => {
  const item = req.db.functions.find((value) => value.id === req.params.id); if (!item) return res.status(404).json({ success: false, message: '功能不存在' });
  if (req.db.roles.some((role) => role.functionIds.includes(item.id))) return badRequest(res, '该功能已分配给角色，不能删除'); if (req.db.menus.some((menu) => menu.permission === item.code)) return badRequest(res, '该功能已绑定菜单，不能删除');
  req.db.functions = req.db.functions.filter((value) => value.id !== item.id); writeDb(req.db); res.json({ success: true, message: '功能已删除' });
});

app.get('/api/menus', ...allow('menu:view'), (req, res) => res.json({ success: true, data: req.db.menus }));
app.post('/api/menus', ...allow('menu:create'), (req, res) => {
  const error = required(req.body.name, '菜单名称'); if (error) return badRequest(res, error); const parentId = req.body.parentId || null;
  if (parentId && !req.db.menus.some((item) => item.id === parentId)) return badRequest(res, '上级菜单不存在');
  const menu = { id: id('menu'), name: String(req.body.name).trim(), icon: String(req.body.icon || 'N').trim().slice(0, 3), path: String(req.body.path || '').trim(), parentId, permission: String(req.body.permission || '').trim(), sort: Number(req.body.sort || 0), visible: req.body.visible !== false, status: req.body.status === 'disabled' ? 'disabled' : 'enabled', createdAt: new Date().toISOString() };
  req.db.menus.push(menu); writeDb(req.db); res.status(201).json({ success: true, message: '菜单创建成功', data: menu });
});
app.put('/api/menus/:id', ...allow('menu:update'), (req, res) => {
  const menu = req.db.menus.find((item) => item.id === req.params.id); if (!menu) return res.status(404).json({ success: false, message: '菜单不存在' });
  const error = required(req.body.name, '菜单名称'); if (error) return badRequest(res, error); const parentId = req.body.parentId || null;
  if (parentId === menu.id) return badRequest(res, '菜单不能以自身作为上级'); if (parentId && !req.db.menus.some((item) => item.id === parentId)) return badRequest(res, '上级菜单不存在');
  Object.assign(menu, { name: String(req.body.name).trim(), icon: String(req.body.icon || 'N').trim().slice(0, 3), path: String(req.body.path || '').trim(), parentId, permission: String(req.body.permission || '').trim(), sort: Number(req.body.sort || 0), visible: req.body.visible !== false, status: req.body.status === 'disabled' ? 'disabled' : 'enabled', updatedAt: new Date().toISOString() }); writeDb(req.db); res.json({ success: true, message: '菜单更新成功', data: menu });
});
app.delete('/api/menus/:id', ...allow('menu:delete'), (req, res) => {
  const menu = req.db.menus.find((item) => item.id === req.params.id); if (!menu) return res.status(404).json({ success: false, message: '菜单不存在' });
  if (req.db.menus.some((item) => item.parentId === menu.id)) return badRequest(res, '请先删除该菜单的子菜单'); if (req.db.roles.some((role) => role.menuIds.includes(menu.id))) return badRequest(res, '该菜单已分配给角色，不能删除');
  req.db.menus = req.db.menus.filter((item) => item.id !== menu.id); writeDb(req.db); res.json({ success: true, message: '菜单已删除' });
});

app.use('/api', (req, res) => res.status(404).json({ success: false, message: '接口不存在' }));

if (require.main === module) {
  ensureDataFile();
  app.listen(PORT, () => console.log(`智能瞭望与智能问数系统 v0.3 已启动：http://localhost:${PORT}`));
}

module.exports = { app, readDb, DATA_FILE };
