const authForm = document.getElementById('authForm');
const authButton = document.getElementById('authButton');
const authError = document.getElementById('authError');

authForm.addEventListener('submit', async (event) => {
  event.preventDefault(); authError.textContent = ''; authButton.disabled = true;
  const mode = authForm.dataset.mode; authButton.textContent = mode === 'register' ? '正在注册...' : '正在登录...';
  const values = Object.fromEntries(new FormData(authForm).entries());
  try {
    const response = await fetch(mode === 'register' ? '/api/auth/register' : '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    const result = await response.json(); if (!response.ok) throw new Error(result.message || '操作失败');
    location.href = '/app';
  } catch (error) { authError.textContent = error.message; }
  finally { authButton.disabled = false; authButton.textContent = mode === 'register' ? '注册并进入' : '登录'; }
});
