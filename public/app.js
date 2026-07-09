// ══════════════════════════════════════════════════════════════
//  AutoAI — Agentic Frontend
// ══════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────
let cars = [];
let currentUser = null;
let selectedCar = null;
let chatHistory = [];
let isTyping = false;

// ── DOM References ─────────────────────────────────────────────
const carGrid = document.getElementById('car-grid');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const authSection = document.getElementById('auth-section');

const authModal = document.getElementById('auth-modal');
const carModal = document.getElementById('car-modal');
const checkoutModal = document.getElementById('checkout-modal');
const ordersModal = document.getElementById('orders-modal');

// ══════════════════════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════════════════════
async function init() {
    await checkAuthStatus();
    await fetchCars();
    setupEventListeners();
    setupImageSearch();
    setupFilters();
    setupHeroSearch();
    setupPasswordStrength();
}

// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════
async function checkAuthStatus() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            currentUser = await res.json();
        } else {
            currentUser = null;
        }
    } catch (e) {
        currentUser = null;
    }
    renderAuthUI();
}

function renderAuthUI() {
    if (currentUser) {
        const initial = currentUser.username.charAt(0).toUpperCase();
        const isAdmin = currentUser.role === 'admin';
        authSection.innerHTML = `
            <div class="user-greeting-wrapper">
                <div class="user-avatar">${initial}</div>
                <div>
                    <div class="user-greeting">${currentUser.username}</div>
                    <div class="user-role-badge">${currentUser.role}</div>
                </div>
            </div>
            ${isAdmin ? `<a href="/admin" class="admin-dashboard-link">⚙️ Admin</a>` : ''}
            <button id="my-orders-btn" class="btn btn-outline btn-sm">📋 Orders</button>
            <button id="logout-btn" class="btn btn-ghost btn-sm">Logout</button>
        `;
        document.getElementById('logout-btn').addEventListener('click', handleLogout);
        document.getElementById('my-orders-btn').addEventListener('click', openOrdersModal);
    } else {
        authSection.innerHTML = `
            <button id="register-header-btn" class="btn btn-outline">Register</button>
            <button id="login-header-btn" class="btn btn-primary">Login</button>
        `;
        document.getElementById('register-header-btn').addEventListener('click', () => openAuthModal('register'));
        document.getElementById('login-header-btn').addEventListener('click', () => openAuthModal('login'));
    }
}

async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    renderAuthUI();
    showToast('Logged out successfully', 'info');
}

function openAuthModal(tab = 'login') {
    authModal.classList.add('active');
    switchAuthTab(tab);
}

function closeAuthModal() {
    authModal.classList.remove('active');
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
    document.getElementById('register-success').textContent = '';
}

function switchAuthTab(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('login-panel').classList.toggle('active', tab === 'login');
    document.getElementById('register-panel').classList.toggle('active', tab === 'register');
}

// ── Login ──────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const loginError = document.getElementById('login-error');
    loginError.textContent = '';
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    const btn = e.target.querySelector('[type=submit]');
    btn.textContent = 'Signing in...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
            renderAuthUI();
            closeAuthModal();
            showToast(`Welcome back, ${data.user.username}! 🚗`, 'success');
            if (selectedCar) openCheckoutModal();
            // Redirect admin
            if (data.user.role === 'admin') {
                showToast('Admin detected! Click "Admin" to access the dashboard.', 'info');
            }
        } else {
            loginError.textContent = data.error || 'Login failed';
        }
    } catch {
        loginError.textContent = 'Network error. Please try again.';
    } finally {
        btn.textContent = 'Sign In';
        btn.disabled = false;
    }
});

// ── Register ───────────────────────────────────────────────────
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const registerError = document.getElementById('register-error');
    const registerSuccess = document.getElementById('register-success');
    registerError.textContent = '';
    registerSuccess.textContent = '';

    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (password !== confirm) {
        registerError.textContent = 'Passwords do not match.';
        return;
    }

    const btn = e.target.querySelector('[type=submit]');
    btn.textContent = 'Creating account...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
            renderAuthUI();
            closeAuthModal();
            showToast(`Account created! Welcome, ${data.user.username}! 🎉`, 'success');
        } else {
            registerError.textContent = data.error || 'Registration failed';
        }
    } catch {
        registerError.textContent = 'Network error. Please try again.';
    } finally {
        btn.textContent = 'Create Account';
        btn.disabled = false;
    }
});

