const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../server');

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => new Promise((resolve) => server.close(resolve)));

async function request(path, options = {}, cookie = '') {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function login(username, password) {
  const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  const setCookie = result.response.headers.get('set-cookie');
  return { ...result, cookie: setCookie ? setCookie.split(';')[0] : '' };
}

test('后台管理员拥有数字员工及全部原有模块权限', async () => {
  const auth = await login('admin', 'admin123');
  assert.equal(auth.response.status, 200);
  assert.equal(auth.body.destination, '/dashboard');
  assert.ok(auth.body.data.permissions.includes('employee:run'));

  const employees = await request('/api/employees', {}, auth.cookie);
  assert.equal(employees.response.status, 200);
  assert.equal(employees.body.data.length, 3);

  for (const path of ['/api/collections', '/api/sources', '/api/warehouse', '/api/models', '/api/users', '/api/roles']) {
    assert.equal((await request(path, {}, auth.cookie)).response.status, 200);
  }
});

test('数字员工后台支持创建、调试和删除', async () => {
  const auth = await login('admin', 'admin123');
  const created = await request('/api/employees', { method: 'POST', body: JSON.stringify({ name: '测试员工', code: 'test_agent', avatar: 'TA', specialty: '测试', modelId: 'model-qa', prompt: '测试提示词', status: 'enabled' }) }, auth.cookie);
  assert.equal(created.response.status, 201);
  const employeeId = created.body.data.id;
  const run = await request(`/api/employees/${employeeId}/run`, { method: 'POST', body: '{}' }, auth.cookie);
  assert.equal(run.response.status, 200);
  assert.equal(run.body.data.employee.callCount, 1);
  assert.equal((await request(`/api/employees/${employeeId}`, { method: 'DELETE' }, auth.cookie)).response.status, 200);
});

test('前台注册、智能问数、数字员工、任务和模型切换流程可用', async () => {
  const username = `member_${Date.now()}`;
  const registered = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, realName: '测试成员', email: 'member@example.local', password: '123456' }) });
  assert.equal(registered.response.status, 201);
  const cookie = registered.response.headers.get('set-cookie').split(';')[0];

  const bootstrap = await request('/api/portal/bootstrap', {}, cookie);
  assert.equal(bootstrap.response.status, 200);
  assert.equal(bootstrap.body.data.employees.length, 3);
  assert.equal(bootstrap.body.data.models.length, 3);

  const ask = await request('/api/portal/ask', { method: 'POST', body: JSON.stringify({ question: '各模型准确率是多少', modelId: 'model-qa' }) }, cookie);
  assert.equal(ask.response.status, 200);
  assert.ok(ask.body.data.chart.values.length >= 3);

  for (const code of ['writer', 'weather', 'collector']) {
    const result = await request(`/api/portal/agents/${code}/chat`, { method: 'POST', body: JSON.stringify({ message: '测试任务' }) }, cookie);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.data.task.status, 'completed');
  }

  assert.equal((await request('/api/portal/preference', { method: 'PUT', body: JSON.stringify({ modelId: 'model-topic' }) }, cookie)).response.status, 200);
  assert.equal((await request('/api/portal/tasks', {}, cookie)).body.data.length, 3);

  const admin = await login('admin', 'admin123');
  const users = await request('/api/users', {}, admin.cookie);
  const member = users.body.data.find((item) => item.username === username);
  assert.ok(member);
  assert.equal((await request(`/api/users/${member.id}`, { method: 'DELETE' }, admin.cookie)).response.status, 200);
});

test('普通前台用户不能访问后台接口', async () => {
  const auth = await login('demo', '123456');
  assert.equal(auth.body.destination, '/app');
  assert.equal((await request('/api/employees', {}, auth.cookie)).response.status, 403);
  assert.equal((await request('/api/roles', {}, auth.cookie)).response.status, 403);
});

test('安全响应头、跨站拦截和错误登录正常工作', async () => {
  const page = await fetch(`${baseUrl}/portal-login`);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');

  const crossOrigin = await request('/api/auth/login', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
  assert.equal(crossOrigin.response.status, 403);
  assert.equal((await login('admin', 'wrong-password')).response.status, 401);
  assert.equal((await request('/api/portal/bootstrap')).response.status, 401);
});
