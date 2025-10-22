// Отключение автосмены изображений на главной
const NGT_DISABLE_CARD_AUTOPLAY = true;

// --- polyfill: structuredClone (на случай старых браузеров)
if (typeof structuredClone !== 'function') {
  window.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// ---- runtime styles to scale images on cards & in modal (no CSS/HTML edits) ----
(function ensureRuntimeStyles() {
  const ID = 'ngt-runtime-styles';
  if (document.getElementById(ID)) return;
  const css = `
    /* Карточка товара (главная): картинка всегда вписывается по ширине карточки */
    .card-img{
      display:block;
      width:100%;
      max-width:100%;
      height:auto;
      max-height:360px;
      object-fit:contain;
      image-rendering:auto;
    }
    /* Модалка: картинка вписывается в окно, не вылезает за край */
    #modal .modal-image{
      display:block;
      max-width:100%;
      max-height:80vh;
      width:auto;
      height:auto;
      object-fit:contain;
      margin:0 auto;
    }
  `.trim();
  const style = document.createElement('style');
  style.id = ID;
  style.textContent = css;
  document.head.appendChild(style);
})();
// —— runtime styles (без правок HTML/CSS файлов)
(function ensureRuntimeStylesAvailability(){
  const ID = 'ngt-runtime-styles-availability-overlay';
  if (document.getElementById(ID)) return;
  const css = `
    .stock-badge { display: none !important; }
    [data-item-id].soldout {
      position: relative;
      filter: grayscale(1) brightness(.8);
    }
    [data-item-id].soldout::after {
      content: "Нет в наличии";
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      letter-spacing: .03em;
      color: #fff;
      background: rgba(0,0,0,.45);
      text-transform: none;
      pointer-events: none;
    }
    .modal-image-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #modal .modal-slide-btn{
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 999px;
      background: rgba(0,0,0,.55);
      color: #fff;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      display: grid;
      place-items: center;
      z-index: 5;
      transition: opacity .2s ease;
    }
    #modal .modal-slide-btn:hover{ background: rgba(0,0,0,.7); }
    #modal .modal-slide-btn.prev{ left: 8px; }
    #modal .modal-slide-btn.next{ right: 8px; }
    body.inventory-busy {
      cursor: progress;
    }
    #inventory-spinner {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,.25);
      backdrop-filter: blur(2px);
      pointer-events: none;
      opacity: 0;
      transition: opacity .2s ease;
      z-index: 9999;
    }
    body.inventory-busy #inventory-spinner {
      opacity: 1;
      pointer-events: auto;
    }
    #inventory-spinner .box {
      padding: 18px 26px;
      border-radius: 12px;
      background: rgba(0,0,0,.6);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,.35);
    }
    #inventory-spinner .spinner {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 3px solid rgba(255,255,255,.35);
      border-top-color: #fff;
      animation: ngt-spin 1s linear infinite;
    }
    #inventory-spinner .label {
      color: #fff;
      font-size: 14px;
      line-height: 1.4;
      text-align: center;
    }
    @keyframes ngt-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `.trim();
  const style = document.createElement('style');
  style.id = ID;
  style.textContent = css;
  document.head.appendChild(style);
})();
const PRODUCT_MANIFEST = [
  {
    id: 'id1',
    title: 'NEW GRGY TIMES test',
    description: 'NEW GRGY TIMES test',
    price: '1000',
    stock: 5,
    images: ['./items/id1/id1-1.png', './items/id1/id1-2.png'],
  },
  {
    id: 'id2',
    title: 'NEW GRGY TIMES test',
    description: 'NEW GRGY TIMES test',
    price: '2000',
    stock: 5,
    images: ['./items/id2/id2-1.png', './items/id2/id2-2.png', './items/id2/id2-3.png'],
  },
  {
    id: 'id3',
    title: 'NEW GRGY TIMES test',
    description: 'NEW GRGY TIMES test',
    price: '3000',
    stock: 5,
    images: ['./items/id3/id3-1.png', './items/id3/id3-2.png'],
  },
];

const ALLOWED_IDS = new Set(PRODUCT_MANIFEST.map((item) => String(item.id)));
const DEFAULT_IMAGE = './0.png';
const WEB3FORMS_ACCESS_KEY = '97052283-3d2d-46b2-86ca-c21f81998914';
const CART_STORAGE_KEY = 'cart';
const INVENTORY_CACHE_KEY = 'inventory_cache_v1';
const ORDER_TELEGRAM_URL = 'https://t.me/grgyone';

const JSONBIN = {
  BIN_ID: '68f60e4ad0ea881f40ae1bd9',
  MASTER_KEY: '$2a$10$cO3HgbohdzMjWRNpU2vriO.jAwVEE6AuOFo0MLls68F1Csom8kPRm',
  ACCESS_KEY: 'ngt-site $2a$10$vI7KP04ItbCcX3XuPAVYb.2kocL9s21o4etSt8KBfy343z86FhOwG',
  BASE: 'https://api.jsonbin.io/v3/b',
};

let inventoryState = {};
let inventoryActivityCounter = 0;
let inventoryReady = false;

function ensureInventorySpinner() {
  if (document.getElementById('inventory-spinner')) {
    return;
  }
  const wrapper = document.createElement('div');
  wrapper.id = 'inventory-spinner';
  const box = document.createElement('div');
  box.className = 'box';
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = 'Обновляем наличие…';
  box.appendChild(spinner);
  box.appendChild(label);
  wrapper.appendChild(box);
  document.body?.appendChild(wrapper);
}

function updateInventoryLoading(message) {
  const body = document.body;
  if (!body) {
    return;
  }
  ensureInventorySpinner();
  const spinner = document.getElementById('inventory-spinner');
  const label = spinner?.querySelector('.label');
  if (label && typeof message === 'string' && message.trim().length) {
    label.textContent = message.trim();
  }
  if (inventoryActivityCounter > 0) {
    body.classList.add('inventory-busy');
  } else {
    body.classList.remove('inventory-busy');
  }
}

function pushInventoryActivity(message) {
  inventoryActivityCounter += 1;
  updateInventoryLoading(message);
}

function popInventoryActivity() {
  inventoryActivityCounter = Math.max(0, inventoryActivityCounter - 1);
  updateInventoryLoading();
}

function readInventoryCache() {
  try {
    const raw = sessionStorage.getItem(INVENTORY_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeInventoryCache(data) {
  try {
    sessionStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(data ?? {}));
  } catch {
    // ignore quota errors
  }
}

function clearInventoryCache() {
  try {
    sessionStorage.removeItem(INVENTORY_CACHE_KEY);
  } catch {
    // ignore
  }
}

function normalizeInventoryData(raw, referenceList) {
  const safeRaw = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const normalized = {};
  Object.keys(safeRaw).forEach((key) => {
    const entry = safeRaw[key];
    if (entry && typeof entry === 'object') {
      const clone = structuredClone(entry);
      const stockValue = Number(clone.stock);
      clone.stock = Number.isFinite(stockValue) ? Math.max(0, stockValue) : 0;
      normalized[key] = clone;
    } else {
      const stockValue = Number(entry);
      normalized[key] = { stock: Number.isFinite(stockValue) ? Math.max(0, stockValue) : 0 };
    }
  });

  (Array.isArray(referenceList) ? referenceList : []).forEach((product) => {
    if (!product || typeof product.id === 'undefined') {
      return;
    }
    const id = String(product.id);
    const fallbackStock = Math.max(0, Number(product.stock) || 0);
    if (!normalized[id]) {
      normalized[id] = { stock: fallbackStock };
    } else if (!Number.isFinite(Number(normalized[id].stock))) {
      normalized[id].stock = fallbackStock;
    }
    if (normalized[id].price == null && Number.isFinite(Number(product.price))) {
      normalized[id].price = Number(product.price);
    }
  });

  return normalized;
}

function setInventoryState(nextState, options = {}) {
  const snapshot = nextState && typeof nextState === 'object' ? nextState : {};
  inventoryState = {};
  Object.keys(snapshot).forEach((key) => {
    const value = snapshot[key];
    if (value && typeof value === 'object') {
      inventoryState[key] = structuredClone(value);
    } else {
      const stockValue = Number(value);
      inventoryState[key] = { stock: Number.isFinite(stockValue) ? Math.max(0, stockValue) : 0 };
    }
  });

  if (options.cache) {
    writeInventoryCache(inventoryState);
  }

  applyInventoryToProducts(inventoryState);
}

async function fetchInventory(options = {}) {
  pushInventoryActivity(options.message ?? 'Обновляем наличие…');
  try {
    const response = await fetch(`${JSONBIN.BASE}/${JSONBIN.BIN_ID}/latest`, {
      method: 'GET',
      headers: {
        'X-Master-Key': JSONBIN.MASTER_KEY,
        'X-Access-Key': JSONBIN.ACCESS_KEY,
        'X-Bin-Meta': 'false',
      },
      signal: options.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text ? `Fetch inventory failed: ${response.status} ${text}` : `Fetch inventory failed: ${response.status}`);
    }
    const payload = await response.json();
    const data = payload?.record ?? payload;
    const normalized = normalizeInventoryData(data, products?.length ? products : PRODUCT_MANIFEST);
    setInventoryState(normalized, { cache: true });
    inventoryReady = true;
    return structuredClone(inventoryState);
  } finally {
    popInventoryActivity();
  }
}

async function saveInventory(data, options = {}) {
  pushInventoryActivity(options.message ?? 'Сохраняем наличие…');
  try {
    const response = await fetch(`${JSONBIN.BASE}/${JSONBIN.BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN.MASTER_KEY,
        'X-Access-Key': JSONBIN.ACCESS_KEY,
      },
      body: JSON.stringify(data),
      signal: options.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text ? `Save inventory failed: ${response.status} ${text}` : `Save inventory failed: ${response.status}`);
    }
    const payload = await response.json();
    const result = payload?.record ?? payload;
    const normalized = normalizeInventoryData(result, products);
    setInventoryState(normalized, { cache: true });
    inventoryReady = true;
    return structuredClone(inventoryState);
  } finally {
    popInventoryActivity();
  }
}


function createStockError(message) {
  const error = new Error(message);
  error.code = 'OUT_OF_STOCK';
  return error;
}

async function decrementInventoryOrFail(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    const snapshot = getInventorySnapshot();
    return { next: snapshot, previous: snapshot };
  }

  const runAttempt = async () => {
    const remote = await fetchInventory({ message: 'Checking stock...' });
    const current = structuredClone(remote);

    cartItems.forEach((item) => {
      const id = String(item.id);
      if (!current[id]) {
        const product = products.find((p) => p.id === id);
        const fallbackStock = Math.max(0, Number(product?.stock) || 0);
        current[id] = { stock: fallbackStock };
        if (product && Number.isFinite(Number(product.price))) {
          current[id].price = Number(product.price);
        }
      }
      const available = Math.max(0, Number(current[id].stock) || 0);
      if (item.qty > available) {
        setInventoryState(current, { cache: true });
        const title = item.title || products.find((p) => p.id === id)?.title || id;
        throw createStockError('Not enough stock for: ' + title);
      }
    });

    setInventoryState(current, { cache: true });
    const base = structuredClone(current);
    const next = structuredClone(current);
    cartItems.forEach((item) => {
      const id = String(item.id);
      const record = next[id] || (next[id] = { stock: 0 });
      const available = Math.max(0, Number(record.stock) || 0);
      record.stock = Math.max(0, available - item.qty);
    });

    await saveInventory(next, { message: 'Updating stock...' });
    const latest = structuredClone(inventoryState);
    return { next: latest, previous: base };
  };

  try {
    return await runAttempt();
  } catch (error) {
    if (error?.code === 'OUT_OF_STOCK') {
      throw error;
    }
    return runAttempt();
  }
}
async function restoreInventoryQuantities(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return;
  }
  try {
    const remote = await fetchInventory({ message: 'Возвращаем остатки…' });
    const next = structuredClone(remote);
    cartItems.forEach((item) => {
      const id = String(item.id);
      const record = next[id] || (next[id] = { stock: 0 });
      const current = Math.max(0, Number(record.stock) || 0);
      const qty = Math.max(0, Number(item.qty) || 0);
      record.stock = current + qty;
    });
    await saveInventory(next, { message: 'Сохраняем наличие…' });
  } catch (error) {
    console.error('[inventory] rollback failed:', error);
  }
}
function getInventoryRecord(productId) {
  if (!productId) {
    return null;
  }
  const record = inventoryState[String(productId)];
  if (record && typeof record === 'object') {
    return record;
  }
  return null;
}

function applyInventoryToProducts(inventory) {
  if (!Array.isArray(products)) {
    return;
  }
  products.forEach((product) => {
    if (!product || !product.id) {
      return;
    }
    const id = String(product.id);
    const record = inventory?.[id];
    if (record && typeof record === 'object') {
      if (Number.isFinite(Number(record.stock))) {
        product.stock = Math.max(0, Number(record.stock));
      }
      if (record.price != null && Number.isFinite(Number(record.price))) {
        product.price = Number(record.price);
      }
    }
  });
  mirrorProducts();
  applyInventoryToCards(inventoryState);
}

function mirrorProducts() {
  if (!Array.isArray(products)) {
    window.products = [];
    return;
  }
  window.products = products.map((item) => ({ ...item }));
}
const CART_TRANSITION_MS = 200;

let products = [];

const grid = document.getElementById('grid');
const cartPopup = document.getElementById('cart-popup');
const cartTrigger = document.querySelector('.cart-icon');
const cartCountElement = document.getElementById('cart-count');
const modal = document.getElementById('modal');
const modalImage = modal?.querySelector('.modal-image') ?? null;
const modalTitle = modal?.querySelector('.modal-title') ?? null;
const modalDescription = modal?.querySelector('.modal-description') ?? null;
const modalPrice = modal?.querySelector('.modal-price') ?? null;
const modalQtyRow = modal?.querySelector('.qty-row') ?? null;
const modalQtyInput = modal?.querySelector('.qty-input') ?? null;
const modalAddButton = modal?.querySelector('.modal-add') ?? null;
const modalCloseButton = modal?.querySelector('.modal-close') ?? null;

if (modalImage) {
  modalImage.loading = 'lazy';
  modalImage.decoding = 'async';
  modalImage.style.maxWidth = '100%';
  modalImage.style.maxHeight = '80vh';
  modalImage.style.width = 'auto';
  modalImage.style.height = 'auto';
  modalImage.style.objectFit = 'contain';
  modalImage.style.display = 'block';
  modalImage.style.margin = '0 auto';
}

const defaultFormState = {
  name: '',
  email: '',
  telegram: '',
  comment: '',
  consent: false,
};

let cart = loadCart();
let cartFormState = { ...defaultFormState };
let activeProduct = null;
let cartHideTimeout = null;
let modalEscHandler = null;

document.addEventListener('DOMContentLoaded', init);

cartTrigger?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleCartPopup();
});

cartPopup?.addEventListener('click', (event) => {
  event.stopPropagation();
  handleCartPopupClick(event);
});

cartPopup?.addEventListener('change', (event) => {
  event.stopPropagation();
  handleCartPopupChange(event);
});

document.addEventListener('click', (event) => {
  if (!cartPopup || cartPopup.classList.contains('hidden')) {
    return;
  }
  const clickedInside = cartPopup.contains(event.target);
  const clickedTrigger = cartTrigger?.contains(event.target);
  if (!clickedInside && !clickedTrigger) {
    hideCartPopup();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!modal?.classList.contains('hidden')) {
      closeModal();
    } else if (isCartPopupVisible()) {
      hideCartPopup();
    }
  }
});

modalCloseButton?.addEventListener('click', (event) => {
  event.preventDefault();
  closeModal();
});

modal?.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeModal();
  }
});
async function init() {
  try {
    await loadCatalog();
    await prepareInventory();
    renderGrid(products);
    console.log('[init] grid rendered', products.length, 'items');
  } catch (error) {
    console.error('[init] initialization error:', error);
    showToast('Не получилось загрузить витрину.');
    renderGrid([]);
  }

  syncCartWithInventory();
  updateCartCount();
  renderCart();
}

async function prepareInventory() {
  const defaults = normalizeInventoryData({}, products);
  setInventoryState(defaults, { cache: false });
  try {
    await fetchInventory();
  } catch (error) {
    console.error('[inventory] fetch failed:', error);
    const cached = readInventoryCache();
    if (cached) {
      const snapshot = normalizeInventoryData(cached, products);
      setInventoryState(snapshot, { cache: false });
      showToast('Нет связи с сервером. Показаны сохранённые остатки.');
    } else {
      showToast('Ошибка соединения. Попробуйте ещё раз.');
    }
  }
}

async function loadCatalog() {
  const url = new URL('./items/index.json', document.baseURI).href;
  let loadedItems = [];

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`catalog fetch failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (data && Array.isArray(data.items)) {
      loadedItems = data.items;
    }
  } catch (error) {
    console.warn('[catalog] falling back to manifest:', error);
    loadedItems = PRODUCT_MANIFEST.map((item) => structuredClone(item));
  }

  products = loadedItems.map(normalizeProduct).filter((item) => item !== null);
  mirrorProducts();

  // --- Нормализация товаров: оставить только id1/id2/id3 и удалить все UNT-***
  (function normalizeProducts() {
    const MANIFEST = [
      {
        id: 'id1',
        title: 'NEW GRGY TIMES test',
        description: 'NEW GRGY TIMES test',
        price: '1000',
        stock: 5,
        images: ['./items/id1/id1-1.png', './items/id1/id1-2.png'],
      },
      {
        id: 'id2',
        title: 'NEW GRGY TIMES test',
        description: 'NEW GRGY TIMES test',
        price: '2000',
        stock: 5,
        images: ['./items/id2/id2-1.png', './items/id2/id2-2.png', './items/id2/id2-3.png'],
      },
      {
        id: 'id3',
        title: 'NEW GRGY TIMES test',
        description: 'NEW GRGY TIMES test',
        price: '3000',
        stock: 5,
        images: ['./items/id3/id3-1.png', './items/id3/id3-2.png'],
      },
    ];

    const ALLOWED = new Set(MANIFEST.map((p) => String(p.id)));
    const isUNT = (t) => typeof t === 'string' && /Артикул:\s*UNT-\d+/i.test(t);

    if (!Array.isArray(window.products)) {
      window.products = MANIFEST.slice();
      return;
    }

    window.products = window.products.filter((p) => {
      if (!p) return false;
      const id = String(p.id || '');
      const title = p.title || '';
      if (isUNT(title)) return false;
      return ALLOWED.has(id);
    });

    const have = new Set(window.products.map((p) => String(p.id)));
    MANIFEST.forEach((p) => {
      if (!have.has(String(p.id))) {
        window.products.push(p);
      }
    });
  })();

  products = window.products.map(normalizeProduct).filter((item) => item !== null);
  mirrorProducts();
}

function normalizeProduct(raw) {
  if (!raw || raw.id == null) {
    return null;
  }

  const id = String(raw.id).trim();
  if (!id) {
    return null;
  }

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (title && /Артикул:\s*UNT-\d+/i.test(title)) {
    return null;
  }

  const images = Array.isArray(raw.images)
    ? raw.images
        .filter((src) => typeof src === 'string' && src.trim().length > 0)
        .map((src) => src.trim())
    : [];

  const price = Number.parseFloat(raw.price ?? raw.cost ?? 0) || 0;
  const stock = Number.isFinite(Number(raw.stock)) ? Math.max(0, Number(raw.stock)) : 0;

  return {
    id,
    title,
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    sku: typeof raw.sku === 'string' ? raw.sku.trim() : '',
    price,
    stock,
    images,
    image: typeof raw.image === 'string' ? raw.image.trim() : '',
  };
}

function getInventorySnapshot() {
  return structuredClone(inventoryState);
}

function getStock(pid) {
  if (!pid) {
    return 0;
  }
  const record = getInventoryRecord(pid);
  if (record && Number.isFinite(Number(record.stock))) {
    return Math.max(0, Number(record.stock));
  }
  const product = products.find((item) => item.id === pid);
  if (product) {
    return Math.max(0, Number(product.stock) || 0);
  }
  return 0;
}

function getRemainingForAdd(pid) {
  const inStock = getStock(pid);
  const inCart = cart.find((item) => item.id === pid)?.qty || 0;
  return Math.max(0, inStock - inCart);
}

function loadCart() {
  try {
    const data = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map((item) => ({
        id: String(item.id),
        title: typeof item.title === 'string' ? item.title : '',
        price: Number(item.price) || 0,
        image: typeof item.image === 'string' ? item.image : DEFAULT_IMAGE,
        qty: Math.max(0, Number(item.qty) || 0),
      }))
      .filter((item) => item.id && item.qty > 0);
  } catch (error) {
    console.warn('[cart] failed to load:', error);
    return [];
  }
}

function saveCart(currentCart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(currentCart));
}

function syncCartWithInventory() {
  let changed = false;
  const sanitized = [];

  cart.forEach((item) => {
    const stock = getStock(item.id);
    if (stock <= 0) {
      changed = true;
      return;
    }
    const qty = Math.min(Math.max(1, Number(item.qty) || 1), stock);
    if (qty !== item.qty) {
      changed = true;
    }
    sanitized.push({ ...item, qty });
  });

  if (changed) {
    cart = sanitized;
    saveCart(cart);
  }
}

function isCartPopupVisible() {
  return !!cartPopup && !cartPopup.classList.contains('hidden');
}

function showCartPopup() {
  if (!cartPopup || isCartPopupVisible()) {
    return;
  }
  clearTimeout(cartHideTimeout);
  cartPopup.classList.remove('hidden');
  requestAnimationFrame(() => {
    cartPopup.classList.add('active');
  });
}

function hideCartPopup() {
  if (!cartPopup || !isCartPopupVisible()) {
    return;
  }
  cartPopup.classList.remove('active');
  clearTimeout(cartHideTimeout);
  cartHideTimeout = window.setTimeout(() => {
    if (cartPopup && !cartPopup.classList.contains('active')) {
      cartPopup.classList.add('hidden');
    }
  }, CART_TRANSITION_MS);
}

function toggleCartPopup() {
  if (isCartPopupVisible()) {
    hideCartPopup();
  } else {
    renderCart();
    showCartPopup();
  }
}
function renderGrid(items) {
  if (!grid) {
    return;
  }

  const list = Array.isArray(items) ? items : products;

  grid.innerHTML = '';

  if (!Array.isArray(list) || list.length === 0) {
    return;
  }

  list.forEach((product) => {
    if (!product || !product.id) {
      return;
    }

    const stock = getStock(product.id);
    const isOutOfStock = stock <= 0;
    const images = Array.isArray(product.images) ? product.images.filter((src) => typeof src === 'string' && src.trim()) : [];
    const mainSrc = images[0] || product.image || DEFAULT_IMAGE;

    const card = document.createElement('article');
    card.className = 'product-card';
    card.tabIndex = 0;
    card.dataset.id = product.id;
    card.setAttribute('data-item-id', product.id);
    if (isOutOfStock) {
      card.classList.add('soldout');
      card.setAttribute('aria-disabled', 'true');
      card.tabIndex = -1;
    }

    const imgEl = document.createElement('img');
    imgEl.className = 'card-img';
    imgEl.src = mainSrc;
    imgEl.alt = product.title || '';
    imgEl.loading = 'lazy';
    imgEl.decoding = 'async';
    imgEl.style.width = '100%';
    imgEl.style.maxWidth = '100%';
    imgEl.style.height = 'auto';
    imgEl.style.maxHeight = '360px';
    imgEl.style.objectFit = 'contain';
    card.prepend(imgEl);

    if (images.length > 1) {
      card.dataset.images = JSON.stringify(images);

      // Раньше здесь запускалась автокарусель карточки.
      // Теперь ничего не запускаем — оставляем только первую картинку.
      if (!NGT_DISABLE_CARD_AUTOPLAY) {
        // (если когда-то нужно будет снова включить — вернуть старый код автокарусели сюда)
        (function initCardCarousel(cardNode) {
          let imgs;
          try {
            imgs = JSON.parse(cardNode.dataset.images);
          } catch {
            imgs = null;
          }
          if (!Array.isArray(imgs) || imgs.length < 2) return;

          const img = cardNode.querySelector('.card-img');
          if (!img) return;

          let idx = 0;
          let paused = false;
          let timer = null;

          const next = () => {
            if (!paused) {
              idx = (idx + 1) % imgs.length;
              img.src = imgs[idx];
            }
          };
          const start = () => {
            if (!timer) timer = setInterval(next, 3000);
          };
          const stop = () => {
            if (timer) {
              clearInterval(timer);
              timer = null;
            }
          };

          cardNode.addEventListener('mouseenter', () => {
            paused = true;
          });
          cardNode.addEventListener('mouseleave', () => {
            paused = false;
          });

          if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
              entries.forEach((entry) => {
                paused = !entry.isIntersecting;
                if (!paused && !timer) {
                  start();
                }
                if (paused && timer) {
                  stop();
                }
              });
            });
            io.observe(cardNode);
          }

          start();
        })(card);
      }
    } else {
      card.removeAttribute('data-images');
    }

    const titleEl = document.createElement('h2');
    titleEl.className = 'product-title title';
    titleEl.textContent = product.title || '';

    const skuEl =
      product.sku && product.sku.trim()
        ? (() => {
            const p = document.createElement('p');
            p.className = 'product-sku';
            p.textContent = `Артикул: ${product.sku}`;
            return p;
          })()
        : null;

    const priceEl = document.createElement('p');
    priceEl.className = 'product-price price';
    priceEl.textContent = formatPrice(product.price);

    card.appendChild(titleEl);
    if (skuEl) {
      card.appendChild(skuEl);
    }
    card.appendChild(priceEl);

    const handleOpen = () => {
      if (getStock(product.id) <= 0) {
        return;
      }
      openModal(product);
    };
    card.addEventListener('click', handleOpen);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleOpen();
      }
    });

    grid.appendChild(card);
  });

  applyInventoryToCards(getInventorySnapshot());
}

