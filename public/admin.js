// ══════════════════════════════════════════════════════════════
//  AutoAI Admin Dashboard JavaScript
// ══════════════════════════════════════════════════════════════

let allCars = [];
let editingCarId = null;
let deleteCarId = null;

// ── Init ───────────────────────────────────────────────────────
async function init() {
    const user = await checkAdminAuth();
    if (!user) return;

    // Set admin user info
    document.getElementById('admin-avatar').textContent = user.username.charAt(0).toUpperCase();
    document.getElementById('admin-username').textContent = user.username;

    // Setup navigation
    setupNavigation();

    // Load initial data
    loadDashboard();
    loadInventory();
    loadOrders();
    loadUsers();

    // Setup form listeners
    setupCarForm();
    setupDeleteModal();

    document.getElementById('admin-logout-btn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    });
}

async function checkAdminAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
            alert('You must be logged in as admin to access this page.');
            window.location.href = '/';
            return null;
        }
        const user = await res.json();
        if (user.role !== 'admin') {
            alert('Access denied. Admin privileges required.');
            window.location.href = '/';
            return null;
        }
        return user;
    } catch {
        window.location.href = '/';
        return null;
    }
}

// ── Navigation ─────────────────────────────────────────────────
function setupNavigation() {
    document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchSection(link.dataset.section);
        });
    });
}

