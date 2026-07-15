const state = {
  me: null,
  section: 'dashboard',
  data: { collections: [], sources: [], warehouse: [], models: [], employees: [], users: [], roles: [], functions: [], menus: [] },
  modal: null,
  search: ''
};

const sectionMeta = {
  dashboard: { title: '工作台', permission: 'dashboard:view' },
  collections: { title: '瞭望采集', permission: 'collection:view' },
  sources: { title: '瞭源管理', permission: 'source:view' },
  warehouse: { title: '数据仓库', permission: 'warehouse:view' },
  models: { title: '模型引擎', permission: 'model:view' },
  employees: { title: '数字员工', permission: 'employee:view' },
  users: { title: '用户管理', permission: 'user:view' },
  functions: { title: '功能管理', permission: 'function:view' },
  roles: { title: '角色管理', permission: 'role:view' },
  menus: { title: '菜单管理', permission: 'menu:view' }
};

const entityMeta = {
  collections: { singular: '采集任务', permission: 'collection' },
  sources: { singular: '数据源', permission: 'source' },
  warehouse: { singular: '数据资产', permission: 'warehouse' },
  models: { singular: '模型', permission: 'model' },
  employees: { singular: '数字员工', permission: 'employee' },
  users: { singular: '用户', permission: 'user' },
  functions: { singular: '功能', permission: 'function' },
  roles: { singular: '角色', permission: 'role' },
  menus: { singular: '菜单', permission: 'menu' }
};

const content = document.getElementById('content');
const modal = document.getElementById('modal');
const modalForm = document.getElementById('modalForm');
const modalBody = document.getElementById('modalBody');

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function can(permission) {
  return state.me?.permissions.includes(permission);
}

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({ success: false, message: '服务器响应格式错误' }));
  if (response.status === 401) {
    location.href = '/login';
    throw new Error('登录状态已失效');
  }
  if (!response.ok) throw new Error(result.message || '请求失败');
  return result;
}