function applyInventoryToCards(snapshot) {
  const cards = document.querySelectorAll('[data-item-id], [data-id]');
  cards.forEach((card) => {
    const id = card.getAttribute('data-item-id') || card.getAttribute('data-id');
    if (!id) {
      return;
    }

    let left = Number(snapshot?.[id]?.stock);
    if (!Number.isFinite(left)) {
      const productData = products.find((p) => p.id === id);
      if (productData && Number.isFinite(productData.stock)) {
        left = Number(productData.stock);
      } else {
        left = Number.POSITIVE_INFINITY;
      }
    }

    const isSoldOut = left <= 0;
    const addBtns = card.querySelectorAll('.add-to-cart, .card-add, .modal-add');
    addBtns.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) {
        return;
      }
      btn.toggleAttribute('disabled', isSoldOut);
      btn.setAttribute('aria-disabled', isSoldOut ? 'true' : 'false');
      if (isSoldOut) {
        if (!btn.dataset._originalText) {
          btn.dataset._originalText = btn.textContent ?? '';
        }
        if (btn.classList.contains('modal-add') || btn.matches('.add-to-cart, .card-add')) {
          btn.textContent = 'Нет в наличии';
        }
      } else if (btn.dataset._originalText) {
        btn.textContent = btn.dataset._originalText;
      }
    });

    card.classList.toggle('soldout', isSoldOut);
    if (isSoldOut) {
      card.setAttribute('aria-disabled', 'true');
      card.tabIndex = -1;
    } else {
      card.removeAttribute('aria-disabled');
      card.tabIndex = 0;
    }
  });
}

