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
const INVENTORY_STORAGE_KEY = 'inventory';
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
    ensureInventoryFromCatalog(products);
    renderGrid(products);
    console.log('[init] grid rendered', products.length, 'items');
  } catch (error) {
    console.error('[init] catalog error:', error);
    showToast('Не удалось загрузить каталог');
    renderGrid([]);
  }

  syncCartWithInventory();
  updateCartCount();
  renderCart();
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
  window.products = products.map((item) => structuredClone(item));

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
  window.products = products.map((item) => structuredClone(item));
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

function ensureInventoryFromCatalog(items) {
  const inv = loadInventoryObj();
  let changed = false;

  (items || []).forEach((product) => {
    if (!product || !product.id) {
      return;
    }
    if (inv[product.id] == null) {
      inv[product.id] = Number.isFinite(product.stock) ? Math.max(0, product.stock) : 0;
      changed = true;
    }
  });

  if (changed) {
    saveInventoryObj(inv);
  }
}

function loadInventoryObj() {
  try {
    const stored = localStorage.getItem(INVENTORY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveInventoryObj(inv) {
  localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inv || {}));
}

function getStock(pid) {
  if (!pid) {
    return 0;
  }
  const inv = loadInventoryObj();
  if (pid in inv) {
    return Math.max(0, Number(inv[pid]) || 0);
  }
  const product = products.find((item) => item.id === pid);
  if (product) {
    return Math.max(0, Number(product.stock) || 0);
  }
  return 0;
}

function setStock(pid, qty) {
  const inv = loadInventoryObj();
  inv[pid] = Math.max(0, Number(qty) || 0);
  saveInventoryObj(inv);
}

function getRemainingForAdd(pid) {
  const inStock = getStock(pid);
  const inCart = loadCart().find((item) => item.id === pid)?.qty || 0;
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
      card.classList.add('out-of-stock');
      card.setAttribute('aria-disabled', 'true');
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

    const stockBadge = document.createElement('div');
    stockBadge.className = 'stock-badge';
    stockBadge.textContent = stock > 0 ? `В наличии: ${stock}` : 'Нет в наличии';

    card.appendChild(titleEl);
    if (skuEl) {
      card.appendChild(skuEl);
    }
    card.appendChild(priceEl);
    card.appendChild(stockBadge);

    if (isOutOfStock) {
      const oosBox = document.createElement('div');
      oosBox.className = 'oos-box';
      oosBox.textContent = 'Нет в наличии';
      card.appendChild(oosBox);
    }

    const handleOpen = () => openModal(product);
    card.addEventListener('click', handleOpen);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleOpen();
      }
    });

    grid.appendChild(card);
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
  return `${Number(value).toLocaleString('ru-RU')} ?`;
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
  try {
    if (!currentCart.length) {
      showToast('Корзина пуста');
      return;
    }

    for (const item of currentCart) {
      if (!item || !item.id) {
        continue;
      }
      const need = Math.max(1, Number(item.qty) || 1);
      const have = getStock(item.id);
      if (!Number.isFinite(have)) {
        showToast('Не удалось подтвердить наличие. Попробуйте ещё раз.');
        return;
      }
      if (need > have) {
        showToast(`Недостаточно товара: ${item.id}. Нужно ${need}, осталось ${have}.`);
        return;
      }
    }

    submitOrder();
  } catch (error) {
    console.error('[checkout] availability error:', error);
    showToast('Не удалось подтвердить наличие. Попробуйте ещё раз.');
  }
}

async function submitOrder() {
  const orderBtn = cartPopup?.querySelector('#orderBtn');
  if (!(orderBtn instanceof HTMLButtonElement) || orderBtn.disabled) {
    return;
  }

  cart = loadCart();
  if (!cart || !cart.length) {
    showToast('Корзина пуста');
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
    showToast('Заполните обязательные поля формы');
    return;
  }

  if (telegram === '@') {
    telegram = '';
  }

  const formData = new FormData();
  formData.append('access_key', WEB3FORMS_ACCESS_KEY);
  formData.append('subject', 'Заказ NEW GRGY TIMES');
  formData.append('from_name', 'NEW GRGY TIMES Store');
  formData.append('replyto', email);
  formData.append('email', 'grgyone@gmail.com');

  const summaryLines = [];
  summaryLines.push('Заказ NEW GRGY TIMES');
  summaryLines.push('---');
  summaryLines.push('Состав заказа:');
  cart.forEach((item, index) => {
    const sum = item.price * item.qty;
    summaryLines.push(`${index + 1}) ${item.title} ? ${item.qty} — ${item.price.toLocaleString('ru-RU')} ? = ${sum.toLocaleString('ru-RU')} ?`);
  });
  summaryLines.push('---');
  summaryLines.push(`Сумма заказа: ${getCartTotal(cart).toLocaleString('ru-RU')} ?`);
  summaryLines.push('');
  summaryLines.push('Контакты:');
  summaryLines.push(`Имя: ${name}`);
  summaryLines.push(`Email: ${email}`);
  summaryLines.push(`Telegram: ${telegram || '—'}`);
  if (comment) {
    summaryLines.push(`Комментарий: ${comment}`);
  }

  formData.append('message', summaryLines.join('\n'));

  orderBtn.disabled = true;

  try {
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (data.success) {
      const inv = loadInventoryObj();
      cart.forEach((item) => {
        inv[item.id] = Math.max(0, (inv[item.id] ?? getStock(item.id)) - item.qty);
      });
      saveInventoryObj(inv);

      saveCart([]);
      cart = [];
      cartFormState = { ...defaultFormState };
      updateCartCount(cart);
      renderCart();
      renderGrid(products);
      showToast('Заказ оформлен, вам скоро ответят');
      const form = document.getElementById('cartForm');
      form?.reset();
      resetFormState();
      return;
    }

    showToast('Ошибка отправки заказа. Попробуйте позже.');
    console.error('[order] web3forms error:', data);
  } catch (error) {
    console.error('[order] request failed:', error);
    showToast('Ошибка отправки заказа. Попробуйте позже.');
  } finally {
    orderBtn.disabled = false;
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

  function render() {
    if (!state.list.length) return;
    img.src = state.list[state.idx];
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