function setupPasswordStrength() {
    const pwInput = document.getElementById('reg-password');
    const bar = document.getElementById('password-strength');
    pwInput.addEventListener('input', () => {
        const pw = pwInput.value;
        bar.className = 'password-strength';
        if (pw.length === 0) return;
        if (pw.length < 6) bar.classList.add('pw-weak');
        else if (pw.length < 10 || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) bar.classList.add('pw-medium');
        else bar.classList.add('pw-strong');
    });
}

// ══════════════════════════════════════════════════════════════
//  CARS
// ══════════════════════════════════════════════════════════════
async function fetchCars(params = {}) {
    const query = new URLSearchParams(params).toString();
    try {
        const res = await fetch(`/api/cars${query ? '?' + query : ''}`);
        cars = await res.json();
        renderCars(cars);
    } catch (e) {
        carGrid.innerHTML = `<div class="no-results"><h3>Failed to load cars</h3><p>Please refresh the page.</p></div>`;
    }
}

function renderCars(carsToRender) {
    if (!carsToRender || carsToRender.length === 0) {
        carGrid.innerHTML = `<div class="no-results"><h3>No cars found</h3><p>Try adjusting your filters or search.</p></div>`;
        return;
    }

    carGrid.innerHTML = carsToRender.map(car => {
        const badges = [];
        if (car.recommended) badges.push(`<span class="badge badge-recommended">★ Recommended</span>`);
        if (car.powertrain === 'Electric') badges.push(`<span class="badge badge-electric">⚡ Electric</span>`);
        if (car.status === 'sold') badges.push(`<span class="badge badge-sold">Sold</span>`);
        if (isNew(car.created_at)) badges.push(`<span class="badge badge-new">New</span>`);

        return `
        <div class="car-card" id="car-${car.id}" onclick="openCarModal(${car.id})">
            <div class="car-badge">${badges.join('')}</div>
            <div class="car-image-wrapper">
                <img src="${escapeHtml(car.image)}" alt="${escapeHtml(car.make)} ${escapeHtml(car.model)}" class="car-image" onerror="this.src='https://via.placeholder.com/400x200/1a2035/4f8ef7?text=No+Image'">
            </div>
            <div class="car-info">
                <div class="car-name">${escapeHtml(car.make)} ${escapeHtml(car.model)}</div>
                <div class="car-year">${car.year || ''} ${escapeHtml(car.color || '')}</div>
                <div class="car-price">${escapeHtml(car.price)}</div>
                <div class="car-tags">
                    <span class="tag">${escapeHtml(car.type)}</span>
                    <span class="tag">${escapeHtml(car.powertrain)}</span>
                    ${car.category ? `<span class="tag">${escapeHtml(car.category)}</span>` : ''}
                </div>
                <div class="car-views">👁 ${car.views || 0} views</div>
            </div>
        </div>`;
    }).join('');
}

function isNew(dateStr) {
    if (!dateStr) return false;
    const created = new Date(dateStr);
    const now = new Date();
    return (now - created) < 7 * 24 * 60 * 60 * 1000; // within 7 days
}

