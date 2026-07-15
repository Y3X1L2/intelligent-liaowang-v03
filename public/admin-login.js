const form = document.getElementById('loginForm');
const button = document.getElementById('loginButton');
const error = document.getElementById('loginError');

form.addEventListener('submit', async (event) => {
  event.preventDefault(); error.textContent = ''; button.disabled = true; button.textContent = '正在登录...';
  try {
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.username.value.trim(), password: form.password.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || '登录失败');
    if (result.destination !== '/dashboard') throw new Error('当前账号没有后台管理权限');
    location.href = '/dashboard';
  } catch (err) { error.textContent = err.message; }
  finally { button.disabled = false; button.textContent = '登录后台'; }
});