function openModal(product) {
  if (!modal) {
    return;
  }

  hideCartPopup();
  activeProduct = product;

  const imagesForModal = Array.isArray(product.images) && product.images.length
    ? product.images
    : (product.image ? [product.image] : [DEFAULT_IMAGE]);

  window.setModalImages?.(imagesForModal);

  if (modalImage) {
    modalImage.src = imagesForModal[0] || DEFAULT_IMAGE;
    modalImage.alt = product.title || '';
  }
  if (modalTitle) {
    modalTitle.textContent = product.title || '';
  }
  if (modalDescription) {
    const parts = [];
    if (product.sku) {
      parts.push(`SKU: ${product.sku}`);
    }
    if (product.description) {
      parts.push(product.description);
    }
    modalDescription.textContent = parts.join(' · ');
  }
  if (modalPrice) {
    modalPrice.textContent = formatPrice(product.price);
  }

  (function enhanceModal(currentProduct) {
    const modalNode = document.getElementById('modal');
    if (!modalNode) return;

    const left = getStock(currentProduct.id);
    const priceEl = modalNode.querySelector('.modal-price');
    if (priceEl && Number.isFinite(left)) {
      const noteId = 'modal-stock-note';
      let note = modalNode.querySelector('#' + noteId);
      if (!note) {
        note = document.createElement('div');
        note.id = noteId;
        note.style.fontSize = '12px';
        note.style.opacity = '0.8';
        note.style.marginTop = '4px';
        priceEl.insertAdjacentElement('afterend', note);
      }
      note.textContent = left > 0 ? `В наличии: ${left}` : 'Нет в наличии';
    }

    const content = modalNode.querySelector('.modal-content') || modalNode;
    let wrapper = modalNode.querySelector('.modal-image-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'modal-image-wrapper';
      wrapper.style.position = 'relative';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      const parent = modalImage?.parentElement || content;
      if (parent && modalImage) {
        parent.insertBefore(wrapper, modalImage);
        wrapper.appendChild(modalImage);
      }
    } else if (modalImage && modalImage.parentElement !== wrapper) {
      wrapper.appendChild(modalImage);
    }

    if (!wrapper.querySelector('.modal-slide-btn.prev')) {
      const prev = document.createElement('button');
      prev.className = 'modal-slide-btn prev';
      prev.type = 'button';
      prev.setAttribute('aria-label', 'Предыдущее изображение');
      prev.textContent = '‹';

      const next = document.createElement('button');
      next.className = 'modal-slide-btn next';
      next.type = 'button';
      next.setAttribute('aria-label', 'Следующее изображение');
      next.textContent = '›';

      wrapper.appendChild(prev);
      wrapper.appendChild(next);

      const goNext = typeof window.modalSliderNext === 'function' ? window.modalSliderNext : null;
      const goPrev = typeof window.modalSliderPrev === 'function' ? window.modalSliderPrev : null;

      function datasetNext() {
        try {
          const st = JSON.parse(modalNode.dataset.slider || '{}');
          if (!Array.isArray(st.list) || !st.list.length) return;
          st.idx = ((st.idx ?? 0) + 1) % st.list.length;
          modalNode.dataset.slider = JSON.stringify(st);
          const img = modalNode.querySelector('.modal-image');
          if (img) img.src = st.list[st.idx];
        } catch {}
      }
      function datasetPrev() {
        try {
          const st = JSON.parse(modalNode.dataset.slider || '{}');
          if (!Array.isArray(st.list) || !st.list.length) return;
          st.idx = ((st.idx ?? 0) - 1 + st.list.length) % st.list.length;
          modalNode.dataset.slider = JSON.stringify(st);
          const img = modalNode.querySelector('.modal-image');
          if (img) img.src = st.list[st.idx];
        } catch {}
      }

      prev.addEventListener('click', () => (goPrev ? goPrev() : datasetPrev()));
      next.addEventListener('click', () => (goNext ? goNext() : datasetNext()));
    }
  })(product);

  const remaining = getRemainingForAdd(product.id);
  const canAddToCart = remaining > 0;

  const qtyButtons = modal?.querySelectorAll('.qty-btn[data-action]');
  const clamp = (value) => {
    const numeric = Number.parseInt(value, 10);
    if (Number.isNaN(numeric)) {
      return 1;
    }
    return Math.min(Math.max(numeric, 1), Math.max(1, remaining));
  };

  if (modalQtyInput instanceof HTMLInputElement) {
    if (canAddToCart) {
      modalQtyInput.disabled = false;
      modalQtyInput.min = '1';
      modalQtyInput.max = String(Math.max(1, remaining));
      modalQtyInput.value = '1';
    } else {
      modalQtyInput.disabled = true;
      modalQtyInput.min = '0';
      modalQtyInput.max = '0';
      modalQtyInput.value = '0';
    }
    modalQtyInput.oninput = () => {
      modalQtyInput.value = String(clamp(modalQtyInput.value));
    };
  }

  qtyButtons?.forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) {
      return;
    }
    btn.onclick = (event) => {
      event.preventDefault();
      if (!(modalQtyInput instanceof HTMLInputElement) || modalQtyInput.disabled) {
        return;
      }
      const delta = btn.dataset.action === 'inc' ? 1 : -1;
      const next = clamp(Number(modalQtyInput.value) + delta);
      modalQtyInput.value = String(next);
    };
  });

  if (modalQtyRow instanceof HTMLElement) {
    modalQtyRow.style.display = canAddToCart ? 'inline-flex' : 'none';
  }

  if (modalAddButton instanceof HTMLButtonElement) {
    modalAddButton.disabled = !canAddToCart;
    modalAddButton.classList.toggle('disabled', !canAddToCart);
    modalAddButton.onclick = (event) => {
      event.preventDefault();
      if (!canAddToCart || !(modalQtyInput instanceof HTMLInputElement)) {
        return;
      }
      const qty = clamp(modalQtyInput.value);
      addToCart(product, qty);
      updateCartCount();
      closeModal();
      showToast('Товар добавлен в корзину');
    };
  }

  if (modalEscHandler) {
    document.removeEventListener('keydown', modalEscHandler);
  }
  modalEscHandler = (event) => {
    if (event.key === 'Escape') {
      closeModal();
    }
  };
  document.addEventListener('keydown', modalEscHandler);

  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  (canAddToCart ? modalAddButton : modalCloseButton)?.focus?.();
}

