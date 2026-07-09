const API_KEY = "YOUR_API_KEY_HERE";

// State
let cars = [];
let currentUser = null;
let selectedCar = null;

// DOM Elements
const carGrid = document.getElementById('car-grid');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

const authSection = document.getElementById('auth-section');

// Modal Elements
const loginModal = document.getElementById('login-modal');
const carModal = document.getElementById('car-modal');
const checkoutModal = document.getElementById('checkout-modal');

const closeLogin = document.getElementById('close-login');
const closeCar = document.getElementById('close-car');
const closeCheckout = document.getElementById('close-checkout');

const loginBtn = document.getElementById('login-btn');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

const carDetailsContainer = document.getElementById('car-details-container');
const buyNowBtn = document.getElementById('buy-now-btn');

const checkoutCarName = document.getElementById('checkout-car-name');
const checkoutCarPrice = document.getElementById('checkout-car-price');
const confirmPurchaseBtn = document.getElementById('confirm-purchase-btn');
const checkoutMsg = document.getElementById('checkout-msg');

// --- Initialization ---
async function init() {
    await checkAuthStatus();
    await fetchCars();
    setupEventListeners();
}

// --- Auth Functions ---
async function checkAuthStatus() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            currentUser = data;
            renderAuthUI();
        } else {
            currentUser = null;
            renderAuthUI();
        }
    } catch (e) {
        console.error('Error checking auth', e);
    }
}

function renderAuthUI() {
    if (currentUser) {
        authSection.innerHTML = `
            <span class="user-greeting">Hello, ${currentUser.username}</span>
            <button id="logout-btn" class="btn">Logout</button>
        `;
        document.getElementById('logout-btn').addEventListener('click', handleLogout);
    } else {
        authSection.innerHTML = `<button id="login-btn" class="btn">Login</button>`;
        document.getElementById('login-btn').addEventListener('click', () => {
            loginModal.style.display = 'block';
        });
    }
}

async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    renderAuthUI();
}

// --- Fetch Cars ---
async function fetchCars() {
    try {
        const res = await fetch('/api/cars');
        cars = await res.json();
        renderCars();
        initChatSystemPrompt();
    } catch (e) {
        console.error('Error fetching cars', e);
    }
}

// Render Cars
function renderCars() {
    carGrid.innerHTML = '';
    cars.forEach(car => {
        const card = document.createElement('div');
        card.className = 'car-card';
        card.id = `car-${car.id}`;
        card.innerHTML = `
            <img src="${car.image}" alt="${car.make} ${car.model}" class="car-image">
            <div class="car-info">
                <div class="car-name">${car.make} ${car.model}</div>
                <div class="car-price">${car.price}</div>
                <div class="car-tags">
                    <span class="tag">${car.type}</span>
                    <span class="tag">${car.powertrain}</span>
                </div>
            </div>
        `;
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => openCarModal(car));
        carGrid.appendChild(card);
    });
}

function openCarModal(car) {
    selectedCar = car;
    carDetailsContainer.innerHTML = `
        <img src="${car.image}" alt="${car.make}" class="car-details-img">
        <h2 class="car-details-title">${car.make} ${car.model}</h2>
        <div class="car-details-price">${car.price}</div>
        <p><strong>Type:</strong> ${car.type}</p>
        <p><strong>Powertrain:</strong> ${car.powertrain}</p>
        <br>
        <p><strong>Features:</strong></p>
        <ul class="car-details-features">
            ${car.features.map(f => `<li>${f}</li>`).join('')}
        </ul>
    `;
    carModal.style.display = 'block';
}

// --- Checkout Functions ---
buyNowBtn.addEventListener('click', () => {
    carModal.style.display = 'none';
    if (!currentUser) {
        loginModal.style.display = 'block';
        loginError.textContent = 'Please log in to purchase a car.';
        return;
    }
    openCheckoutModal();
});

function openCheckoutModal() {
    if (!selectedCar) return;
    checkoutCarName.textContent = `${selectedCar.make} ${selectedCar.model}`;
    checkoutCarPrice.textContent = `Total: ${selectedCar.price}`;
    checkoutMsg.textContent = '';
    confirmPurchaseBtn.disabled = false;
    checkoutModal.style.display = 'block';
}

const checkoutForm = document.getElementById('checkout-form');

checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    confirmPurchaseBtn.disabled = true;
    
    const address = {
        street: document.getElementById('address-street').value,
        city: document.getElementById('address-city').value,
        zip: document.getElementById('address-zip').value
    };

    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                carId: selectedCar.id,
                address: address
            })
        });
        const data = await res.json();
        
        if (res.ok) {
            checkoutMsg.style.color = '#10b981';
            checkoutMsg.textContent = 'Purchase successful! Thank you for your business.';
            setTimeout(() => {
                checkoutModal.style.display = 'none';
                checkoutForm.reset();
            }, 3000);
        } else {
            checkoutMsg.style.color = '#ef4444';
            checkoutMsg.textContent = data.error || 'Checkout failed.';
            confirmPurchaseBtn.disabled = false;
        }
    } catch (e) {
        checkoutMsg.style.color = '#ef4444';
        checkoutMsg.textContent = 'Network error during checkout.';
        confirmPurchaseBtn.disabled = false;
    }
});

// --- Event Listeners for Modals ---
function setupEventListeners() {
    closeLogin.onclick = () => loginModal.style.display = "none";
    closeCar.onclick = () => carModal.style.display = "none";
    closeCheckout.onclick = () => checkoutModal.style.display = "none";

    window.onclick = (event) => {
        if (event.target == loginModal) loginModal.style.display = "none";
        if (event.target == carModal) carModal.style.display = "none";
        if (event.target == checkoutModal) checkoutModal.style.display = "none";
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
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
                loginModal.style.display = 'none';
                loginForm.reset();
                loginError.textContent = '';
                
                // If they were trying to buy a car
                if (selectedCar) {
                    openCheckoutModal();
                }
            } else {
                loginError.textContent = data.error || 'Login failed';
            }
        } catch (err) {
            loginError.textContent = 'Network error';
        }
    });
}

// --- AI Chatbot ---
let chatHistory = [];

function initChatSystemPrompt() {
    const systemPrompt = `You are AutoAdvisor, a friendly, expert car salesman.
Your goal is to help the user find the perfect car from our specific inventory.
Here is the JSON list of our available cars:
${JSON.stringify(cars)}

Rules:
1. ONLY recommend cars from the provided list.
2. If you recommend a specific car, mention its exact Make and Model so the user knows.
3. Keep your answers relatively short, friendly, and to the point.
4. Ask clarifying questions if the user's request is too broad.
5. Provide the car's price when recommending it.`;

    chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I am ready to help the user find a car from the inventory." }] }
    ];
}

// Append Message to UI
function appendMessage(text, isUser) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    msgDiv.innerHTML = formattedText;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (!isUser) {
        highlightMentionedCars(text);
    }
}

// Highlight Car in Gallery
function highlightMentionedCars(text) {
    document.querySelectorAll('.car-card').forEach(card => card.classList.remove('highlight'));
    cars.forEach(car => {
        if (text.toLowerCase().includes(car.model.toLowerCase()) || text.toLowerCase().includes(car.make.toLowerCase() + " " + car.model.toLowerCase())) {
            const card = document.getElementById(`car-${car.id}`);
            if (card) {
                card.classList.add('highlight');
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });
}

function toggleTypingIndicator(show) {
    if (show) {
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.id = 'typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        chatMessages.appendChild(indicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } else {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    }
}

// Call Gemini API
async function callGeminiAPI(message) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
    chatHistory.push({ role: "user", parts: [{ text: message }] });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: chatHistory })
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error("API Error:", data.error);
            chatHistory.pop();
            return "Sorry, I'm having trouble connecting to my brain right now. Please try again later.";
        }
        
        const aiResponseText = data.candidates[0].content.parts[0].text;
        chatHistory.push({ role: "model", parts: [{ text: aiResponseText }] });
        
        return aiResponseText;
    } catch (error) {
        console.error("Fetch Error:", error);
        chatHistory.pop();
        return "I seem to have lost my connection. Please check your internet.";
    }
}

// Handle Chat Form Submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message) return;
    
    userInput.value = '';
    appendMessage(message, true);
    
    userInput.disabled = true;
    sendBtn.disabled = true;
    toggleTypingIndicator(true);
    
    const responseText = await callGeminiAPI(message);
    
    toggleTypingIndicator(false);
    appendMessage(responseText, false);
    
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
});

// Start the app
init();
