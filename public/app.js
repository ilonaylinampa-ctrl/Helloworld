/* ── State ─────────────────────────────────────────────────────────── */
let products = [];
let categories = [];
let pendingDeleteId = null;

/* ── DOM refs ──────────────────────────────────────────────────────── */
const productTbody   = document.getElementById('product-tbody');
const searchInput    = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const statsBar       = document.getElementById('stats-bar');
const totalProducts  = document.getElementById('total-products');
const toast          = document.getElementById('toast');

const navItems       = document.querySelectorAll('.nav-item');
const views          = document.querySelectorAll('.view');

const productForm    = document.getElementById('product-form');
const editIdInput    = document.getElementById('edit-id');
const formTitle      = document.getElementById('form-title');
const formSubtitle   = document.getElementById('form-subtitle');
const submitBtn      = document.getElementById('submit-btn');
const cancelBtn      = document.getElementById('cancel-btn');
const categorySugg   = document.getElementById('category-suggestions');

const modalOverlay   = document.getElementById('modal-overlay');
const modalMsg       = document.getElementById('modal-msg');
const modalConfirm   = document.getElementById('modal-confirm');
const modalCancel    = document.getElementById('modal-cancel');

/* ── Navigation ────────────────────────────────────────────────────── */
function showView(name) {
  views.forEach(v => v.classList.remove('active'));
  navItems.forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelector(`[data-view="${name}"]`).classList.add('active');
}

navItems.forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const view = item.dataset.view;
    if (view === 'add') resetForm();
    showView(view);
  });
});

cancelBtn.addEventListener('click', () => showView('inventory'));

/* ── API helpers ───────────────────────────────────────────────────── */
const API = '/api/products';

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ── Load data ─────────────────────────────────────────────────────── */
async function loadProducts() {
  const search   = searchInput.value.trim();
  const category = categoryFilter.value;
  const params   = new URLSearchParams();
  if (search)               params.set('search', search);
  if (category !== 'all')   params.set('category', category);

  try {
    products = await fetchJSON(`${API}?${params}`);
    renderTable();
    renderStats();
  } catch (err) {
    showToast('Failed to load products: ' + err.message, 'error');
  }
}

async function loadCategories() {
  try {
    categories = await fetchJSON('/api/categories');
    renderCategoryFilter();
    renderCategorySuggestions();
  } catch (_) {}
}

function renderCategoryFilter() {
  const current = categoryFilter.value;
  categoryFilter.innerHTML = '<option value="all">All Categories</option>';
  categories.forEach(c => {
    const o = document.createElement('option');
    o.value = o.textContent = c;
    if (c === current) o.selected = true;
    categoryFilter.appendChild(o);
  });
}

function renderCategorySuggestions() {
  categorySugg.innerHTML = '';
  categories.forEach(c => {
    const o = document.createElement('option');
    o.value = c;
    categorySugg.appendChild(o);
  });
}