function toast(message, isError = false) {
  const element = document.getElementById('toast');
  element.textContent = message;
  element.className = `toast show${isError ? ' error' : ''}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.className = 'toast'; }, 2400);
}

const statusLabels = {
  enabled: '启用', paused: '已暂停', connected: '已连接', disconnected: '未连接',
  active: '活跃', archived: '已归档', ready: '就绪', training: '训练中', offline: '离线', disabled: '停用'
};

function statusBadge(status) {
  const positive = ['enabled', 'connected', 'active', 'ready'].includes(status);
  return `<span class="badge ${positive ? 'badge-enabled' : 'badge-disabled'}">${statusLabels[status] || esc(status)}</span>`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function renderNavigation() {
  const menus = state.me.menus;
  const roots = menus.filter((item) => !item.parentId);
  const html = [];
  roots.forEach((root) => {
    const children = menus.filter((item) => item.parentId === root.id);
    if (root.path) html.push(navButton(root));
    if (children.length) {
      html.push(`<div class="nav-group-label">${esc(root.name)}</div>`);
      children.forEach((child) => html.push(navButton(child, true)));
    }
  });
  document.getElementById('sidebarNav').innerHTML = html.join('');
}

function navButton(menu, child = false) {
  return `<button class="nav-item ${child ? 'nav-child' : ''} ${state.section === menu.path ? 'active' : ''}" data-section="${esc(menu.path)}"><span class="nav-icon">${esc(menu.icon)}</span><span>${esc(menu.name)}</span></button>`;
}

async function navigate(section) {
  if (!sectionMeta[section] || !can(sectionMeta[section].permission)) return;
  state.section = section;
  state.search = '';
  renderNavigation();
  document.getElementById('pageTitle').textContent = sectionMeta[section].title;
  document.getElementById('breadcrumb').textContent = sectionMeta[section].title;
  content.innerHTML = '<div class="loading">正在加载...</div>';
  try {
    if (section === 'dashboard') return await renderDashboard();
    if (section === 'collections') await ensureDependencies(['sources']);
    await loadResource(section);
    renderTableSection();
  } catch (error) {
    content.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  }
}

async function loadResource(resource, force = false) {
  if (!force && state.data[resource].length) return state.data[resource];
  const result = await api(`/api/${resource}`);
  state.data[resource] = result.data;
  return result.data;
}

async function ensureDependencies(resources) {
  for (const resource of resources) {
    const permission = entityMeta[resource]?.permission;
    if (permission && can(`${permission}:view`)) await loadResource(resource);
  }
}

async function renderDashboard() {
  const { data } = await api('/api/dashboard');
  const sourceConnected = data.counts.sources ? Math.round(data.counts.connectedSources / data.counts.sources * 100) : 0;
  content.innerHTML = `
    <div class="stats-grid">
      ${statCard('采集任务', data.counts.collections, `${data.counts.runningCollections} 个任务运行中`, 'rgba(24,169,153,.18)')}
      ${statCard('数据源', data.counts.sources, `连接健康度 ${sourceConnected}%`, 'rgba(57,118,166,.16)')}
      ${statCard('仓库资产', data.counts.warehouse, `${formatNumber(data.counts.warehouseRows)} 行数据`, 'rgba(126,97,182,.15)')}
      ${statCard('模型引擎', data.counts.models, `${data.counts.readyModels} 个模型可用`, 'rgba(220,152,47,.15)')}
    </div>
    <div class="dashboard-grid">
      <div class="panel">
        <div class="panel-head"><div><h2>最近采集任务</h2><p>采集任务运行状态与入仓数据量</p></div></div>
        ${table(['任务名称', '调度频率', '累计数据', '状态', '最近运行'], data.recentTasks.map((item) => `<tr><td><div class="cell-main">${esc(item.name)}</div><div class="cell-sub">${esc(item.target)}</div></td><td>${esc(item.frequency)}</td><td>${formatNumber(item.records)}</td><td>${statusBadge(item.status)}</td><td>${formatDate(item.lastRun)}</td></tr>`).join(''))}
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>模型运行概览</h2><p>当前模型精度与可用状态</p></div></div>
        <div class="module-list">${data.modelOverview.map((item) => `<div class="module-row"><span>${esc(item.name)}</span><div class="progress"><i style="width:${Math.min(100, item.accuracy)}%"></i></div><strong>${item.accuracy}%</strong></div>`).join('')}</div>
        <div class="panel-head" style="margin-top:24px"><div><h2>数据源健康状态</h2><p>${data.counts.connectedSources}/${data.counts.sources} 个数据源连接正常</p></div></div>
        <div class="module-list">${data.sourceHealth.map((item) => `<div class="module-row"><span>${esc(item.name)}</span><div>${statusBadge(item.status)}</div><strong>${esc(item.type)}</strong></div>`).join('')}</div>
      </div>
    </div>`;
}

function statCard(label, value, note, accent) {
  return `<div class="stat-card" style="--card-accent:${accent}"><div class="stat-label">${label}</div><div class="stat-number">${formatNumber(value)}</div><div class="stat-note">${note}</div></div>`;
}

function sectionToolbar(resource, title, description) {
  const meta = entityMeta[resource];
  return `<div class="section-toolbar"><div><h2>${title}</h2><p>${description}</p></div><div class="toolbar-actions"><input class="search-box" id="searchInput" value="${esc(state.search)}" placeholder="搜索当前列表"><button class="btn btn-secondary" data-action="refresh" data-resource="${resource}">刷新</button>${can(`${meta.permission}:create`) ? `<button class="btn btn-primary" data-action="create" data-entity="${resource}">新增${meta.singular}</button>` : ''}</div></div>`;
}

function renderTableSection() {
  const config = {
    employees: ['数字员工列表', '配置员工能力、基础模型、系统提示词和运行状态'],
    collections: ['采集任务列表', '配置数据采集源、调度频率和入仓目标'],
    sources: ['数据源列表', '统一管理 API、爬虫、数据库和文件数据源'],
    warehouse: ['数据资产列表', '管理数仓分层、数据规模和同步状态'],
    models: ['模型列表', '管理算法模型版本、框架、精度和运行状态'],
    users: ['用户列表', '维护后台账号、状态和角色分配'],
    functions: ['功能列表', '维护接口功能与权限标识'],
    roles: ['角色列表', '组合业务权限、管理权限和菜单资源'],
    menus: ['菜单列表', '维护后台菜单层级与显示规则']
  }[state.section];
  content.innerHTML = `<div class="section-card">${sectionToolbar(state.section, ...config)}<div id="tableContainer">${renderCurrentTable()}</div></div>`;
}

function matches(item, fields) {
  const keyword = state.search.trim().toLowerCase();
  return !keyword || fields.some((fieldName) => String(item[fieldName] || '').toLowerCase().includes(keyword));
}

function renderCurrentTable() {
  const filters = {
    employees: ['name', 'code', 'specialty', 'prompt'],
    collections: ['name', 'frequency', 'target', 'description'], sources: ['name', 'type', 'endpoint', 'owner'],
    warehouse: ['name', 'layer', 'format', 'owner', 'source'], models: ['name', 'type', 'version', 'framework'],
    users: ['username', 'realName', 'email', 'phone'], functions: ['name', 'code', 'module', 'route'],
    roles: ['name', 'code', 'description'], menus: ['name', 'path', 'permission']
  };
  const items = state.data[state.section].filter((item) => matches(item, filters[state.section]));
  return {
    employees: employeeTable,
    collections: collectionTable, sources: sourceTable, warehouse: warehouseTable, models: modelTable,
    users: userTable, functions: functionTable, roles: roleTable, menus: menuTable
  }[state.section](items);
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="empty">暂无数据</td></tr>`}</tbody></table></div>`;
}

function actionButton(label, action, entity, itemId, danger = false) {
  return `<button class="btn btn-sm ${danger ? 'btn-danger' : 'btn-secondary'}" data-action="${action}" data-entity="${entity}" data-id="${itemId}">${label}</button>`;
}

function collectionTable(items) {
  const sourceMap = Object.fromEntries(state.data.sources.map((item) => [item.id, item.name]));
  return table(['任务名称', '数据源', '调度/目标', '累计数据', '状态', '最近运行', '操作'], items.map((item) => `<tr><td><div class="cell-main">${esc(item.name)}</div><div class="cell-sub">${esc(item.description)}</div></td><td>${esc(sourceMap[item.sourceId] || item.sourceId)}</td><td>${esc(item.frequency)}<div class="cell-sub">${esc(item.target)}</div></td><td>${formatNumber(item.records)}</td><td>${statusBadge(item.status)}</td><td>${formatDate(item.lastRun)}</td><td class="actions">${can('collection:run') ? actionButton('立即采集','run','collections',item.id) : ''}${can('collection:update') ? actionButton('编辑','edit','collections',item.id) : ''}${can('collection:delete') ? actionButton('删除','delete','collections',item.id,true) : ''}</td></tr>`).join(''));
}

function sourceTable(items) {
  return table(['数据源', '连接类型', '连接地址', '负责人', '状态', '最近检测', '操作'], items.map((item) => `<tr><td><div class="cell-main">${esc(item.name)}</div><div class="cell-sub">${esc(item.description)}</div></td><td><span class="badge badge-method">${esc(item.type)}</span></td><td><span class="code">${esc(item.endpoint)}</span></td><td>${esc(item.owner || '-')}</td><td>${statusBadge(item.status)}</td><td>${formatDate(item.lastCheck)}</td><td class="actions">${can('source:test') ? actionButton('测试连接','test','sources',item.id) : ''}${can('source:update') ? actionButton('编辑','edit','sources',item.id) : ''}${can('source:delete') ? actionButton('删除','delete','sources',item.id,true) : ''}</td></tr>`).join(''));
}

function warehouseTable(items) {
  return table(['数据资产', '数仓分层', '格式/来源', '数据规模', '状态', '更新时间', '操作'], items.map((item) => `<tr><td><div class="cell-main">${esc(item.name)}</div><div class="cell-sub">${esc(item.owner)}</div></td><td><span class="code">${esc(item.layer)}</span></td><td>${esc(item.format)}<div class="cell-sub">${esc(item.source)}</div></td><td>${formatNumber(item.rowCount)} 行<div class="cell-sub">${esc(item.size)}</div></td><td>${statusBadge(item.status)}</td><td>${formatDate(item.updatedAt)}</td><td class="actions">${can('warehouse:sync') ? actionButton('同步','sync','warehouse',item.id) : ''}${can('warehouse:update') ? actionButton('编辑','edit','warehouse',item.id) : ''}${can('warehouse:delete') ? actionButton('删除','delete','warehouse',item.id,true) : ''}</td></tr>`).join(''));
}

function modelTable(items) {
  return table(['模型名称', '类型/框架', '版本', '准确率', '状态', '最近运行', '操作'], items.map((item) => `<tr><td><div class="cell-main">${esc(item.name)}</div><div class="cell-sub">${esc(item.description)}</div></td><td>${esc(item.type)}<div class="cell-sub">${esc(item.framework)}</div></td><td><span class="code">${esc(item.version)}</span></td><td><strong>${Number(item.accuracy).toFixed(1)}%</strong></td><td>${statusBadge(item.status)}</td><td>${formatDate(item.lastRun)}</td><td class="actions">${can('model:run') ? actionButton('运行推理','run','models',item.id) : ''}${can('model:update') ? actionButton('编辑','edit','models',item.id) : ''}${can('model:delete') ? actionButton('删除','delete','models',item.id,true) : ''}</td></tr>`).join(''));
}

function employeeTable(items) {
  return table(['数字员工', '能力编码', '专长', '基础模型', '调用次数', '状态', '操作'], items.map((item) => `<tr><td><div class="cell-main">${esc(item.name)}</div><div class="cell-sub">头像 ${esc(item.avatar)}</div></td><td><span class="code">@${esc(item.code)}</span></td><td>${esc(item.specialty)}</td><td><span class="code">${esc(item.modelId || '-')}</span></td><td>${formatNumber(item.callCount)}</td><td>${statusBadge(item.status)}</td><td class="actions">${can('employee:run') ? actionButton('调试','run','employees',item.id) : ''}${can('employee:update') ? actionButton('编辑','edit','employees',item.id) : ''}${can('employee:delete') && !['writer','weather','collector'].includes(item.code) ? actionButton('删除','delete','employees',item.id,true) : ''}</td></tr>`).join(''));
}

function userTable(items) {
  return table(['用户', '联系方式', '角色', '状态', '创建时间', '操作'], items.map((user) => `<tr><td><div class="cell-main">${esc(user.realName)}</div><div class="cell-sub">@${esc(user.username)}</div></td><td>${esc(user.email || '-')}<div class="cell-sub">${esc(user.phone || '-')}</div></td><td>${user.roles.length ? user.roles.map((role) => `<span class="code">${esc(role.name)}</span>`).join(' ') : '-'}</td><td>${statusBadge(user.status)}</td><td>${formatDate(user.createdAt)}</td><td class="actions">${can('user:update') ? actionButton('编辑','edit','users',user.id) : ''}${can('user:reset') ? actionButton('重置密码','reset','users',user.id) : ''}${can('user:delete') && user.id !== 'user-admin' && user.id !== state.me.id ? actionButton('删除','delete','users',user.id,true) : ''}</td></tr>`).join(''));
}

function functionTable(items) {
  return table(['功能名称', '权限标识', '模块', '请求接口', '状态', '操作'], items.map((item) => `<tr><td><div class="cell-main">${esc(item.name)}</div><div class="cell-sub">${esc(item.description)}</div></td><td><span class="code">${esc(item.code)}</span></td><td>${esc(item.module)}</td><td><span class="badge badge-method">${esc(item.method)}</span> <span class="cell-sub">${esc(item.route || '-')}</span></td><td>${statusBadge(item.status)}</td><td class="actions">${can('function:update') ? actionButton('编辑','edit','functions',item.id) : ''}${can('function:delete') ? actionButton('删除','delete','functions',item.id,true) : ''}</td></tr>`).join(''));
}

function roleTable(items) {
  return table(['角色名称', '角色编码', '授权范围', '关联用户', '状态', '操作'], items.map((item) => `<tr><td><div class="cell-main">${esc(item.name)}${item.builtIn ? ' <span class="code">内置</span>' : ''}</div><div class="cell-sub">${esc(item.description)}</div></td><td><span class="code">${esc(item.code)}</span></td><td>${item.functionIds.length} 项功能 / ${item.menuIds.length} 个菜单</td><td>${item.userCount}</td><td>${statusBadge(item.status)}</td><td class="actions">${can('role:update') ? actionButton('编辑授权','edit','roles',item.id) : ''}${can('role:delete') && !item.builtIn ? actionButton('删除','delete','roles',item.id,true) : ''}</td></tr>`).join(''));
}

function menuTable(items) {
  const byId = Object.fromEntries(state.data.menus.map((item) => [item.id, item]));
  return table(['菜单名称', '路由标识', '上级菜单', '权限标识', '排序/显示', '状态', '操作'], items.map((item) => `<tr><td><div class="cell-main">${item.parentId ? '&nbsp;&nbsp;└ ' : ''}${esc(item.name)}</div><div class="cell-sub">图标 ${esc(item.icon)}</div></td><td>${item.path ? `<span class="code">${esc(item.path)}</span>` : '-'}</td><td>${item.parentId ? esc(byId[item.parentId]?.name || '-') : '根菜单'}</td><td>${item.permission ? `<span class="code">${esc(item.permission)}</span>` : '-'}</td><td>${item.sort} / ${item.visible ? '显示' : '隐藏'}</td><td>${statusBadge(item.status)}</td><td class="actions">${can('menu:update') ? actionButton('编辑','edit','menus',item.id) : ''}${can('menu:delete') ? actionButton('删除','delete','menus',item.id,true) : ''}</td></tr>`).join(''));
}

function field(label, name, value = '', options = {}) {
  const classes = `field${options.full ? ' full' : ''}`;
  if (options.type === 'textarea') return `<label class="${classes}"><span>${label}</span><textarea name="${name}" ${options.required ? 'required' : ''}>${esc(value)}</textarea></label>`;
  if (options.type === 'select') return `<label class="${classes}"><span>${label}</span><select name="${name}">${options.choices.map(([key, text]) => `<option value="${esc(key)}" ${String(key) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
  return `<label class="${classes}"><span>${label}</span><input name="${name}" type="${options.type || 'text'}" value="${esc(value)}" ${options.required ? 'required' : ''} ${options.disabled ? 'disabled' : ''} ${options.step ? `step="${esc(options.step)}"` : ''} ${options.placeholder ? `placeholder="${esc(options.placeholder)}"` : ''}></label>`;
}

async function openEditor(entity, item = null) {
  state.modal = { entity, id: item?.id || null };
  if (entity === 'employees') await ensureDependencies(['models']);
  if (entity === 'collections') await ensureDependencies(['sources']);
  if (entity === 'users') await ensureDependencies(['roles']);
  if (entity === 'roles') await ensureDependencies(['functions', 'menus']);
  if (entity === 'menus') await ensureDependencies(['functions']);
  document.getElementById('modalTitle').textContent = `${item ? '编辑' : '新增'}${entityMeta[entity].singular}`;
  modalBody.innerHTML = formHtml(entity, item || {});
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function formHtml(entity, item) {
  if (entity === 'collections') return `<div class="form-grid">${field('任务名称','name',item.name || '',{required:true})}${field('数据源','sourceId',item.sourceId || '',{type:'select',choices:state.data.sources.map((source) => [source.id,source.name])})}${field('调度频率','frequency',item.frequency || '每 30 分钟',{required:true})}${field('入仓目标','target',item.target || '',{required:true})}${field('任务状态','status',item.status || 'enabled',{type:'select',choices:[['enabled','运行中'],['paused','暂停']]})}${field('任务说明','description',item.description || '',{type:'textarea',full:true})}</div>`;
  if (entity === 'sources') return `<div class="form-grid">${field('数据源名称','name',item.name || '',{required:true})}${field('连接类型','type',item.type || 'Web API',{type:'select',choices:['Web API','Crawler','MySQL','PostgreSQL','SFTP','Kafka'].map((value) => [value,value])})}${field('连接地址','endpoint',item.endpoint || '',{required:true,full:true})}${field('负责人','owner',item.owner || '')}${field('连接状态','status',item.status || 'disconnected',{type:'select',choices:[['connected','已连接'],['disconnected','未连接']]})}${field('数据源说明','description',item.description || '',{type:'textarea',full:true})}</div>`;
  if (entity === 'warehouse') return `<div class="form-grid">${field('资产名称','name',item.name || '',{required:true})}${field('数仓分层','layer',item.layer || 'ODS',{type:'select',choices:['ODS','DWD','DWS','ADS'].map((value) => [value,value])})}${field('存储格式','format',item.format || 'Parquet')}${field('负责人','owner',item.owner || '')}${field('来源表','source',item.source || '')}${field('数据行数','rowCount',item.rowCount || 0,{type:'number'})}${field('存储大小','size',item.size || '0 MB')}${field('资产状态','status',item.status || 'active',{type:'select',choices:[['active','活跃'],['archived','归档']]})}${field('资产说明','description',item.description || '',{type:'textarea',full:true})}</div>`;
  if (entity === 'models') return `<div class="form-grid">${field('模型名称','name',item.name || '',{required:true})}${field('模型类型','type',item.type || '',{required:true})}${field('版本号','version',item.version || 'v1.0.0')}${field('运行框架','framework',item.framework || '')}${field('准确率 (%)','accuracy',item.accuracy || 0,{type:'number',step:'0.1'})}${field('模型状态','status',item.status || 'ready',{type:'select',choices:[['ready','就绪'],['training','训练中'],['offline','离线']]})}${field('模型说明','description',item.description || '',{type:'textarea',full:true})}</div>`;
  if (entity === 'employees') {
    const modelChoices = state.data.models.map((model) => [model.id, `${model.name} (${model.version})`]);
    return `<div class="form-grid">${field('员工名称','name',item.name || '',{required:true})}${field('能力编码','code',item.code || '',{required:true,placeholder:'writer'})}${field('头像缩写','avatar',item.avatar || 'AI')}${field('基础模型','modelId',item.modelId || modelChoices[0]?.[0] || '',{type:'select',choices:modelChoices})}${field('运行状态','status',item.status || 'enabled',{type:'select',choices:[['enabled','启用'],['disabled','停用']]})}${field('能力专长','specialty',item.specialty || '',{type:'textarea',full:true})}${field('系统提示词','prompt',item.prompt || '',{type:'textarea',full:true})}</div>`;
  }
  if (entity === 'users') {
    const selected = item.roleIds || [];
    return `<div class="form-grid">${field('用户名','username',item.username || '',{required:true,disabled:Boolean(item.id)})}${field('姓名','realName',item.realName || '',{required:true})}${!item.id ? field('初始密码','password','',{type:'password',required:true,placeholder:'不少于 6 位'}) : ''}${field('电子邮箱','email',item.email || '',{type:'email'})}${field('手机号码','phone',item.phone || '')}${field('账号状态','status',item.status || 'enabled',{type:'select',choices:[['enabled','启用'],['disabled','停用']]})}<div class="field full"><div class="field-title">分配角色</div>${checkboxes('roleIds',state.data.roles,selected,(role)=>`${role.name} (${role.code})`)}</div></div>`;
  }
  if (entity === 'functions') return `<div class="form-grid">${field('功能名称','name',item.name || '',{required:true})}${field('权限标识','code',item.code || '',{required:true,placeholder:'module:action'})}${field('所属模块','module',item.module || '',{required:true})}${field('请求方法','method',item.method || 'GET',{type:'select',choices:['GET','POST','PUT','PATCH','DELETE'].map((value)=>[value,value])})}${field('接口路径','route',item.route || '',{full:true})}${field('状态','status',item.status || 'enabled',{type:'select',choices:[['enabled','启用'],['disabled','停用']]})}${field('功能说明','description',item.description || '',{type:'textarea',full:true})}</div>`;
  if (entity === 'roles') return `<div class="form-grid">${field('角色名称','name',item.name || '',{required:true})}${field('角色编码','code',item.code || '',{required:true})}${field('角色状态','status',item.status || 'enabled',{type:'select',choices:[['enabled','启用'],['disabled','停用']]})}${field('角色说明','description',item.description || '',{type:'textarea',full:true})}<div class="field full"><div class="field-title">功能权限</div>${groupedFunctionCheckboxes(item.functionIds || [])}</div><div class="field full"><div class="field-title">菜单权限</div>${checkboxes('menuIds',state.data.menus,item.menuIds || [],(menu)=>`${menu.parentId ? '└ ' : ''}${menu.name}`)}</div></div>`;
  const permissionChoices = [['','不绑定权限'], ...state.data.functions.map((fn) => [fn.code,`${fn.name} (${fn.code})`])];
  const parentChoices = [['','根菜单'], ...state.data.menus.filter((menuItem) => menuItem.id !== item.id).map((menuItem) => [menuItem.id,menuItem.name])];
  return `<div class="form-grid">${field('菜单名称','name',item.name || '',{required:true})}${field('图标缩写','icon',item.icon || 'N')}${field('路由标识','path',item.path || '')}${field('上级菜单','parentId',item.parentId || '',{type:'select',choices:parentChoices})}${field('绑定权限','permission',item.permission || '',{type:'select',choices:permissionChoices,full:true})}${field('排序值','sort',item.sort ?? 0,{type:'number'})}${field('是否显示','visible',String(item.visible ?? true),{type:'select',choices:[['true','显示'],['false','隐藏']]})}${field('状态','status',item.status || 'enabled',{type:'select',choices:[['enabled','启用'],['disabled','停用']]})}</div>`;
}

function checkboxes(name, items, selected, labeler) {
  return `<div class="check-grid">${items.map((item) => `<label class="check-item"><input type="checkbox" name="${name}" value="${item.id}" ${selected.includes(item.id) ? 'checked' : ''}><span>${esc(labeler(item))}</span></label>`).join('') || '<span class="cell-sub">暂无可选项</span>'}</div>`;
}

function groupedFunctionCheckboxes(selected) {
  const modules = [...new Set(state.data.functions.map((item) => item.module))];
  return `<div class="check-grid">${modules.flatMap((moduleName) => [`<div class="field-title">${esc(moduleName)}</div>`, ...state.data.functions.filter((item) => item.module === moduleName).map((item) => `<label class="check-item"><input type="checkbox" name="functionIds" value="${item.id}" ${selected.includes(item.id) ? 'checked' : ''}><span>${esc(item.name)}<br><span class="cell-sub">${esc(item.code)}</span></span></label>`)]).join('')}</div>`;
}

function closeModal() {
  state.modal = null;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  modalForm.reset();
}

function formPayload(entity, formData) {
  const payload = Object.fromEntries(formData.entries());
  if (entity === 'users') payload.roleIds = formData.getAll('roleIds');
  if (entity === 'roles') { payload.functionIds = formData.getAll('functionIds'); payload.menuIds = formData.getAll('menuIds'); }
  if (entity === 'menus') { payload.visible = payload.visible === 'true'; payload.sort = Number(payload.sort || 0); payload.parentId = payload.parentId || null; }
  if (entity === 'warehouse') payload.rowCount = Number(payload.rowCount || 0);
  if (entity === 'models') payload.accuracy = Number(payload.accuracy || 0);
  return payload;
}

async function saveModal() {
  const { entity, id: itemId } = state.modal;
  const payload = formPayload(entity, new FormData(modalForm));
  const result = await api(`/api/${entity}${itemId ? `/${itemId}` : ''}`, { method: itemId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
  closeModal();
  await loadResource(entity, true);
  renderTableSection();
  toast(result.message);
}

async function deleteItem(entity, itemId) {
  const item = state.data[entity].find((value) => value.id === itemId);
  const label = item?.name || item?.realName || item?.username || '该记录';
  if (!confirm(`确定删除“${label}”吗？此操作不可撤销。`)) return;
  try {
    const result = await api(`/api/${entity}/${itemId}`, { method: 'DELETE' });
    await loadResource(entity, true);
    renderTableSection();
    toast(result.message);
  } catch (error) { toast(error.message, true); }
}

async function runAction(entity, itemId, action) {
  try {
    const result = await api(`/api/${entity}/${itemId}/${action}`, { method: 'POST' });
    await loadResource(entity, true);
    renderTableSection();
    toast(result.message);
  } catch (error) { toast(error.message, true); }
}

async function resetPassword(userId) {
  const password = prompt('请输入新密码（至少 6 位）', '123456');
  if (password === null) return;
  try { const result = await api(`/api/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }); toast(result.message); }
  catch (error) { toast(error.message, true); }
}