// ── Open Car Detail Modal ───────────────────────────────────────
async function openCarModal(carId) {
    carModal.classList.add('active');
    document.getElementById('car-details-container').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;padding:4rem;"><div class="loading-spinner"></div></div>
    `;

    try {
        const res = await fetch(`/api/cars/${carId}`);
        const car = await res.json();
        if (!res.ok) throw new Error(car.error);
        selectedCar = car;
        renderCarModal(car);
    } catch (e) {
        document.getElementById('car-details-container').innerHTML = `<div class="no-results"><h3>Failed to load car details</h3></div>`;
    }
}

function renderCarModal(car) {
    const stats = car.ai_statistics;
    const container = document.getElementById('car-details-container');

    let statsHTML = '';
    if (stats) {
        const perf = stats.performance_score || 0;
        const comfort = stats.comfort_score || 0;
        const value = stats.value_score || 0;

        const prosList = (stats.pros || []).slice(0, 4).map(p => `<li>${escapeHtml(p)}</li>`).join('');
        const consList = (stats.cons || []).slice(0, 3).map(c => `<li>${escapeHtml(c)}</li>`).join('');

        const specItems = [
            stats['0_to_60'] ? { label: '0-60 mph', value: stats['0_to_60'] } : null,
            stats.horsepower ? { label: 'Horsepower', value: stats.horsepower } : null,
            stats.fuel_efficiency ? { label: 'Fuel Economy', value: stats.fuel_efficiency } : null,
            stats.depreciation ? { label: 'Depreciation', value: stats.depreciation } : null,
        ].filter(Boolean);

        statsHTML = `
        <div class="car-detail-stats">
            <h4>🤖 AI Analysis</h4>
            <div class="ai-stats-container">
                <div class="ai-stats-header">
                    <span>⚡</span> AutoAI Intelligence Report
                </div>
                <div class="score-bars">
                    <div class="score-row">
                        <span class="score-label">Performance</span>
                        <div class="score-bar-track"><div class="score-bar-fill" style="width:${perf}%"></div></div>
                        <span class="score-value">${perf}</span>
                    </div>
                    <div class="score-row">
                        <span class="score-label">Comfort</span>
                        <div class="score-bar-track"><div class="score-bar-fill" style="width:${comfort}%"></div></div>
                        <span class="score-value">${comfort}</span>
                    </div>
                    <div class="score-row">
                        <span class="score-label">Value</span>
                        <div class="score-bar-track"><div class="score-bar-fill" style="width:${value}%"></div></div>
                        <span class="score-value">${value}</span>
                    </div>
                </div>
                ${specItems.length > 0 ? `
                <div class="ai-specs-grid">
                    ${specItems.map(s => `
                    <div class="ai-spec-item">
                        <div class="ai-spec-label">${escapeHtml(s.label)}</div>
                        <div class="ai-spec-value">${escapeHtml(s.value)}</div>
                    </div>`).join('')}
                </div>` : ''}
                ${(prosList || consList) ? `
                <div class="pros-cons">
                    <div class="pros-col"><h5>Pros</h5><ul>${prosList}</ul></div>
                    <div class="cons-col"><h5>Cons</h5><ul>${consList}</ul></div>
                </div>` : ''}
                ${stats.ai_verdict ? `<div class="ai-verdict"><strong>🤖 Verdict:</strong> ${escapeHtml(stats.ai_verdict)}</div>` : ''}
            </div>
        </div>`;
    }

    container.innerHTML = `
        <img src="${escapeHtml(car.image)}" alt="${escapeHtml(car.make)} ${escapeHtml(car.model)}" class="car-detail-img" onerror="this.src='https://via.placeholder.com/640x280/1a2035/4f8ef7?text=No+Image'">
        <div class="car-detail-body">
            <div class="car-detail-header">
                <div>
                    <div class="car-detail-title">${escapeHtml(car.make)} ${escapeHtml(car.model)}</div>
                    <div class="car-detail-year">${car.year || ''} ${escapeHtml(car.color || '')} · ${escapeHtml(car.type)} · ${escapeHtml(car.powertrain)}</div>
                </div>
                <div class="car-detail-price">${escapeHtml(car.price)}</div>
            </div>
            <div class="car-detail-tags">
                <span class="tag">${escapeHtml(car.type)}</span>
                <span class="tag">${escapeHtml(car.powertrain)}</span>
                ${car.category ? `<span class="tag">${escapeHtml(car.category)}</span>` : ''}
                ${car.mileage ? `<span class="tag">🔢 ${escapeHtml(car.mileage)}</span>` : ''}
            </div>
            ${car.description ? `<div class="car-detail-description">${escapeHtml(car.description)}</div>` : ''}
            ${car.features && car.features.length > 0 ? `
            <div class="car-detail-features">
                <h4>Features</h4>
                <div class="features-grid">
                    ${car.features.map(f => `<span class="feature-chip">${escapeHtml(f)}</span>`).join('')}
                </div>
            </div>` : ''}
            ${statsHTML}
        </div>
    `;
}

// ── Buy Now ────────────────────────────────────────────────────
document.getElementById('buy-now-btn').addEventListener('click', () => {
    carModal.classList.remove('active');
    if (!currentUser) {
        openAuthModal('login');
        return;
    }
    openCheckoutModal();
});

function openCheckoutModal() {
    if (!selectedCar) return;
    document.getElementById('checkout-car-name').textContent = `${selectedCar.make} ${selectedCar.model}`;
    document.getElementById('checkout-car-price').textContent = selectedCar.price;
    document.getElementById('checkout-car-img').src = selectedCar.image;
    document.getElementById('checkout-car-img').alt = `${selectedCar.make} ${selectedCar.model}`;
    document.getElementById('checkout-msg').textContent = '';
    document.getElementById('checkout-msg').className = '';
    document.getElementById('confirm-purchase-btn').disabled = false;
    checkoutModal.classList.add('active');
}

document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('confirm-purchase-btn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const address = {
        street: document.getElementById('address-street').value,
        city: document.getElementById('address-city').value,
        zip: document.getElementById('address-zip').value
    };
    const payment_method = document.querySelector('input[name="payment"]:checked')?.value || 'card';

    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ carId: selectedCar.id, address, payment_method })
        });
        const data = await res.json();
        const msgEl = document.getElementById('checkout-msg');
        if (res.ok) {
            msgEl.textContent = '🎉 Purchase successful! Check your orders for details.';
            msgEl.className = 'success';
            showToast('Purchase confirmed!', 'success');
            setTimeout(() => {
                checkoutModal.classList.remove('active');
                document.getElementById('checkout-form').reset();
                selectedCar = null;
            }, 3000);
        } else {
            msgEl.textContent = data.error || 'Checkout failed.';
            msgEl.className = 'error';
            btn.disabled = false;
            btn.textContent = 'Confirm Purchase';
        }
    } catch {
        document.getElementById('checkout-msg').textContent = 'Network error. Please try again.';
        document.getElementById('checkout-msg').className = 'error';
        btn.disabled = false;
        btn.textContent = 'Confirm Purchase';
    }
});

// ── My Orders ──────────────────────────────────────────────────
async function openOrdersModal() {
    ordersModal.classList.add('active');
    const container = document.getElementById('orders-container');
    container.innerHTML = `<div class="loading-placeholder"><div class="loading-spinner"></div></div>`;

    try {
        const res = await fetch('/api/orders/my');
        if (!res.ok) throw new Error('Not logged in');
        const orders = await res.json();

        if (orders.length === 0) {
            container.innerHTML = `<div class="no-results"><h3>No orders yet</h3><p>Buy your first car to see it here!</p></div>`;
            return;
        }

        container.innerHTML = orders.map(order => `
            <div class="order-card">
                <img class="order-car-img" src="${escapeHtml(order.image)}" alt="${escapeHtml(order.make)} ${escapeHtml(order.model)}" onerror="this.src='https://via.placeholder.com/80x55/1a2035/4f8ef7?text=Car'">
                <div class="order-info">
                    <div class="order-car-name">${escapeHtml(order.make)} ${escapeHtml(order.model)}</div>
                    <div class="order-meta">Order #${order.id} · ${new Date(order.order_date).toLocaleDateString()}</div>
                </div>
                <div>
                    <div class="order-price">${escapeHtml(order.price)}</div>
                    <span class="order-status status-${order.status || 'pending'}">${order.status || 'pending'}</span>
                </div>
            </div>
        `).join('');
    } catch {
        container.innerHTML = `<div class="no-results"><h3>Failed to load orders</h3></div>`;
    }
}

// ══════════════════════════════════════════════════════════════
//  FILTERS
// ══════════════════════════════════════════════════════════════
function setupFilters() {
    document.getElementById('filter-btn').addEventListener('click', () => {
        const type = document.getElementById('filter-type').value;
        const powertrain = document.getElementById('filter-powertrain').value;
        const category = document.getElementById('filter-category').value;
        const params = {};
        if (type) params.type = type;
        if (powertrain) params.powertrain = powertrain;
        if (category) params.category = category;
        fetchCars(params);
    });

    document.getElementById('reset-filter-btn').addEventListener('click', () => {
        document.getElementById('filter-type').value = '';
        document.getElementById('filter-powertrain').value = '';
        document.getElementById('filter-category').value = '';
        fetchCars();
    });
}

// ══════════════════════════════════════════════════════════════
//  HERO SEARCH (AI-powered natural language)
// ══════════════════════════════════════════════════════════════
function setupHeroSearch() {
    document.getElementById('hero-search-btn').addEventListener('click', () => {
        const query = document.getElementById('hero-search-input').value.trim();
        if (!query) return;
        sendChatMessage(query);
        document.getElementById('chat-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('hero-search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('hero-search-btn').click();
    });
}

function sendQuickSearch(query) {
    sendChatMessage(query);
    document.getElementById('chat-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ══════════════════════════════════════════════════════════════
//  IMAGE SEARCH
// ══════════════════════════════════════════════════════════════
function setupImageSearch() {
    document.getElementById('img-search-trigger').addEventListener('click', () => {
        const bar = document.getElementById('image-search-bar');
        bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
    });

    document.getElementById('image-search-close').addEventListener('click', () => {
        document.getElementById('image-search-bar').style.display = 'none';
    });

    document.getElementById('image-search-go').addEventListener('click', async () => {
        const imageUrl = document.getElementById('image-search-url').value.trim();
        if (!imageUrl) { showToast('Please enter an image URL', 'error'); return; }

        const btn = document.getElementById('image-search-go');
        btn.textContent = '🔄 Searching...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/ai/image-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Search failed');

            // Highlight matched cars
            clearHighlights();
            const banner = document.getElementById('ai-suggestion-banner');
            const bannerText = document.getElementById('ai-banner-text');

            if (data.matchedIds && data.matchedIds.length > 0) {
                data.matchedIds.forEach(id => {
                    const card = document.getElementById(`car-${id}`);
                    if (card) { card.classList.add('highlight'); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                });
                bannerText.innerHTML = `<strong>🔍 Detected:</strong> ${data.detected || 'Similar car'} — ${data.explanation || 'Found similar cars in our inventory!'}`;
                banner.style.display = 'flex';
            } else {
                bannerText.innerHTML = `<strong>🔍 Image Search:</strong> I detected "${data.detected || 'a car'}" but couldn't find a close match in our current inventory.`;
                banner.style.display = 'flex';
            }
        } catch (e) {
            showToast(e.message || 'Image search failed', 'error');
        } finally {
            btn.textContent = '🔍 Find Similar';
            btn.disabled = false;
        }
    });
}