function closeModal() {
  if (!modal) {
    return;
  }
  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  activeProduct = null;
  if (modalEscHandler) {
    document.removeEventListener('keydown', modalEscHandler);
    modalEscHandler = null;
  }
}
function renderCart() {
  if (!cartPopup) {
    return;
  }

  captureFormState();

  if (!cart.length) {
    cartPopup.innerHTML = '<p class="cart-empty">Корзина пуста</p>';
    return;
  }

  const itemsMarkup = cart
    .map((item) => {
      const safeId = escapeHtml(item.id);
      const safeTitle = escapeHtml(item.title);
      const safeImage = escapeHtml(item.image || DEFAULT_IMAGE);
      const lineTotal = formatPrice(item.price * item.qty);
      return `
        <article class="cart-item" data-id="${safeId}">
          <img src="${safeImage}" alt="${safeTitle}">
          <div class="cart-item-body">
            <p class="title">${safeTitle}</p>
            <p class="price">${formatPrice(item.price)}</p>
            <div class="controls">
              <button type="button" data-action="dec" aria-label="Уменьшить количество товара ${safeTitle}">?</button>
              <input type="number" data-role="qty" min="1" value="${item.qty}" aria-label="Количество товара ${safeTitle}">
              <button type="button" data-action="inc" aria-label="Увеличить количество товара ${safeTitle}">+</button>
            </div>
          </div>
          <div class="cart-item-total">
            <span class="line-total">${lineTotal}</span>
            <button type="button" data-action="remove" aria-label="Удалить товар ${safeTitle}">?</button>
          </div>
        </article>`;
    })
    .join('');

  const totalLabel = formatPrice(getCartTotal(cart));

  cartPopup.innerHTML = `
    <div class="cart-items" role="list">
      ${itemsMarkup}
    </div>
    <div class="cart-summary">
      <span>Сумма товаров:</span>
      <strong>${totalLabel}</strong>
    </div>
    <div class="cart-form" id="cartForm">
      <div class="row">
        <label for="custName">Имя *</label>
        <input type="text" id="custName" placeholder="Ваше имя" value="${escapeHtml(cartFormState.name)}" required>
      </div>
      <div class="row">
        <label for="custEmail">Email *</label>
        <input type="email" id="custEmail" placeholder="you@example.com" value="${escapeHtml(cartFormState.email)}" required>
      </div>
      <div class="row">
        <label for="custTelegram">Telegram <span class="field-hint">(необязательно)</span></label>
        <input type="text" id="custTelegram" placeholder="@username" value="${escapeHtml(cartFormState.telegram)}">
      </div>
      <div class="row">
        <label for="custComment">Комментарий к заказу</label>
        <textarea id="custComment" placeholder="До 200 символов" maxlength="200" rows="3">${escapeHtml(cartFormState.comment)}</textarea>
      </div>
      <div class="delivery-info">Доставка за счёт покупателя. Детали обсуждаются после подтверждения заказа.</div>
      <div class="consent-row">
        <input type="checkbox" id="privacyConsent" ${cartFormState.consent ? 'checked' : ''}>
        <label for="privacyConsent">
          Я согласен с <a href="#footer-privacy">Privacy Policy</a>
        </label>
      </div>
    </div>
    <div class="cart-actions">
      <button type="button" id="orderBtn" data-action="checkout" disabled>Оформить заказ</button>
    </div>
  `;

  cart.forEach((item) => {
    const stock = getStock(item.id);
    const cartItemElement = Array.from(cartPopup.querySelectorAll('.cart-item')).find((el) => el.dataset.id === item.id);
    if (!cartItemElement) {
      return;
    }
    const qtyInput = cartItemElement.querySelector('[data-role="qty"]');
    if (qtyInput instanceof HTMLInputElement) {
      const maxQty = Math.max(1, stock);
      qtyInput.max = String(maxQty);
      qtyInput.value = String(Math.min(Math.max(item.qty, 1), maxQty));
    }
  });

  setupCartForm();
}