/* ── Stats ─────────────────────────────────────────────────────────── */
function renderStats() {
  const total    = products.length;
  const inStock  = products.filter(p => p.quantity > 10).length;
  const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= 10).length;
  const outStock = products.filter(p => p.quantity === 0).length;
  const value    = products.reduce((s, p) => s + p.price * p.quantity, 0);

  totalProducts.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;

  statsBar.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Products</div>
      <div class="stat-value">${total}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">In Stock</div>
      <div class="stat-value green">${inStock}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Low Stock</div>
      <div class="stat-value yellow">${lowStock}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Out of Stock</div>
      <div class="stat-value red">${outStock}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Inventory Value</div>
      <div class="stat-value">$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    </div>
  `;
}

/* ── Table ─────────────────────────────────────────────────────────── */
function stockStatus(qty) {
  if (qty === 0)  return { cls: 'status-out',      label: 'Out of Stock' };
  if (qty <= 10)  return { cls: 'status-low',      label: 'Low Stock' };
  return            { cls: 'status-in-stock', label: 'In Stock' };
}

function renderTable() {
  if (products.length === 0) {
    productTbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div>No products found</div>
        </div>
      </td></tr>`;
    return;
  }

  productTbody.innerHTML = products.map(p => {
    const status = stockStatus(p.quantity);
    return `
      <tr data-id="${p.id}">
        <td>
          <div class="product-name">${escHtml(p.name)}</div>
          ${p.description ? `<div class="product-desc" title="${escHtml(p.description)}">${escHtml(p.description)}</div>` : ''}
        </td>
        <td><span class="sku-badge">${escHtml(p.sku)}</span></td>
        <td><span class="category-tag">${escHtml(p.category)}</span></td>
        <td class="price-cell">$${Number(p.price).toFixed(2)}</td>
        <td>
          <div class="qty-control">
            <button class="qty-btn" data-action="dec" data-id="${p.id}" ${p.quantity === 0 ? 'disabled' : ''}>−</button>
            <input type="number" class="qty-input" value="${p.quantity}" min="0" data-id="${p.id}" />
            <button class="qty-btn" data-action="inc" data-id="${p.id}">+</button>
          </div>
        </td>
        <td><span class="status-badge ${status.cls}">${status.label}</span></td>
        <td>
          <div class="action-btns">
            <button class="icon-btn" data-action="edit" data-id="${p.id}" title="Edit">✏️</button>
            <button class="icon-btn danger" data-action="delete" data-id="${p.id}" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ── Table events (delegation) ─────────────────────────────────────── */
productTbody.addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;

  if (action === 'inc' || action === 'dec') {
    const row     = productTbody.querySelector(`tr[data-id="${id}"]`);
    const input   = row.querySelector('.qty-input');
    const current = parseInt(input.value, 10);
    const newQty  = action === 'inc' ? current + 1 : Math.max(0, current - 1);
    await updateQuantity(id, newQty);
  }
  if (action === 'edit')   openEditForm(parseInt(id, 10));
  if (action === 'delete') openDeleteModal(parseInt(id, 10));
});

productTbody.addEventListener('change', async e => {
  if (!e.target.classList.contains('qty-input')) return;
  const id  = e.target.dataset.id;
  const qty = parseInt(e.target.value, 10);
  if (isNaN(qty) || qty < 0) { e.target.value = products.find(p => p.id == id)?.quantity ?? 0; return; }
  await updateQuantity(id, qty);
});

async function updateQuantity(id, qty) {
  try {
    const updated = await fetchJSON(`${API}/${id}/quantity`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity: qty })
    });
    const idx = products.findIndex(p => p.id == id);
    if (idx !== -1) products[idx] = updated;
    renderTable();
    renderStats();
    showToast('Quantity updated ✓', 'success');
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
}

/* ── Edit form ─────────────────────────────────────────────────────── */
function openEditForm(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  editIdInput.value         = p.id;
  document.getElementById('f-name').value        = p.name;
  document.getElementById('f-sku').value         = p.sku;
  document.getElementById('f-category').value    = p.category;
  document.getElementById('f-price').value       = p.price;
  document.getElementById('f-quantity').value    = p.quantity;
  document.getElementById('f-description').value = p.description || '';
  formTitle.textContent    = 'Edit Product';
  formSubtitle.textContent = `Editing: ${p.name}`;
  submitBtn.textContent    = 'Save Changes';
  showView('add');
}

function resetForm() {
  productForm.reset();
  editIdInput.value        = '';
  formTitle.textContent    = 'Add Product';
  formSubtitle.textContent = 'Fill in the details below';
  submitBtn.textContent    = 'Add Product';
  productForm.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}

/* ── Form submit ───────────────────────────────────────────────────── */
productForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!validateForm()) return;

  const payload = {
    name:        document.getElementById('f-name').value.trim(),
    sku:         document.getElementById('f-sku').value.trim(),
    category:    document.getElementById('f-category').value.trim(),
    price:       parseFloat(document.getElementById('f-price').value),
    quantity:    parseInt(document.getElementById('f-quantity').value, 10),
    description: document.getElementById('f-description').value.trim(),
  };

  const editId = editIdInput.value;
  try {
    submitBtn.disabled = true;
    if (editId) {
      await fetchJSON(`${API}/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Product updated ✓', 'success');
    } else {
      await fetchJSON(API, { method: 'POST', body: JSON.stringify(payload) });
      showToast('Product added ✓', 'success');
    }
    await loadCategories();
    await loadProducts();
    showView('inventory');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

function validateForm() {
  let valid = true;
  ['f-name', 'f-sku', 'f-category', 'f-price', 'f-quantity'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('invalid');
    if (!el.value.trim()) { el.classList.add('invalid'); valid = false; }
  });
  return valid;
}

/* ── Delete modal ──────────────────────────────────────────────────── */
function openDeleteModal(id) {
  const p = products.find(x => x.id === id);
  pendingDeleteId = id;
  modalMsg.textContent = p ? `"${p.name}" will be permanently removed.` : 'This action cannot be undone.';
  modalOverlay.classList.remove('hidden');
}

modalCancel.addEventListener('click', () => { modalOverlay.classList.add('hidden'); pendingDeleteId = null; });
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) { modalOverlay.classList.add('hidden'); pendingDeleteId = null; } });

modalConfirm.addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  modalOverlay.classList.add('hidden');
  try {
    await fetchJSON(`${API}/${pendingDeleteId}`, { method: 'DELETE' });
    showToast('Product deleted', 'success');
    await loadCategories();
    await loadProducts();
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'error');
  }
  pendingDeleteId = null;
});

/* ── Search / filter ───────────────────────────────────────────────── */
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadProducts, 300);
});
categoryFilter.addEventListener('change', loadProducts);

/* ── Toast ─────────────────────────────────────────────────────────── */
let toastTimeout;
function showToast(msg, type = 'info') {
  clearTimeout(toastTimeout);
  toast.textContent = msg;
  toast.className   = `toast show ${type}`;
  toastTimeout      = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ── Utils ─────────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Init ──────────────────────────────────────────────────────────── */
(async () => {
  await loadCategories();
  await loadProducts();
})();
