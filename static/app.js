'use strict';

const API = '/api';
let allAssets = [];
let deleteTargetId = null;
const assetModal  = new bootstrap.Modal(document.getElementById('assetModal'));
const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));

// ── Bootstrap ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadAssets();

  document.getElementById('filter-category').addEventListener('change', renderTable);
  document.getElementById('filter-status').addEventListener('change', renderTable);
  document.getElementById('search-input').addEventListener('input', renderTable);
});

// ── Stats ─────────────────────────────────────────────────────────────────

async function loadStats() {
  const data = await fetchJSON(`${API}/stats`);
  const row  = document.getElementById('stats-row');
  row.innerHTML = `
    <div class="col-6 col-sm-4 col-lg-2">
      <div class="card stat-card total p-3">
        <div class="fw-bold text-success fs-4">${data.total}</div>
        <div class="text-muted small">Total Assets</div>
      </div>
    </div>
    <div class="col-6 col-sm-4 col-lg-2">
      <div class="card stat-card tool p-3">
        <div class="fw-bold text-primary fs-4">${data.by_category.tool}</div>
        <div class="text-muted small">Tools</div>
      </div>
    </div>
    <div class="col-6 col-sm-4 col-lg-2">
      <div class="card stat-card machine p-3">
        <div class="fw-bold text-purple fs-4">${data.by_category.machine}</div>
        <div class="text-muted small">Machines</div>
      </div>
    </div>
    <div class="col-6 col-sm-3 col-lg-2">
      <div class="card stat-card available p-3">
        <div class="fw-bold fs-4" style="color:#20c997">${data.by_status.available}</div>
        <div class="text-muted small">Available</div>
      </div>
    </div>
    <div class="col-6 col-sm-3 col-lg-2">
      <div class="card stat-card in_use p-3">
        <div class="fw-bold text-warning fs-4">${data.by_status.in_use}</div>
        <div class="text-muted small">In Use</div>
      </div>
    </div>
    <div class="col-6 col-sm-3 col-lg-2">
      <div class="card stat-card maintenance p-3">
        <div class="fw-bold text-danger fs-4">${data.by_status.maintenance}</div>
        <div class="text-muted small">Maintenance</div>
      </div>
    </div>
  `;
}

// ── Assets ────────────────────────────────────────────────────────────────

async function loadAssets() {
  allAssets = await fetchJSON(`${API}/assets`);
  renderTable();
}

function renderTable() {
  const category = document.getElementById('filter-category').value;
  const status   = document.getElementById('filter-status').value;
  const search   = document.getElementById('search-input').value.toLowerCase().trim();

  const filtered = allAssets.filter(a => {
    if (category && a.category !== category) return false;
    if (status   && a.status   !== status)   return false;
    if (search && !a.name.toLowerCase().includes(search) &&
                  !a.asset_type.toLowerCase().includes(search)) return false;
    return true;
  });

  const tbody = document.getElementById('assets-tbody');
  const noMsg = document.getElementById('no-assets');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    noMsg.classList.remove('d-none');
    return;
  }
  noMsg.classList.add('d-none');

  tbody.innerHTML = filtered.map(a => `
    <tr>
      <td>${a.id}</td>
      <td class="fw-semibold">${esc(a.name)}</td>
      <td><span class="badge bg-${a.category === 'tool' ? 'primary' : 'purple'} text-capitalize">${esc(a.category)}</span></td>
      <td>${esc(a.asset_type)}</td>
      <td class="text-muted small">${esc(a.serial_number || '—')}</td>
      <td><span class="badge badge-${a.status} text-capitalize">${esc(a.status.replace('_', ' '))}</span></td>
      <td>${esc(a.location || '—')}</td>
      <td>${a.last_maintenance || '—'}</td>
      <td>
        <button class="btn btn-sm btn-outline-success me-1" title="Edit" onclick="openEditModal(${a.id})">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" title="Delete" onclick="openDeleteModal(${a.id}, '${esc(a.name)}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────

function openAddModal() {
  document.getElementById('modal-title').textContent = 'Add Asset';
  document.getElementById('asset-form').reset();
  document.getElementById('asset-id').value = '';
  document.getElementById('form-error').classList.add('d-none');
  assetModal.show();
}

async function openEditModal(id) {
  const asset = await fetchJSON(`${API}/assets/${id}`);
  document.getElementById('modal-title').textContent = 'Edit Asset';
  document.getElementById('asset-id').value       = asset.id;
  document.getElementById('f-name').value          = asset.name;
  document.getElementById('f-category').value      = asset.category;
  document.getElementById('f-asset-type').value    = asset.asset_type;
  document.getElementById('f-serial').value         = asset.serial_number || '';
  document.getElementById('f-status').value         = asset.status;
  document.getElementById('f-location').value       = asset.location || '';
  document.getElementById('f-purchase-date').value  = asset.purchase_date || '';
  document.getElementById('f-last-maintenance').value = asset.last_maintenance || '';
  document.getElementById('f-notes').value          = asset.notes || '';
  document.getElementById('form-error').classList.add('d-none');
  assetModal.show();
}

async function saveAsset() {
  const id = document.getElementById('asset-id').value;
  const payload = {
    name:             document.getElementById('f-name').value.trim(),
    category:         document.getElementById('f-category').value,
    asset_type:       document.getElementById('f-asset-type').value.trim(),
    serial_number:    document.getElementById('f-serial').value.trim() || null,
    status:           document.getElementById('f-status').value,
    location:         document.getElementById('f-location').value.trim() || null,
    purchase_date:    document.getElementById('f-purchase-date').value || null,
    last_maintenance: document.getElementById('f-last-maintenance').value || null,
    notes:            document.getElementById('f-notes').value.trim() || null,
  };

  const url    = id ? `${API}/assets/${id}` : `${API}/assets`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showFormError(data.error || 'An error occurred.');
      return;
    }
    assetModal.hide();
    await loadAssets();
    await loadStats();
  } catch (e) {
    showFormError('Network error. Please try again.');
  }
}

function showFormError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.classList.remove('d-none');
}

// ── Delete ────────────────────────────────────────────────────────────────

function openDeleteModal(id, name) {
  deleteTargetId = id;
  document.getElementById('delete-name').textContent = name;
  deleteModal.show();
}

async function confirmDelete() {
  if (!deleteTargetId) return;
  await fetch(`${API}/assets/${deleteTargetId}`, { method: 'DELETE' });
  deleteModal.hide();
  deleteTargetId = null;
  await loadAssets();
  await loadStats();
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function fetchJSON(url) {
  const res = await fetch(url);
  return res.json();
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