function setupCartForm() {
  if (!cartPopup) {
    return;
  }

  const nameInput = cartPopup.querySelector('#custName');
  const emailInput = cartPopup.querySelector('#custEmail');
  const telegramInput = cartPopup.querySelector('#custTelegram');
  const commentInput = cartPopup.querySelector('#custComment');
  const consentInput = cartPopup.querySelector('#privacyConsent');
  const orderBtn = cartPopup.querySelector('#orderBtn');

  if (!(nameInput instanceof HTMLInputElement) || !(emailInput instanceof HTMLInputElement) || !(orderBtn instanceof HTMLButtonElement)) {
    return;
  }

  const ensureTelegramPrefix = () => {
    if (!(telegramInput instanceof HTMLInputElement)) {
      return;
    }
    const value = telegramInput.value.trim();
    if (!value) {
      return;
    }
    if (!value.startsWith('@')) {
      telegramInput.value = `@${value.replace(/^@+/, '')}`;
    }
  };

  const isEmailValid = (value) => /\S+@\S+\.\S+/.test(value);

  const updateFormState = () => {
    cartFormState = {
      name: nameInput.value ?? '',
      email: emailInput.value ?? '',
      telegram: telegramInput instanceof HTMLInputElement ? telegramInput.value ?? '' : '',
      comment: commentInput instanceof HTMLTextAreaElement ? commentInput.value ?? '' : '',
      consent: !!consentInput?.checked,
    };
  };

  const updateSubmitState = () => {
    const ready = nameInput.value.trim().length > 0 && isEmailValid(emailInput.value ?? '') && !!consentInput?.checked && cart.length > 0;
    orderBtn.disabled = !ready;
  };

  if (telegramInput instanceof HTMLInputElement) {
    telegramInput.addEventListener('focus', () => {
      if (telegramInput.value.trim() === '') {
        telegramInput.value = '@';
      }
    });
    telegramInput.addEventListener('input', () => {
      ensureTelegramPrefix();
      updateFormState();
      updateSubmitState();
    });
  }

  commentInput?.addEventListener('input', () => {
    updateFormState();
    updateSubmitState();
  });

  [nameInput, emailInput].forEach((input) => {
    input.addEventListener('input', () => {
      input.classList.remove('input-error');
      updateFormState();
      updateSubmitState();
    });
  });

  consentInput?.addEventListener('change', () => {
    updateFormState();
    updateSubmitState();
  });

  updateFormState();
  updateSubmitState();

  orderBtn.onclick = () => {
    handleCheckout(loadCart());
  };
}
function addToCart(product, quantity = 1) {
  if (!product || !product.id) {
    showToast('Не удалось подтвердить наличие. Попробуйте ещё раз.');
    return;
  }

  const requestedQty = Math.max(1, Number(quantity) || 1);
  const remaining = getRemainingForAdd(product.id);

  if (!Number.isFinite(remaining)) {
    showToast('Не удалось подтвердить наличие. Попробуйте ещё раз.');
    return;
  }

  if (remaining <= 0) {
    showToast(`Недостаточно товара: ${product.id}. Нужно ${requestedQty}, осталось 0.`);
    return;
  }

  const qtyToAdd = Math.min(requestedQty, remaining);
  if (qtyToAdd <= 0) {
    return;
  }

  if (qtyToAdd < requestedQty) {
    showToast(`Недостаточно товара: ${product.id}. Нужно ${requestedQty}, осталось ${qtyToAdd}.`);
  }

  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.qty += qtyToAdd;
  } else {
    cart.push({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.images?.[0] || product.image || DEFAULT_IMAGE,
      qty: qtyToAdd,
    });
  }

  saveCart(cart);
  updateCartCount(cart);
  renderCart();
}

