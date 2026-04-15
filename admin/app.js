(function(){
  'use strict';

  const SUPABASE_URL = 'https://sqhcbwqrpyzglbcclzzj.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxaGNid3FycHl6Z2xiY2NsenpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODIwMDUsImV4cCI6MjA5MTc1ODAwNX0.1-MdHopPxwfzU9Zu78Ae4FiyMazAPswrA4HwcHJKeP0';

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let currentPage = null;
  let editor = null;
  let currentLanguage = 'html';
  let pagesList = [];

  const loginSection = document.getElementById('login-section');
  const adminSection = document.getElementById('admin-section');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const pageListEl = document.getElementById('page-list');
  const newPageBtn = document.getElementById('new-page-btn');
  const saveBtn = document.getElementById('save-btn');
  const deleteBtn = document.getElementById('delete-btn');
  const slugInput = document.getElementById('slug');
  const titleInput = document.getElementById('title');
  const isPublishedCheck = document.getElementById('is-published');
  const saveStatus = document.getElementById('save-status');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const editorContainer = document.getElementById('editor-container');

  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs' } });
  require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(editorContainer, {
      value: '',
      language: 'html',
      theme: 'vs-light',
      automaticLayout: true,
      minimap: { enabled: false }
    });
    editor.onDidChangeModelContent(() => {
      if (!currentPage) return;
      const content = editor.getValue();
      if (currentLanguage === 'html') currentPage.html = content;
      else if (currentLanguage === 'css') currentPage.css = content;
      else if (currentLanguage === 'js') currentPage.javascript = content;
    });
    checkSession();
  });

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (!tab) return;
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (currentPage && editor) {
        const content = editor.getValue();
        if (currentLanguage === 'html') currentPage.html = content;
        else if (currentLanguage === 'css') currentPage.css = content;
        else if (currentLanguage === 'js') currentPage.javascript = content;
      }
      currentLanguage = tab;
      if (editor) {
        const model = editor.getModel();
        if (model) monaco.editor.setModelLanguage(model, tab);
      }
      loadContentToEditor();
    });
  });

  function loadContentToEditor() {
    if (!editor || !currentPage) return;
    let content = '';
    if (currentLanguage === 'html') content = currentPage.html || '';
    else if (currentLanguage === 'css') content = currentPage.css || '';
    else if (currentLanguage === 'js') content = currentPage.javascript || '';
    editor.setValue(content);
  }

  function syncFormToPage() {
    if (!currentPage) currentPage = {};
    currentPage.slug = slugInput.value.trim();
    currentPage.title = titleInput.value.trim();
    currentPage.is_published = isPublishedCheck.checked;
  }

  function fillFormFromPage() {
    slugInput.value = currentPage?.slug || '';
    titleInput.value = currentPage?.title || '';
    isPublishedCheck.checked = currentPage?.is_published ?? true;
  }

  async function loadPagesList() {
    const { data, error } = await supabase
      .from('pages')
      .select('id, slug, title, is_published')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('加载页面列表失败:', error);
      return;
    }
    pagesList = data || [];
    renderPageList();
  }

  function renderPageList() {
    if (!pageListEl) return;
    pageListEl.innerHTML = '';
    pagesList.forEach(page => {
      const li = document.createElement('li');
      li.className = currentPage?.id === page.id ? 'active' : '';
      li.innerHTML = `<span>${page.title || page.slug}</span> ${page.is_published ? '✅' : '📝'}`;
      li.addEventListener('click', () => selectPage(page.id));
      pageListEl.appendChild(li);
    });
  }

  async function selectPage(id) {
    if (currentPage && editor) {
      const content = editor.getValue();
      if (currentLanguage === 'html') currentPage.html = content;
      else if (currentLanguage === 'css') currentPage.css = content;
      else if (currentLanguage === 'js') currentPage.javascript = content;
    }
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      alert('加载页面失败: ' + error.message);
      return;
    }
    currentPage = data;
    fillFormFromPage();
    loadContentToEditor();
    renderPageList();
  }

  function newPage() {
    if (currentPage && editor) {
      const content = editor.getValue();
      if (currentLanguage === 'html') currentPage.html = content;
      else if (currentLanguage === 'css') currentPage.css = content;
      else if (currentLanguage === 'js') currentPage.javascript = content;
    }
    currentPage = {
      slug: '',
      title: '',
      html: '<h1>新页面</h1>\n<p>在这里编辑内容</p>',
      css: '',
      javascript: '',
      is_published: true
    };
    fillFormFromPage();
    loadContentToEditor();
    renderPageList();
  }

  async function savePage() {
    if (!currentPage) {
      alert('没有正在编辑的页面');
      return;
    }
    syncFormToPage();
    if (editor) {
      const content = editor.getValue();
      if (currentLanguage === 'html') currentPage.html = content;
      else if (currentLanguage === 'css') currentPage.css = content;
      else if (currentLanguage === 'js') currentPage.javascript = content;
    }
    if (!currentPage.slug) {
      alert('Slug（URL路径）不能为空');
      return;
    }
    saveStatus.textContent = '保存中...';
    const pageData = {
      slug: currentPage.slug,
      title: currentPage.title,
      html: currentPage.html,
      css: currentPage.css,
      javascript: currentPage.javascript,
      is_published: currentPage.is_published,
      updated_at: new Date().toISOString()
    };
    let result;
    if (currentPage.id) {
      result = await supabase
        .from('pages')
        .update(pageData)
        .eq('id', currentPage.id)
        .select();
    } else {
      result = await supabase
        .from('pages')
        .insert([pageData])
        .select();
    }
    if (result.error) {
      saveStatus.textContent = '错误: ' + result.error.message;
      console.error(result.error);
    } else {
      if (result.data && result.data.length > 0) {
        currentPage.id = result.data[0].id;
      }
      saveStatus.textContent = '保存成功 ✓';
      setTimeout(() => { saveStatus.textContent = ''; }, 2000);
      await loadPagesList();
    }
  }

  async function deletePage() {
    if (!currentPage?.id) {
      alert('没有可删除的页面');
      return;
    }
    if (!confirm(`确定要删除页面 "${currentPage.title}" 吗？`)) return;
    const { error } = await supabase
      .from('pages')
      .delete()
      .eq('id', currentPage.id);
    if (error) {
      alert('删除失败: ' + error.message);
      return;
    }
    currentPage = null;
    if (editor) editor.setValue('');
    fillFormFromPage();
    await loadPagesList();
    renderPageList();
  }

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      showAdminUI(true);
      await loadPagesList();
    } else {
      showAdminUI(false);
    }
  }

  function showAdminUI(isLoggedIn) {
    loginSection.style.display = isLoggedIn ? 'none' : 'block';
    adminSection.style.display = isLoggedIn ? 'block' : 'none';
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      loginError.textContent = '';
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        loginError.textContent = '登录失败: ' + error.message;
      } else {
        await checkSession();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      showAdminUI(false);
      currentPage = null;
      pagesList = [];
      if (editor) editor.setValue('');
    });
  }

  if (newPageBtn) newPageBtn.addEventListener('click', newPage);
  if (saveBtn) saveBtn.addEventListener('click', savePage);
  if (deleteBtn) deleteBtn.addEventListener('click', deletePage);

})();