document.addEventListener('click', async (event) => {
  const sectionButton = event.target.closest('[data-section]');
  if (sectionButton) return navigate(sectionButton.dataset.section);
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, entity, id: itemId, resource } = button.dataset;
  if (action === 'refresh') { try { await loadResource(resource, true); renderTableSection(); toast('数据已刷新'); } catch (error) { toast(error.message, true); } }
  if (action === 'create') { try { await openEditor(entity); } catch (error) { toast(error.message, true); } }
  if (action === 'edit') { try { await openEditor(entity, state.data[entity].find((item) => item.id === itemId)); } catch (error) { toast(error.message, true); } }
  if (action === 'delete') await deleteItem(entity, itemId);
  if (action === 'reset') await resetPassword(itemId);
  if (['run', 'test', 'sync'].includes(action)) await runAction(entity, itemId, action);
});

document.addEventListener('input', (event) => {
  if (event.target.id !== 'searchInput') return;
  state.search = event.target.value;
  document.getElementById('tableContainer').innerHTML = renderCurrentTable();
});

modalForm.addEventListener('submit', async (event) => { event.preventDefault(); try { await saveModal(); } catch (error) { toast(error.message, true); } });
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
document.getElementById('logoutButton').addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = '/login'; });

function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleString('zh-CN', { hour12: false });
}

async function init() {
  try {
    const result = await api('/api/auth/me');
    state.me = result.data;
    document.getElementById('currentName').textContent = state.me.realName;
    document.getElementById('currentRole').textContent = state.me.roles.map((role) => role.name).join('、') || '未分配角色';
    document.getElementById('avatar').textContent = state.me.realName.slice(0, 1);
    const firstSection = state.me.menus.find((menuItem) => menuItem.path && sectionMeta[menuItem.path])?.path;
    renderNavigation(); updateClock(); setInterval(updateClock, 1000);
    await navigate(can('dashboard:view') ? 'dashboard' : firstSection);
  } catch (error) { content.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
}

init();