function changeCartQty(productId, delta) {
  if (!productId || !Number.isFinite(delta)) {
    return;
  }
  const item = cart.find((entry) => entry.id === productId);
  if (!item) {
    return;
  }
  const stock = getStock(productId);
  if (!Number.isFinite(stock)) {
    showToast('Не удалось подтвердить наличие. Попробуйте ещё раз.');
    return;
  }
  const nextQty = item.qty + delta;
  if (delta > 0 && nextQty > stock) {
    showToast(`Недостаточно товара: ${productId}. Нужно ${nextQty}, осталось ${stock}.`);
    return;
  }
  updateQty(productId, nextQty);
}

function updateQty(productId, newQty) {
  const item = cart.find((entry) => entry.id === productId);
  if (!item) {
    return;
  }
  const stock = getStock(productId);
  if (newQty <= 0 || stock <= 0) {
    cart = cart.filter((entry) => entry.id !== productId);
  } else {
    item.qty = Math.min(Math.max(newQty, 1), stock);
  }
  saveCart(cart);
  updateCartCount(cart);
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter((entry) => entry.id !== productId);
  saveCart(cart);
  updateCartCount(cart);
  renderCart();
}

function clearCart() {
  cart = [];
  saveCart(cart);
  updateCartCount(cart);
  cartFormState = { ...defaultFormState };
  renderCart();
}

