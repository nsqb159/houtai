// ⚠️ 请替换为你的 Supabase 项目信息
const SUPABASE_URL = 'https://sqhcbwqrpyzglbcclzzj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxaGNid3FycHl6Z2xiY2NsenpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODIwMDUsImV4cCI6MjA5MTc1ODAwNX0.1-MdHopPxwfzU9Zu78Ae4FiyMazAPswrA4HwcHJKeP0';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 全局状态
let currentPage = null;
let editor = null;
let currentLanguage = 'html';
let pagesList = [];

// 等待 Monaco 加载
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs' } });
require(['vs/editor/editor.main'], function() {
  initEditor();
  checkSession();
});

function initEditor() {
  editor = monaco.editor.create(document.getElementById('editor-container'), {
    value: '',
    language: 'html',
    theme: 'vs-light',
    automaticLayout: true
  });
}

// 切换标签
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    currentLanguage = tab;
    if (editor) {
      monaco.editor.setModelLanguage(editor.getModel(), tab);
    }
    loadCurrentPageContent();
  });
});

// 加载当前页面对应的编辑器内容
function loadCurrentPageContent() {
  if (!currentPage) return;
  if (currentLanguage === 'html') editor.setValue(currentPage.html || '');
  else if (currentLanguage === 'css') editor.setValue(currentPage.css || '');
  else if (currentLanguage === 'js') editor.setValue(currentPage.javascript || '');
}

// 从编辑器保存到currentPage对象
function syncEditorToCurrentPage() {
  if (!currentPage) return;
  const content = editor.getValue();
  if (currentLanguage === 'html') currentPage.html = content;
  else if (currentLanguage === 'css') currentPage.css = content;
  else if (currentLanguage === 'js') currentPage.javascript = content;
}

// 更新表单字段
function updateFormFields() {
  document.getElementById('slug').value = currentPage?.slug || '';
  document.getElementById('title').value = currentPage?.title || '';
  document.getElementById('is-published').checked = currentPage?.is_published ?? true;
}

// 从表单同步到currentPage
function syncFormToCurrentPage() {
  if (!currentPage) currentPage = {};
  currentPage.slug = document.getElementById('slug').value.trim();
  currentPage.title = document.getElementById('title').value.trim();
  currentPage.is_published = document.getElementById('is-published').checked;
}

// 加载页面列表
async function loadPagesList() {
  const { data, error } = await supabase
    .from('pages')
    .select('id, slug, title, is_published')
    .order('created_at', { ascending: false });
  
  if (error) return console.error(error);
  pagesList = data;
  renderPageList();
}

function renderPageList() {
  const listEl = document.getElementById('page-list');
  listEl.innerHTML = '';
  pagesList.forEach(page => {
    const li = document.createElement('li');
    li.className = currentPage?.id === page.id ? 'active' : '';
    li.innerHTML = `<span>${page.title || page.slug}</span> ${page.is_published ? '✅' : '📝'}`;
    li.addEventListener('click', () => selectPage(page.id));
    listEl.appendChild(li);
  });
}

// 选择页面
async function selectPage(id) {
  if (currentPage) syncEditorToCurrentPage(); // 保存当前编辑内容
  
  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) return alert('加载页面失败');
  currentPage = data;
  updateFormFields();
  loadCurrentPageContent();
  renderPageList();
}

// 新建页面
function newPage() {
  if (currentPage) syncEditorToCurrentPage();
  currentPage = {
    slug: '',
    title: '',
    html: '<h1>新页面</h1>',
    css: '',
    javascript: '',
    is_published: true
  };
  updateFormFields();
  loadCurrentPageContent();
  renderPageList();
}

// 保存页面
async function savePage() {
  syncFormToCurrentPage();
  syncEditorToCurrentPage();
  
  if (!currentPage.slug) {
    alert('Slug 不能为空');
    return;
  }
  
  const saveStatus = document.getElementById('save-status');
  saveStatus.textContent = '保存中...';
  
  const pageData = {
    slug: currentPage.slug,
    title: currentPage.title,
    html: currentPage.html,
    css: currentPage.css,
    javascript: currentPage.javascript,
    is_published: currentPage.is_published,
    updated_at: new Date()
  };
  
  let result;
  if (currentPage.id) {
    result = await supabase.from('pages').update(pageData).eq('id', currentPage.id).select();
  } else {
    result = await supabase.from('pages').insert([pageData]).select();
  }
  
  if (result.error) {
    saveStatus.textContent = '错误: ' + result.error.message;
  } else {
    if (!currentPage.id && result.data) currentPage.id = result.data[0].id;
    saveStatus.textContent = '已保存 ✓';
    setTimeout(() => saveStatus.textContent = '', 2000);
    loadPagesList();
  }
}

// 删除页面
async function deletePage() {
  if (!currentPage?.id) return;
  if (!confirm(`确定删除 "${currentPage.title}"？`)) return;
  
  const { error } = await supabase.from('pages').delete().eq('id', currentPage.id);
  if (error) return alert('删除失败: ' + error.message);
  
  currentPage = null;
  editor.setValue('');
  updateFormFields();
  loadPagesList();
}

// 检查登录状态
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showAdminUI(true);
    loadPagesList();
  } else {
    showAdminUI(false);
  }
}

function showAdminUI(isLoggedIn) {
  document.getElementById('login-section').style.display = isLoggedIn ? 'none' : 'block';
  document.getElementById('admin-section').style.display = isLoggedIn ? 'block' : 'none';
}

// 登录
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');
  
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = '登录失败: ' + error.message;
  } else {
    errorEl.textContent = '';
    checkSession();
  }
});

// 登出
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  showAdminUI(false);
});

// 事件绑定
document.getElementById('save-btn').addEventListener('click', savePage);
document.getElementById('delete-btn').addEventListener('click', deletePage);
document.getElementById('new-page-btn').addEventListener('click', newPage);

// 切换页面时自动保存编辑器内容到currentPage
editor?.onDidChangeModelContent(() => {
  syncEditorToCurrentPage();
});