function clearHighlights() {
    document.querySelectorAll('.car-card.highlight').forEach(c => c.classList.remove('highlight'));
}

function closeAIBanner() {
    document.getElementById('ai-suggestion-banner').style.display = 'none';
    clearHighlights();
}

// ══════════════════════════════════════════════════════════════
//  AGENTIC CHAT
// ══════════════════════════════════════════════════════════════
function appendMessage(content, isUser = false, carData = null) {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${isUser ? 'user-message' : 'ai-message'}`;

    // Format text (bold, line breaks)
    const formatted = String(content)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

    wrapper.innerHTML = `<div class="msg-content">${formatted}</div>`;

    // If AI suggests a car, show a mini card inside chat
    if (!isUser && carData) {
        const car = cars.find(c => c.id === carData.carId);
        if (car) {
            const chatCard = document.createElement('div');
            chatCard.className = 'chat-car-card';
            chatCard.innerHTML = `
                <img src="${escapeHtml(car.image)}" alt="${escapeHtml(car.make)} ${escapeHtml(car.model)}" onerror="this.src='https://via.placeholder.com/280x120/1a2035/4f8ef7?text=Car'">
                <div class="chat-car-info">
                    <div class="chat-car-name">${escapeHtml(car.make)} ${escapeHtml(car.model)}</div>
                    <div class="chat-car-price">${escapeHtml(car.price)}</div>
                </div>
            `;
            chatCard.addEventListener('click', () => openCarModal(car.id));
            wrapper.appendChild(chatCard);
        }
    }

    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return wrapper;
}

function showTypingIndicator() {
    const ind = document.createElement('div');
    ind.className = 'typing-indicator';
    ind.id = 'typing-indicator';
    ind.innerHTML = '<span></span><span></span><span></span>';
    chatMessages.appendChild(ind);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const ind = document.getElementById('typing-indicator');
    if (ind) ind.remove();
}

async function sendChatMessage(message) {
    if (!message || isTyping) return;
    isTyping = true;

    appendMessage(message, true);
    userInput.value = '';
    userInput.disabled = true;
    sendBtn.disabled = true;
    showTypingIndicator();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, history: chatHistory })
        });
        const data = await res.json();
        hideTypingIndicator();

        if (!res.ok) {
            appendMessage(`⚠️ ${data.error || 'AI service unavailable'}`, false);
        } else {
            const aiText = data.text || 'I could not generate a response.';

            // Save to local history for context
            chatHistory.push({ role: 'user', parts: [{ text: message }] });
            chatHistory.push({ role: 'model', parts: [{ text: aiText }] });
            // Keep history trimmed
            if (chatHistory.length > 20) chatHistory = chatHistory.slice(chatHistory.length - 20);

            // Handle AI actions
            let carDataForBubble = null;
            clearHighlights();

            if (data.action === 'SHOW_CAR' && data.data?.carId) {
                carDataForBubble = { carId: data.data.carId };
                const card = document.getElementById(`car-${data.data.carId}`);
                if (card) {
                    card.classList.add('highlight');
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else if (data.action === 'OPEN_CHECKOUT' && data.data?.carId) {
                const car = cars.find(c => c.id === data.data.carId);
                if (car) {
                    selectedCar = car;
                    carDataForBubble = { carId: data.data.carId };
                    setTimeout(() => {
                        if (currentUser) openCheckoutModal();
                        else openAuthModal('login');
                    }, 800);
                }
            } else if (data.action === 'FILTER_CARS' && data.data) {
                const params = {};
                if (data.data.type) { params.type = data.data.type; document.getElementById('filter-type').value = data.data.type; }
                if (data.data.category) { params.category = data.data.category; document.getElementById('filter-category').value = data.data.category; }
                if (data.data.powertrain) { params.powertrain = data.data.powertrain; document.getElementById('filter-powertrain').value = data.data.powertrain; }
                fetchCars(params);
            } else if (data.action === 'COMPARE_CARS' && data.data?.carIds) {
                data.data.carIds.forEach(id => {
                    const card = document.getElementById(`car-${id}`);
                    if (card) card.classList.add('highlight');
                });
                const firstCard = document.getElementById(`car-${data.data.carIds[0]}`);
                if (firstCard) firstCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                // Highlight any mentioned cars by name
                cars.forEach(car => {
                    const fullName = `${car.make} ${car.model}`.toLowerCase();
                    if (aiText.toLowerCase().includes(fullName)) {
                        const card = document.getElementById(`car-${car.id}`);
                        if (card) {
                            card.classList.add('highlight');
                            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                });
            }

            appendMessage(aiText, false, carDataForBubble);
        }
    } catch (e) {
        hideTypingIndicator();
        appendMessage('⚠️ Connection error. Please check your internet and try again.', false);
    }

    isTyping = false;
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (message) sendChatMessage(message);
});

document.getElementById('clear-chat-btn').addEventListener('click', () => {
    chatMessages.innerHTML = `
        <div class="message ai-message">
            <div class="msg-content">Hi! I'm your AI AutoAdvisor 🚗<br>Tell me what you're looking for and I'll find your perfect match!</div>
        </div>`;
    chatHistory = [];
    clearHighlights();
});

// ══════════════════════════════════════════════════════════════
//  EVENT LISTENERS (Modals, Nav)
// ══════════════════════════════════════════════════════════════
function setupEventListeners() {
    // Close modals
    document.getElementById('close-auth').addEventListener('click', closeAuthModal);
    document.getElementById('close-car').addEventListener('click', () => carModal.classList.remove('active'));
    document.getElementById('close-checkout').addEventListener('click', () => checkoutModal.classList.remove('active'));
    document.getElementById('close-orders').addEventListener('click', () => ordersModal.classList.remove('active'));

    // Close on backdrop click
    [authModal, carModal, checkoutModal, ordersModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    // My orders nav link
    document.getElementById('my-orders-nav').addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) openOrdersModal();
        else openAuthModal('login');
    });

    // Keyboard close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            [authModal, carModal, checkoutModal, ordersModal].forEach(m => m.classList.remove('active'));
        }
    });
}

// ══════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════════════════
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#4f8ef7'};
        color: white; padding: 0.85rem 1.5rem; border-radius: 12px;
        font-family: Outfit, sans-serif; font-weight: 600; font-size: 0.95rem;
        box-shadow: 0 8px 25px rgba(0,0,0,0.4);
        animation: fadeIn 0.3s ease;
        max-width: 350px;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; setTimeout(() => toast.remove(), 400); }, 3500);
}

// ══════════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════════
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ── Start ──────────────────────────────────────────────────────
init();