function handleCartPopupClick(e) {
  const target = e.target;
  if (target.matches('[data-action="clear"]')) {
    clearCart();
    return;
  }
  if (target.matches('[data-action="dec"]')) {
    changeCartQty(target.closest('[data-id]')?.dataset.id, -1);
    return;
  }
  if (target.matches('[data-action="inc"]')) {
    changeCartQty(target.closest('[data-id]')?.dataset.id, +1);
    return;
  }
  if (target.matches('[data-action="remove"]')) {
    removeFromCart(target.closest('[data-id]')?.dataset.id);
    return;
  }
  if (target.matches('[data-action="checkout"]')) {
    handleCheckout(loadCart());
    return;
  }
}

function handleCartPopupChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.dataset.role !== 'qty') {
    return;
  }

  const itemElement = target.closest('.cart-item');
  if (!itemElement) {
    return;
  }

  const productId = itemElement.dataset.id;
  if (!productId) {
    return;
  }

  const parsedQty = Number.parseInt(target.value, 10);
  if (Number.isNaN(parsedQty) || parsedQty <= 0) {
    removeFromCart(productId);
    return;
  }

  const stock = getStock(productId);
  if (!Number.isFinite(stock)) {
    showToast('Не удалось подтвердить наличие. Попробуйте ещё раз.');
    removeFromCart(productId);
    return;
  }
  if (stock <= 0) {
    removeFromCart(productId);
    showToast(`Недостаточно товара: ${productId}. Нужно ${parsedQty}, осталось 0.`);
    return;
  }

  const clampedQty = Math.min(parsedQty, stock);
  target.value = String(clampedQty);
  if (parsedQty > stock) {
    showToast(`Недостаточно товара: ${productId}. Нужно ${parsedQty}, осталось ${stock}.`);
  }
  updateQty(productId, clampedQty);
}

function updateCartCount(currentCart = cart) {
  if (!cartCountElement) {
    return;
  }
  const total = (currentCart || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  if (total > 0) {
    cartCountElement.textContent = String(total);
    cartCountElement.classList.remove('hidden');
  } else {
    cartCountElement.textContent = '0';
    cartCountElement.classList.add('hidden');
  }
}

function clampQuantity(value, min = 1, max = Infinity) {
  const numeric = Number.parseInt(value, 10);
  if (Number.isNaN(numeric)) {
    return min;
  }
  return Math.min(Math.max(numeric, min), max);
}

function getCartTotal(currentCart = cart) {
  return currentCart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function formatPrice(value) {
  return `${Number(value).toLocaleString('ru-RU')} RUB`;
}

function captureFormState() {
  const form = cartPopup?.querySelector('#cartForm');
  if (!form) {
    return;
  }
  cartFormState = {
    name: form.querySelector('#custName')?.value ?? cartFormState.name,
    email: form.querySelector('#custEmail')?.value ?? cartFormState.email,
    telegram: form.querySelector('#custTelegram')?.value ?? cartFormState.telegram,
    comment: form.querySelector('#custComment')?.value ?? cartFormState.comment,
    consent: !!form.querySelector('#privacyConsent')?.checked,
  };
}

function resetFormState() {
  cartFormState = { ...defaultFormState };
}

async function copyToClipboardSafe(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return false;
  }
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('[clipboard] write failed:', error);
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body?.appendChild(textarea);
    textarea.select();
    const success = document.execCommand && document.execCommand('copy');
    textarea.remove();
    return !!success;
  } catch (error) {
    console.warn('[clipboard] fallback failed:', error);
    return false;
  }
}

function openTelegramChat() {
  try {
    window.open(ORDER_TELEGRAM_URL, '_blank', 'noopener');
  } catch (error) {
    console.warn('[telegram] open failed:', error);
  }
}
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('show');

  window.setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function handleCheckout(currentCart = cart) {
  const items = Array.isArray(currentCart) ? currentCart : [];
  if (!items.length) {
    showToast('Cart is empty.');
    return;
  }

  for (const item of items) {
    if (!item || !item.id) {
      continue;
    }
    const need = Math.max(1, Number(item.qty) || 1);
    const available = getStock(item.id);
    if (!Number.isFinite(available)) {
      showToast('Unable to verify stock. Please try again.');
      return;
    }
    if (need > available) {
      const name = item.title || item.id;
      showToast(`Not enough stock for: ${name}`);
      return;
    }
  }

  submitOrder();
}