function switchSection(sectionId) {
    // Update sidebar
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.sidebar-link[data-section="${sectionId}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Update sections
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(`section-${sectionId}`);
    if (section) section.classList.add('active');

    // Update page title
    const titles = { dashboard: 'Dashboard', inventory: 'Inventory', 'add-car': 'Add Car', orders: 'Orders', users: 'Users' };
    document.getElementById('page-title').textContent = titles[sectionId] || sectionId;
}

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════
async function loadDashboard() {
    try {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) throw new Error('Failed to load stats');
        const stats = await res.json();

        document.getElementById('stats-grid').innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">🚗</div>
                <div class="stat-value">${stats.totalCars}</div>
                <div class="stat-label">Total Cars</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-value">${stats.availableCars}</div>
                <div class="stat-label">Available</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📦</div>
                <div class="stat-value">${stats.soldCars}</div>
                <div class="stat-label">Sold</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🛒</div>
                <div class="stat-value">${stats.totalOrders}</div>
                <div class="stat-label">Orders</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">👥</div>
                <div class="stat-value">${stats.totalUsers}</div>
                <div class="stat-label">Customers</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">💰</div>
                <div class="stat-value">$${formatNumber(stats.totalRevenue || 0)}</div>
                <div class="stat-label">Revenue</div>
            </div>
        `;

        document.getElementById('orders-count-badge').textContent = `${stats.totalOrders} orders`;

        // Recent orders table
        const recentOrders = stats.recentOrders || [];
        if (recentOrders.length === 0) {
            document.getElementById('recent-orders-table').innerHTML = '<p style="color:var(--text-muted);padding:1rem 0;">No orders yet.</p>';
        } else {
            document.getElementById('recent-orders-table').innerHTML = `
                <table class="admin-table">
                    <thead><tr><th>Order #</th><th>Customer</th><th>Car</th><th>Price</th><th>Date</th><th>Status</th></tr></thead>
                    <tbody>
                    ${recentOrders.map(o => `
                        <tr>
                            <td>#${o.id}</td>
                            <td>${escHtml(o.username)}</td>
                            <td>${escHtml(o.make)} ${escHtml(o.model)}</td>
                            <td>${escHtml(o.price)}</td>
                            <td>${new Date(o.order_date).toLocaleDateString()}</td>
                            <td><span class="badge badge-${o.status || 'pending'}">${o.status || 'pending'}</span></td>
                        </tr>
                    `).join('')}
                    </tbody>
                </table>`;
        }
    } catch (e) {
        document.getElementById('stats-grid').innerHTML = `<p style="color:var(--danger)">Failed to load stats: ${e.message}</p>`;
    }
}

// ══════════════════════════════════════════════════════════════
//  INVENTORY
// ══════════════════════════════════════════════════════════════
async function loadInventory() {
    try {
        const res = await fetch('/api/cars');
        allCars = await res.json();
        renderInventoryTable(allCars);

        // Search
        document.getElementById('inventory-search').addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtered = allCars.filter(c =>
                `${c.make} ${c.model}`.toLowerCase().includes(q) ||
                (c.category || '').toLowerCase().includes(q) ||
                (c.type || '').toLowerCase().includes(q)
            );
            renderInventoryTable(filtered);
        });
    } catch (e) {
        document.getElementById('inventory-tbody').innerHTML = `<tr><td colspan="9" style="color:var(--danger)">Failed to load inventory.</td></tr>`;
    }
}

function renderInventoryTable(carsToRender) {
    if (!carsToRender || carsToRender.length === 0) {
        document.getElementById('inventory-tbody').innerHTML = `<tr><td colspan="9" class="table-loading">No cars found.</td></tr>`;
        return;
    }

    document.getElementById('inventory-tbody').innerHTML = carsToRender.map(car => `
        <tr id="car-row-${car.id}">
            <td><img class="table-car-img" src="${escHtml(car.image)}" alt="" onerror="this.src='https://via.placeholder.com/70x50/1a2035/4f8ef7?text=Car'"></td>
            <td>
                <div class="table-car-name">${escHtml(car.make)} ${escHtml(car.model)}</div>
                <div class="table-car-meta">${car.year || '-'} . ${escHtml(car.powertrain)}</div>
            </td>
            <td>${car.year || '-'}</td>
            <td>${escHtml(car.price)}</td>
            <td>${escHtml(car.type)}</td>
            <td>${escHtml(car.category || 'General')}</td>
            <td>
                <select class="status-select status-car-${car.status || 'available'}" onchange="updateCarStatus(${car.id}, this)">
                    <option value="available" ${(car.status || 'available') === 'available' ? 'selected' : ''}>Available</option>
                    <option value="sold"      ${car.status === 'sold'      ? 'selected' : ''}>Sold</option>
                    <option value="reserved"  ${car.status === 'reserved'  ? 'selected' : ''}>Reserved</option>
                </select>
            </td>
            <td>Views: ${car.views || 0}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-warning" onclick="editCar(${car.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="confirmDelete(${car.id}, '${escHtml(car.make)} ${escHtml(car.model)}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function updateCarStatus(carId, selectEl) {
    const status = selectEl.value;
    selectEl.disabled = true;
    try {
        const res = await fetch(`/api/admin/cars/${carId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (res.ok) {
            selectEl.className = `status-select status-car-${status}`;
            const car = allCars.find(c => c.id === carId);
            if (car) car.status = status;
            showToast(`Car marked as "${status}"`, 'success');
        } else {
            showToast(data.error || 'Failed to update status', 'error');
            selectEl.value = allCars.find(c => c.id === carId)?.status || 'available';
        }
    } catch {
        showToast('Network error', 'error');
    } finally {
        selectEl.disabled = false;
    }
}


// ══════════════════════════════════════════════════════════════
//  ADD / EDIT CAR FORM
// ══════════════════════════════════════════════════════════════
function setupCarForm() {
    // Image preview
    document.getElementById('preview-image-btn').addEventListener('click', () => {
        const url = document.getElementById('car-image').value.trim();
        if (!url) return;
        const wrapper = document.getElementById('image-preview-wrapper');
        const img = document.getElementById('image-preview');
        img.src = url;
        img.onerror = () => { showToast('Image could not be loaded. Check the URL.', 'error'); wrapper.style.display = 'none'; };
        img.onload = () => { wrapper.style.display = 'block'; };
    });

    // AI Generate
    document.getElementById('ai-generate-btn').addEventListener('click', generateWithAI);

    // Form submit
    document.getElementById('car-form').addEventListener('submit', handleCarFormSubmit);
}

function resetCarForm() {
    editingCarId = null;
    document.getElementById('car-form').reset();
    document.getElementById('editing-car-id').value = '';
    document.getElementById('car-form-title').textContent = 'Add New Car';
    document.getElementById('editing-indicator').style.display = 'none';
    document.getElementById('ai-stats-preview').style.display = 'none';
    document.getElementById('car-ai-statistics').value = '';
    document.getElementById('car-form-msg').textContent = '';
    document.getElementById('image-preview-wrapper').style.display = 'none';
    document.getElementById('save-car-btn').textContent = 'Save Car';
}

function editCar(carId) {
    const car = allCars.find(c => c.id === carId);
    if (!car) return;

    editingCarId = carId;
    switchSection('add-car');

    document.getElementById('car-form-title').textContent = 'Edit Car';
    document.getElementById('editing-car-name').textContent = `${car.make} ${car.model}`;
    document.getElementById('editing-indicator').style.display = 'flex';
    document.getElementById('editing-car-id').value = carId;
    document.getElementById('save-car-btn').textContent = 'Update Car';

    // Populate form
    document.getElementById('car-make').value = car.make || '';
    document.getElementById('car-model').value = car.model || '';
    document.getElementById('car-year').value = car.year || '';
    document.getElementById('car-color').value = car.color || '';
    document.getElementById('car-price').value = car.price || '';
    document.getElementById('car-price-num').value = car.price_num || '';
    document.getElementById('car-type').value = car.type || '';
    document.getElementById('car-category').value = car.category || 'General';
    document.getElementById('car-powertrain').value = car.powertrain || '';
    document.getElementById('car-mileage').value = car.mileage || '';
    document.getElementById('car-status').value = car.status || 'available';
    document.getElementById('car-recommended').checked = car.recommended === 1;
    document.getElementById('car-image').value = car.image || '';
    document.getElementById('car-features').value = Array.isArray(car.features) ? car.features.join(', ') : '';
    document.getElementById('car-description').value = car.description || '';

    if (car.ai_statistics) {
        document.getElementById('car-ai-statistics').value = JSON.stringify(car.ai_statistics);
        renderAIStatsPreview(car.ai_statistics);
    }

    // Preview image
    if (car.image) {
        const img = document.getElementById('image-preview');
        img.src = car.image;
        img.onload = () => { document.getElementById('image-preview-wrapper').style.display = 'block'; };
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleCarFormSubmit(e) {
    e.preventDefault();
    const msgEl = document.getElementById('car-form-msg');
    msgEl.textContent = '';
    msgEl.className = 'form-msg';

    const btn = document.getElementById('save-car-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const featuresRaw = document.getElementById('car-features').value;
    const features = featuresRaw.split(',').map(f => f.trim()).filter(Boolean);

    let ai_statistics = null;
    const statsStr = document.getElementById('car-ai-statistics').value;
    if (statsStr) {
        try { ai_statistics = JSON.parse(statsStr); } catch {}
    }

    const carData = {
        make: document.getElementById('car-make').value.trim(),
        model: document.getElementById('car-model').value.trim(),
        year: document.getElementById('car-year').value || null,
        color: document.getElementById('car-color').value.trim(),
        price: document.getElementById('car-price').value.trim(),
        price_num: document.getElementById('car-price-num').value || null,
        type: document.getElementById('car-type').value,
        category: document.getElementById('car-category').value,
        powertrain: document.getElementById('car-powertrain').value,
        mileage: document.getElementById('car-mileage').value.trim(),
        status: document.getElementById('car-status').value,
        recommended: document.getElementById('car-recommended').checked,
        image: document.getElementById('car-image').value.trim(),
        features,
        description: document.getElementById('car-description').value.trim(),
        ai_statistics,
    };

    try {
        const isEditing = !!editingCarId;
        const url = isEditing ? `/api/admin/cars/${editingCarId}` : '/api/admin/cars';
        const method = isEditing ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(carData)
        });

        const data = await res.json();
        if (res.ok) {
            msgEl.textContent = isEditing ? '✅ Car updated successfully!' : '✅ Car added successfully!';
            msgEl.classList.add('success');
            showToast(isEditing ? 'Car updated!' : 'Car added!', 'success');
            await loadInventory();
            if (!isEditing) {
                setTimeout(resetCarForm, 1500);
            }
        } else {
            msgEl.textContent = data.error || 'Failed to save car.';
            msgEl.classList.add('error');
        }
    } catch {
        msgEl.textContent = 'Network error. Please try again.';
        msgEl.classList.add('error');
    } finally {
        btn.disabled = false;
        btn.textContent = editingCarId ? 'Update Car' : 'Save Car';
    }
}

// ── AI Generate ────────────────────────────────────────────────
async function generateWithAI() {
    const make = document.getElementById('car-make').value.trim();
    const model = document.getElementById('car-model').value.trim();
    const price = document.getElementById('car-price').value.trim();
    const type = document.getElementById('car-type').value;
    const powertrain = document.getElementById('car-powertrain').value;

    if (!make || !model) {
        showToast('Please fill in Make and Model first', 'error');
        return;
    }

    const btn = document.getElementById('ai-generate-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Generating...';

    const featuresRaw = document.getElementById('car-features').value;
    const features = featuresRaw.split(',').map(f => f.trim()).filter(Boolean);

    try {
        const res = await fetch('/api/admin/generate-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                make,
                model,
                year: document.getElementById('car-year').value || null,
                price: price || 'N/A',
                type: type || 'N/A',
                category: document.getElementById('car-category').value,
                powertrain: powertrain || 'N/A',
                features,
                mileage: document.getElementById('car-mileage').value.trim(),
                color: document.getElementById('car-color').value.trim(),
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'AI generation failed');

        // Fill in description
        if (data.description) {
            document.getElementById('car-description').value = data.description;
        }

        // Store and preview stats
        if (data.statistics) {
            document.getElementById('car-ai-statistics').value = JSON.stringify(data.statistics);
            renderAIStatsPreview(data.statistics);
        }

        showToast('AI content generated! Review and save.', 'success');
    } catch (e) {
        showToast(e.message || 'AI generation failed', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✨ Generate with AI';
    }
}

function renderAIStatsPreview(stats) {
    const preview = document.getElementById('ai-stats-preview');
    const content = document.getElementById('ai-stats-content');

    if (!stats) { preview.style.display = 'none'; return; }

    content.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;margin-bottom:1rem;">
            <div style="background:var(--bg-card2);padding:0.75rem;border-radius:8px;text-align:center;">
                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Performance</div>
                <div style="font-size:1.5rem;font-weight:800;color:var(--accent)">${stats.performance_score || '—'}</div>
            </div>
            <div style="background:var(--bg-card2);padding:0.75rem;border-radius:8px;text-align:center;">
                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Comfort</div>
                <div style="font-size:1.5rem;font-weight:800;color:var(--accent)">${stats.comfort_score || '—'}</div>
            </div>
            <div style="background:var(--bg-card2);padding:0.75rem;border-radius:8px;text-align:center;">
                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Value</div>
                <div style="font-size:1.5rem;font-weight:800;color:var(--accent)">${stats.value_score || '—'}</div>
            </div>
        </div>
        <div style="font-size:0.82rem;margin-bottom:0.5rem;"><strong style="color:var(--text)">0-60:</strong> ${stats['0_to_60'] || '—'} · <strong style="color:var(--text)">HP:</strong> ${stats.horsepower || '—'} · <strong style="color:var(--text)">Economy:</strong> ${stats.fuel_efficiency || '—'}</div>
        ${stats.pros ? `<div style="font-size:0.82rem;margin-bottom:0.25rem;"><strong style="color:var(--success)">Pros:</strong> ${stats.pros.slice(0,3).join(', ')}</div>` : ''}
        ${stats.cons ? `<div style="font-size:0.82rem;margin-bottom:0.5rem;"><strong style="color:var(--danger)">Cons:</strong> ${stats.cons.slice(0,3).join(', ')}</div>` : ''}
        ${stats.ai_verdict ? `<div style="font-size:0.82rem;color:var(--accent);font-style:italic;border-top:1px solid var(--border);padding-top:0.5rem;margin-top:0.5rem;">🤖 ${stats.ai_verdict}</div>` : ''}
    `;

    preview.style.display = 'block';
}

// ══════════════════════════════════════════════════════════════
//  DELETE
// ══════════════════════════════════════════════════════════════
function confirmDelete(carId, carName) {
    deleteCarId = carId;
    document.getElementById('delete-confirm-modal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('delete-confirm-modal').classList.remove('active');
    deleteCarId = null;
}

function setupDeleteModal() {
    document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
        if (!deleteCarId) return;
        const btn = document.getElementById('confirm-delete-btn');
        btn.disabled = true;
        btn.textContent = 'Deleting...';

        try {
            const res = await fetch(`/api/admin/cars/${deleteCarId}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                showToast('Car deleted!', 'success');
                closeDeleteModal();
                await loadInventory();
            } else {
                showToast(data.error || 'Delete failed', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Delete';
        }
    });

    document.getElementById('delete-confirm-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('delete-confirm-modal')) closeDeleteModal();
    });
}

// ══════════════════════════════════════════════════════════════
//  ORDERS
// ══════════════════════════════════════════════════════════════
async function loadOrders() {
    try {
        const res = await fetch('/api/admin/orders');
        const orders = await res.json();

        if (!orders.length) {
            document.getElementById('orders-tbody').innerHTML = `<tr><td colspan="7" class="table-loading">No orders yet.</td></tr>`;
            return;
        }

        document.getElementById('orders-tbody').innerHTML = orders.map(o => `
            <tr id="order-row-${o.id}">
                <td style="font-weight:700;">#${o.id}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:0.6rem;">
                        <img src="${escHtml(o.image || '')}" style="width:52px;height:38px;object-fit:cover;border-radius:6px;flex-shrink:0;" onerror="this.style.display='none'">
                        <div>
                            <div style="font-weight:700;font-size:0.85rem;">${escHtml(o.make)} ${escHtml(o.model)}</div>
                            <div style="font-size:0.75rem;color:var(--accent);font-weight:700;">${escHtml(o.price)}</div>
                        </div>
                    </div>
                </td>
                <td>${escHtml(o.username)}</td>
                <td style="font-size:0.82rem;color:var(--text-muted);">${new Date(o.order_date).toLocaleDateString()}</td>
                <td style="font-size:0.78rem;color:var(--text-muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(o.address || '')}">${escHtml(o.address || 'N/A')}</td>
                <td>
                    <select class="status-select delivery-${o.status || 'pending'}" onchange="updateOrderStatus(${o.id}, this)">
                        <option value="pending"          ${(o.status||'pending')==='pending'          ?'selected':''}>Pending</option>
                        <option value="confirmed"        ${o.status==='confirmed'        ?'selected':''}>Confirmed</option>
                        <option value="processing"       ${o.status==='processing'       ?'selected':''}>Processing</option>
                        <option value="shipped"          ${o.status==='shipped'          ?'selected':''}>Shipped</option>
                        <option value="out_for_delivery" ${o.status==='out_for_delivery' ?'selected':''}>Out for Delivery</option>
                        <option value="delivered"        ${o.status==='delivered'        ?'selected':''}>Delivered</option>
                        <option value="cancelled"        ${o.status==='cancelled'        ?'selected':''}>Cancelled</option>
                    </select>
                </td>
            </tr>
        `).join('');
    } catch {
        document.getElementById('orders-tbody').innerHTML = `<tr><td colspan="7" style="color:var(--danger);text-align:center;padding:2rem;">Failed to load orders.</td></tr>`;
    }
}

async function updateOrderStatus(orderId, selectEl) {
    const status = selectEl.value;
    const prevClass = selectEl.className;
    selectEl.disabled = true;
    try {
        const res = await fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (res.ok) {
            selectEl.className = `status-select delivery-${status}`;
            const label = selectEl.options[selectEl.selectedIndex].text;
            showToast(`Order #${orderId} updated to "${label}"`, 'success');
        } else {
            showToast(data.error || 'Failed to update delivery status', 'error');
            selectEl.className = prevClass;
        }
    } catch {
        showToast('Network error', 'error');
        selectEl.className = prevClass;
    } finally {
        selectEl.disabled = false;
    }
}


// ══════════════════════════════════════════════════════════════
//  USERS
// ══════════════════════════════════════════════════════════════
async function loadUsers() {
    try {
        const res = await fetch('/api/admin/users');
        const users = await res.json();

        if (!users.length) {
            document.getElementById('users-tbody').innerHTML = `<tr><td colspan="5" class="table-loading">No users yet.</td></tr>`;
            return;
        }

        document.getElementById('users-tbody').innerHTML = users.map(u => `
            <tr>
                <td>#${u.id}</td>
                <td>${escHtml(u.username)}</td>
                <td>${escHtml(u.email || '—')}</td>
                <td><span class="badge badge-${u.role}">${u.role}</span></td>
                <td>${new Date(u.created_at || Date.now()).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch {
        document.getElementById('users-tbody').innerHTML = `<tr><td colspan="5" style="color:var(--danger);text-align:center;padding:2rem;">Failed to load users.</td></tr>`;
    }
}

// ══════════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════════
function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function formatNumber(n) {
    if (!n) return '0';
    const num = parseFloat(n);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toFixed(0);
}

function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.background = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--accent)';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; setTimeout(() => toast.remove(), 400); }, 3500);
}

// ── Start ──────────────────────────────────────────────────────
init();