async function submitOrder() {
  const orderBtn = cartPopup?.querySelector('#orderBtn');
  if (!(orderBtn instanceof HTMLButtonElement) || orderBtn.disabled) {
    return;
  }

  cart = loadCart();
  if (!Array.isArray(cart) || cart.length === 0) {
    showToast('Cart is empty.');
    return;
  }

  const nameInput = document.getElementById('custName');
  const emailInput = document.getElementById('custEmail');
  const telegramInput = document.getElementById('custTelegram');
  const commentInput = document.getElementById('custComment');
  const consentInput = document.getElementById('privacyConsent');

  const name = (nameInput?.value || '').trim();
  const email = (emailInput?.value || '').trim();
  let telegram = (telegramInput?.value || '').trim();
  const comment = (commentInput?.value || '').trim();
  const consentChecked = !!consentInput?.checked;

  if (!name || !/\S+@\S+\.\S+/.test(email) || !consentChecked) {
    showToast('Please review your contact details.');
    return;
  }

  if (telegram === '@') {
    telegram = '';
  }

  const cartSnapshot = cart.map((item) => ({
    id: String(item.id),
    title: item.title,
    price: item.price,
    qty: Math.max(1, Number(item.qty) || 1),
  }));

  const cartItems = cartSnapshot.map((item) => ({
    id: String(item.id),
    title: item.title,
    qty: item.qty,
  }));

  orderBtn.disabled = true;
  orderBtn.dataset.loading = 'true';

  try {
    await decrementInventoryOrFail(cartItems);
  } catch (error) {
    if (error?.code === 'OUT_OF_STOCK') {
      showToast(error.message || 'Not enough stock.');
    } else {
      console.error('[order] inventory error:', error);
      showToast('Unable to sync stock. Please try again.');
    }
    syncCartWithInventory();
    renderCart();
    renderGrid(products);
    orderBtn.disabled = false;
    orderBtn.removeAttribute('data-loading');
    return;
  }

  syncCartWithInventory();
  renderCart();
  renderGrid(products);

  const summaryLines = [];
  summaryLines.push('Заказ NEW GRGY TIMES');
  summaryLines.push('---');
  summaryLines.push('Состав корзины:');
  cartSnapshot.forEach((item, index) => {
    const sum = item.price * item.qty;
    summaryLines.push(`${index + 1}) ${item.title} × ${item.qty} — ${item.price.toLocaleString('ru-RU')} ₽ = ${sum.toLocaleString('ru-RU')} ₽`);
  });
  summaryLines.push('---');
  summaryLines.push(`Итого: ${getCartTotal(cartSnapshot).toLocaleString('ru-RU')} ₽`);
  summaryLines.push('');
  summaryLines.push('Контакты:');
  summaryLines.push(`Имя: ${name}`);
  summaryLines.push(`Email: ${email}`);
  summaryLines.push(`Telegram: ${telegram || '-'}`);
  if (comment) {
    summaryLines.push(`Комментарий: ${comment}`);
  }

  const summaryText = summaryLines.join('\n');

  const formData = new FormData();
  formData.append('access_key', WEB3FORMS_ACCESS_KEY);
  formData.append('subject', 'Заказ NEW GRGY TIMES');
  formData.append('from_name', 'NEW GRGY TIMES Store');
  formData.append('replyto', email);
  formData.append('email', 'grgyone@gmail.com');
  formData.append('message', summaryText);

  const rollbackOnFailure = async () => {
    await restoreInventoryQuantities(cartItems);
    syncCartWithInventory();
    renderCart();
    renderGrid(products);
  };

  try {
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (data.success) {
      try {
        await copyToClipboardSafe(summaryText);
      } catch (clipboardError) {
        console.warn('[clipboard] copy failed:', clipboardError);
      }
      openTelegramChat();

      saveCart([]);
      cart = [];
      cartFormState = { ...defaultFormState };
      updateCartCount(cart);
      renderCart();
      renderGrid(products);
      showToast('Request sent. We will contact you soon.');
      const form = document.getElementById('cartForm');
      form?.reset();
      resetFormState();
      return;
    }

    console.error('[order] web3forms error:', data);
    showToast('Failed to submit. Please try again.');
    await rollbackOnFailure();
  } catch (error) {
    console.error('[order] submit failed:', error);
    showToast('Failed to submit. Please try again.');
    await rollbackOnFailure();
  } finally {
    orderBtn.disabled = false;
    orderBtn.removeAttribute('data-loading');
  }
}

// --- СЛАЙДЕР В МОДАЛКЕ (без изменения HTML-файлов)
(function initModalSlider() {
  const modalRoot = document.getElementById('modal');
  if (!modalRoot) return;

  const img = modalRoot.querySelector('.modal-image');
  if (!img) return;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.style.maxWidth = '100%';
  img.style.maxHeight = '80vh';
  img.style.width = 'auto';
  img.style.height = 'auto';
  img.style.objectFit = 'contain';
  img.style.display = 'block';
  img.style.margin = '0 auto';

  const state = { list: [], idx: 0 };

  function syncDataset() {
    try {
      modalRoot.dataset.slider = JSON.stringify({ list: state.list, idx: state.idx });
    } catch {
      modalRoot.dataset.slider = '';
    }
  }

  function render() {
    if (!state.list.length) return;
    img.src = state.list[state.idx];
    syncDataset();
  }
  function next() {
    if (state.list.length) {
      state.idx = (state.idx + 1) % state.list.length;
      render();
    }
  }
  function prev() {
    if (state.list.length) {
      state.idx = (state.idx - 1 + state.list.length) % state.list.length;
      render();
    }
  }

  window.setModalImages = function setModalImages(arr) {
    state.list = Array.isArray(arr) && arr.length ? arr.slice() : [DEFAULT_IMAGE];
    state.idx = 0;
    render();
  };
  window.modalSliderNext = () => next();
  window.modalSliderPrev = () => prev();

  document.addEventListener('keydown', (e) => {
    if (modalRoot.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });

  img.style.cursor = 'pointer';
  img.addEventListener('click', (e) => {
    const rect = img.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    if (e.clientX >= mid) {
      next();
    } else {
      prev();
    }
  });

  let sx = 0;
  let sy = 0;
  img.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    sx = t.clientX;
    sy = t.clientY;
  }, { passive: true });
  img.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
      if (dx < 0) {
        next();
      } else {
        prev();
      }
    }
  }, { passive: true });
})();

















