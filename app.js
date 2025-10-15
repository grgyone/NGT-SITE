const WEB3FORMS_ACCESS_KEY = '97052283-3d2d-46b2-86ca-c21f81998914';
const CART_STORAGE_KEY = 'cart';
const CART_TRANSITION_MS = 200;

let products = [];

const grid = document.getElementById('grid');

const cartPopup = document.getElementById('cart-popup');
const cartTrigger = document.querySelector('.cart-icon');
const cartCountElement = document.getElementById('cart-count');

const initialModal = getModalRoot();
initialModal?.querySelector('.modal-title')?.classList.add('title');
initialModal?.querySelector('.modal-price')?.classList.add('price');
initialModal?.querySelector('.modal-add')?.classList.add('btn-add');

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

function getModalRoot() {
  return (
    document.getElementById('product-modal') ||
    document.getElementById('productModal') ||
    document.getElementById('modal') ||
    document.querySelector('.product-modal') ||
    document.querySelector('.modal')
  );
}

function getModalOverlay(modalEl) {
  return modalEl?.closest('.modal-overlay') || document.querySelector('.modal-overlay') || null;
}

document.addEventListener('DOMContentLoaded', async () => {
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
});
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
    const modal = getModalRoot();
    if (modal && !modal.classList.contains('hidden')) {
      closeModal();
    } else if (isCartPopupVisible()) {
      hideCartPopup();
    }
  }
});

async function loadCatalog() {
  const url = new URL('./items/index.json', document.baseURI).href;
  console.log('[catalog] baseURI =', document.baseURI, '→ fetch =', url);

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`catalog fetch failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.items)) {
    throw new Error('catalog JSON has no "items" array');
  }
  products = data.items
    .map(normalizeProduct)
    .filter((item) => item !== null);
  console.log('[catalog] loaded', products.length, 'items');
}

function normalizeProduct(raw) {
  if (!raw || raw.id == null) {
    return null;
  }
  const images = Array.isArray(raw.images)
    ? raw.images.filter((src) => typeof src === 'string' && src.trim().length > 0)
    : [];
  return {
    id: String(raw.id),
    title: typeof raw.title === 'string' ? raw.title : '',
    sku: typeof raw.sku === 'string' ? raw.sku : '',
    price: Number(raw.price) || 0,
    stock: Number(raw.stock),
    description: typeof raw.description === 'string' ? raw.description : '',
    images,
  };
}

function ensureInventoryFromCatalog(items) {
  const raw = localStorage.getItem('inventory');
  let inv;
  try {
    inv = raw ? JSON.parse(raw) : {};
  } catch {
    inv = {};
  }
  let changed = false;
  (items || []).forEach((product) => {
    if (!product || product.id == null) {
      return;
    }
    if (inv[product.id] == null) {
      inv[product.id] = Number.isFinite(product.stock) ? product.stock : 0;
      changed = true;
    }
  });
  if (changed) {
    localStorage.setItem('inventory', JSON.stringify(inv));
    console.log('[inventory] initialized from catalog');
  } else {
    console.log('[inventory] already present');
  }
}

function loadInventoryObj() {
  try {
    return JSON.parse(localStorage.getItem('inventory') || '{}') || {};
  } catch {
    return {};
  }
}

function saveInventoryObj(inv) {
  localStorage.setItem('inventory', JSON.stringify(inv || {}));
}

function getStock(pid) {
  if (!pid) {
    return 0;
  }
  const inv = loadInventoryObj();
  const value = inv[pid];
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function setStock(pid, qty) {
  if (!pid) {
    return;
  }
  const inv = loadInventoryObj();
  inv[pid] = Math.max(0, qty | 0);
  saveInventoryObj(inv);
}

function getRemainingForAdd(pid) {
  const inStock = getStock(pid);
  const inCart = loadCart().find((item) => item.id === pid)?.qty || 0;
  return Math.max(0, inStock - inCart);
}

function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => ({
        id: String(item.id),
        title: typeof item.title === 'string' ? item.title : '',
        price: Number(item.price) || 0,
        image: typeof item.image === 'string' ? item.image : './0.png',
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
    const clampedQty = Math.min(Math.max(1, Number(item.qty) || 1), stock);
    if (clampedQty !== item.qty) {
      changed = true;
    }
    sanitized.push({ ...item, qty: clampedQty });
  });
  if (changed) {
    cart = sanitized;
    saveCart(cart);
    console.log('[cart] adjusted to match inventory');
  }
}

function renderGrid(items) {
  if (!grid) {
    return;
  }

  grid.innerHTML = '';

  if (!Array.isArray(items) || items.length === 0) {
    return;
  }

  items.forEach((product) => {
    if (!product || !product.id) {
      return;
    }

    const stock = getStock(product.id);
    const isOutOfStock = stock === 0;
    const primaryImage = product.images && product.images.length > 0 ? product.images[0] : './0.png';

    const card = document.createElement('article');
    card.className = 'product-card';
    card.tabIndex = 0;
    card.dataset.id = product.id;
    if (isOutOfStock) {
      card.classList.add('out-of-stock');
      card.setAttribute('aria-disabled', 'true');
    }

    const imageWrap = document.createElement('div');
    imageWrap.className = 'product-image-wrapper image-wrap';

    const img = document.createElement('img');
    img.className = 'product-image';
    img.src = primaryImage;
    img.alt = product.title || '';
    img.loading = 'lazy';
    imageWrap.appendChild(img);

    if (isOutOfStock) {
      const overlay = document.createElement('div');
      overlay.className = 'card-oos-overlay';
      overlay.textContent = 'НЕТ В НАЛИЧИИ';
      imageWrap.appendChild(overlay);
    }

    const titleEl = document.createElement('h2');
    titleEl.className = 'product-title title';
    titleEl.textContent = product.title || '';

    let skuEl = null;
    if (product.sku) {
      skuEl = document.createElement('p');
      skuEl.className = 'product-sku';
      skuEl.textContent = `Артикул: ${product.sku}`;
    }

    const priceEl = document.createElement('p');
    priceEl.className = 'product-price price';
    priceEl.textContent = formatPrice(product.price);

    card.appendChild(imageWrap);
    card.appendChild(titleEl);
    if (skuEl) {
      card.appendChild(skuEl);
    }
    card.appendChild(priceEl);

    if (isOutOfStock) {
      const oosBox = document.createElement('div');
      oosBox.className = 'oos-box';
      oosBox.textContent = 'НЕТ В НАЛИЧИИ';
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

  console.log('[renderGrid] rendered', items.length, 'items');
}

function openModal(product) {
  const modal = getModalRoot();
  if (!modal) {
    console.warn('[modal] not found');
    return;
  }
  hideCartPopup();
  activeProduct = product;

  const modalContent = modal.querySelector('.modal-content');
  const modalImage = modal.querySelector('.modal-image');
  const modalTitle = modal.querySelector('.modal-title');
  const modalDescription = modal.querySelector('.modal-description');
  const modalPrice = modal.querySelector('.modal-price');
  const modalQtyInput = modal.querySelector('.qty-input');
  const modalQtyRow = modal.querySelector('.qty-row');
  const modalAddButton = modal.querySelector('.modal-add, .btn-add, [data-action="add-to-cart"]');
  const modalCloseButton = modal.querySelector('.modal-close, [data-action="close-modal"]');

  const primaryImage = product.images && product.images.length > 0 ? product.images[0] : './0.png';
  if (modalImage) {
    modalImage.src = primaryImage;
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

  if (modalQtyInput instanceof HTMLInputElement) {
    if (canAddToCart) {
      modalQtyInput.disabled = false;
      modalQtyInput.removeAttribute('disabled');
      modalQtyInput.min = '1';
      modalQtyInput.max = String(Math.max(1, remaining));
      modalQtyInput.value = '1';
    } else {
      modalQtyInput.disabled = true;
      modalQtyInput.setAttribute('disabled', 'disabled');
      modalQtyInput.min = '0';
      modalQtyInput.max = '0';
      modalQtyInput.value = '0';
    }
  }

  if (modalQtyRow instanceof HTMLElement) {
    modalQtyRow.style.display = canAddToCart ? 'inline-flex' : 'none';
  }

  if (modalAddButton instanceof HTMLElement) {
    modalAddButton.style.display = canAddToCart ? '' : 'none';
    modalAddButton.classList.toggle('disabled', !canAddToCart);
    if (canAddToCart) {
      modalAddButton.removeAttribute('disabled');
    } else {
      modalAddButton.setAttribute('disabled', 'disabled');
    }
  }

  if (modalContent) {
    modalContent.querySelectorAll('.oos-box').forEach((node) => node.remove());
    if (!canAddToCart) {
      const oosBox = document.createElement('div');
      oosBox.className = 'oos-box';
      oosBox.textContent = 'НЕТ В НАЛИЧИИ';
      if (modalQtyRow && modalQtyRow.parentNode) {
        modalQtyRow.insertAdjacentElement('afterend', oosBox);
      } else {
        modalContent.appendChild(oosBox);
      }
    }
  }

  wireModalEvents(product);

  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  if (canAddToCart) {
    (modalAddButton instanceof HTMLElement ? modalAddButton : modal.querySelector('.modal-add'))?.focus();
  } else {
    (modalCloseButton instanceof HTMLElement ? modalCloseButton : modal.querySelector('.modal-close'))?.focus();
  }
}

function wireModalEvents(product) {
  const modal = getModalRoot();
  if (!modal) {
    return;
  }

  modal.querySelectorAll('.modal-close, [data-action="close-modal"]').forEach((btn) => {
    if (btn instanceof HTMLElement) {
      btn.onclick = (event) => {
        event.preventDefault();
        closeModal();
      };
    }
  });

  const overlayTarget = getModalOverlay(modal) || modal;
  if (overlayTarget) {
    overlayTarget.onclick = (event) => {
      if (event.target === overlayTarget) {
        closeModal();
      }
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

  const qtyInput = modal.querySelector('.qty-input');
  const btnInc = modal.querySelector('[data-action="inc"]');
  const btnDec = modal.querySelector('[data-action="dec"]');

  let clampValue = (value) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 1;
    }
    return Math.trunc(numeric);
  };

  if (qtyInput instanceof HTMLInputElement) {
    const isDisabled = qtyInput.disabled || qtyInput.hasAttribute('disabled');
    const minAttr = Number(qtyInput.min);
    const rawMin = Number.isFinite(minAttr) ? Math.trunc(minAttr) : 1;
    const min = isDisabled ? Math.max(0, rawMin) : Math.max(1, rawMin || 1);
    const maxAttr = Number(qtyInput.max);
    const rawMax = Number.isFinite(maxAttr) ? Math.trunc(maxAttr) : Infinity;
    const max = Number.isFinite(rawMax) ? Math.max(min, rawMax) : Infinity;

    clampValue = (value) => {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(numeric)) {
        return min;
      }
      const truncated = Math.trunc(numeric);
      const bounded = Math.min(max, Math.max(min, truncated));
      return bounded;
    };

    qtyInput.value = String(clampValue(qtyInput.value));
    if (!isDisabled && max !== 0) {
      if (btnInc instanceof HTMLElement) {
        btnInc.onclick = (event) => {
          event.preventDefault();
          qtyInput.value = String(clampValue(Number(qtyInput.value) + 1));
        };
      }
      if (btnDec instanceof HTMLElement) {
        btnDec.onclick = (event) => {
          event.preventDefault();
          qtyInput.value = String(clampValue(Number(qtyInput.value) - 1));
        };
      }
      qtyInput.oninput = () => {
        qtyInput.value = String(clampValue(qtyInput.value));
      };
    } else {
      if (btnInc instanceof HTMLElement) {
        btnInc.onclick = null;
      }
      if (btnDec instanceof HTMLElement) {
        btnDec.onclick = null;
      }
      qtyInput.oninput = null;
    }
  } else {
    if (btnInc instanceof HTMLElement) {
      btnInc.onclick = null;
    }
    if (btnDec instanceof HTMLElement) {
      btnDec.onclick = null;
    }
  }

  const addBtn = modal.querySelector('.modal-add, .btn-add, [data-action="add-to-cart"]');
  if (addBtn instanceof HTMLElement) {
    addBtn.onclick = (event) => {
      event.preventDefault();
      if (!product) {
        return;
      }
      if (qtyInput instanceof HTMLInputElement && (qtyInput.disabled || qtyInput.hasAttribute('disabled'))) {
        return;
      }
      const quantity = clampValue(qtyInput instanceof HTMLInputElement ? qtyInput.value : 1);
      if (quantity <= 0) {
        return;
      }
      addToCart(product, quantity);
      updateCartCount();
      closeModal();
      showToast('Товар добавлен в корзину');
    };
  }
}

function closeModal() {
  const modal = getModalRoot();
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
      const safeImage = escapeHtml(item.image || './0.png');
      const lineTotal = formatPrice(item.price * item.qty);
      return `
        <article class="cart-item" data-id="${safeId}">
          <img src="${safeImage}" alt="${safeTitle}">
          <div class="cart-item-body">
            <p class="title">${safeTitle}</p>
            <p class="price">${formatPrice(item.price)}</p>
            <div class="controls">
              <button type="button" data-action="dec" aria-label="Уменьшить количество товара ${safeTitle}">−</button>
              <input type="number" data-role="qty" min="1" value="${item.qty}" aria-label="Количество товара ${safeTitle}">
              <button type="button" data-action="inc" aria-label="Увеличить количество товара ${safeTitle}">+</button>
            </div>
          </div>
          <div class="cart-item-total">
            <span class="line-total">${lineTotal}</span>
            <button type="button" data-action="remove" aria-label="Удалить товар ${safeTitle}">✕</button>
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
        <label for="custTelegram">Telegram <span class="field-hint">(необязательно — заполните, если предпочитаете связь в Telegram)</span></label>
        <input type="text" id="custTelegram" placeholder="username (автодобавим @)" value="${escapeHtml(cartFormState.telegram)}">
      </div>
      <div class="row">
        <label for="custComment">Комментарий к заказу (необязательно)</label>
        <textarea id="custComment" placeholder="До 200 символов" maxlength="200" rows="3">${escapeHtml(cartFormState.comment)}</textarea>
      </div>
      <div class="delivery-info">Доставка за счёт покупателя, детали доставки обсуждаются после подтверждения заказа.</div>
      <div class="consent-row">
        <input type="checkbox" id="privacyConsent" ${cartFormState.consent ? 'checked' : ''}>
        <label for="privacyConsent">
          Согласен с <a href="#footer-privacy">Privacy Policy</a>
        </label>
      </div>
    </div>
    <div class="cart-actions">
      <button type="button" id="orderBtn" data-action="checkout" disabled>Оформить заказ</button>
      <button type="button" class="secondary" data-action="clear">Очистить корзину</button>
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
    const incButton = cartItemElement.querySelector('[data-action="inc"]');
    if (incButton instanceof HTMLButtonElement) {
      incButton.disabled = stock <= item.qty;
      incButton.classList.toggle('disabled', incButton.disabled);
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

  if (!nameInput || !emailInput || !orderBtn) {
    return;
  }

  const ensureTelegramPrefix = () => {
    if (!telegramInput) {
      return;
    }
    const value = telegramInput.value || '';
    if (value.trim() === '') {
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
      telegram: telegramInput?.value ?? '',
      comment: commentInput?.value ?? '',
      consent: !!consentInput?.checked,
    };
  };

  const updateSubmitState = () => {
    const ready =
      nameInput.value.trim().length > 0 &&
      isEmailValid(emailInput.value ?? '') &&
      !!consentInput?.checked;
    orderBtn.disabled = !ready;
  };

  orderBtn.disabled = true;

  if (telegramInput) {
    telegramInput.addEventListener('focus', () => {
      if (telegramInput.value.trim() === '') {
        telegramInput.value = '@';
        updateFormState();
        updateSubmitState();
      }
    });
    telegramInput.addEventListener('input', () => {
      ensureTelegramPrefix();
      updateFormState();
      updateSubmitState();
    });
    ensureTelegramPrefix();
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
}

function addToCart(product, quantity = 1) {
  const remaining = getRemainingForAdd(product.id);
  if (remaining <= 0) {
    return;
  }
  const qtyToAdd = Math.min(Math.max(1, Number(quantity) || 1), remaining);
  if (qtyToAdd <= 0) {
    return;
  }
  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.qty += qtyToAdd;
  } else {
    const primaryImage = product.images && product.images.length > 0 ? product.images[0] : './0.png';
    cart.push({
      id: product.id,
      title: product.title,
      price: product.price,
      image: primaryImage,
      qty: qtyToAdd,
    });
  }
  saveCart(cart);
  updateCartCount(cart);
  renderCart();
}

function updateQty(productId, newQty) {
  const stock = getStock(productId);
  const item = cart.find((entry) => entry.id === productId);
  if (!item) {
    return;
  }
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

async function submitOrder() {
  const orderBtn = cartPopup?.querySelector('#orderBtn');
  if (!orderBtn || orderBtn.disabled) {
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
  if (telegram === '@') {
    telegram = '';
  }

  cartFormState = {
    name,
    email,
    telegram,
    comment,
    consent: !!consentInput?.checked,
  };

  const lines = [];
  lines.push('Заявка NEW GRGY TIMES');
  lines.push('---');
  lines.push('Состав заказа:');
  cart.forEach((item, index) => {
    const sum = item.price * item.qty;
    lines.push(`${index + 1}) ${item.title} × ${item.qty} – ${item.price.toLocaleString('ru-RU')} ₽ = ${sum.toLocaleString('ru-RU')} ₽`);
  });
  lines.push('---');
  lines.push(`Сумма заказа: ${getCartTotal(cart).toLocaleString('ru-RU')} ₽`);
  lines.push('');
  lines.push('Контакты:');
  lines.push(`Имя: ${name}`);
  lines.push(`Email: ${email}`);
  lines.push(`Telegram: ${telegram || '-'}`);
  if (comment) {
    lines.push(`Комментарий: ${comment}`);
  }

  const formData = new FormData();
  formData.append('access_key', WEB3FORMS_ACCESS_KEY);
  formData.append('subject', 'Заявка NEW GRGY TIMES');
  formData.append('from_name', 'NEW GRGY TIMES Store');
  formData.append('replyto', email);
  formData.append('email', 'grgyone@gmail.com');
  formData.append('message', lines.join('\n'));

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
        inv[item.id] = Math.max(0, (inv[item.id] ?? 0) - item.qty);
      });
      saveInventoryObj(inv);

      saveCart([]);
      cart = [];
      cartFormState = { ...defaultFormState };
      updateCartCount(cart);
      renderCart();
      renderGrid(products);
      showToast('Заявка отправлена');
      console.log('[order] inventory updated and cart cleared');

      const form = document.getElementById('cartForm');
      if (form) form.reset();
      return;
    }

    showToast('Не удалось отправить заявку, попробуйте позже');
    console.error('Web3Forms error:', data);
  } catch (error) {
    console.error('Web3Forms request failed:', error);
    showToast('Не удалось отправить заявку, попробуйте позже');
  } finally {
    const consentChecked = !!consentInput?.checked;
    const ready =
      name.length > 0 &&
      /\S+@\S+\.\S+/.test(email) &&
      consentChecked;
    orderBtn.disabled = !ready;
  }
}

function handleCartPopupClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  if (!action) {
    return;
  }

  if (action === 'checkout') {
    submitOrder();
    return;
  }

  if (action === 'clear') {
    clearCart();
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

  const item = cart.find((entry) => entry.id === productId);
  if (!item) {
    return;
  }

  if (action === 'inc') {
    const stock = getStock(productId);
    const nextQty = Math.min(item.qty + 1, stock);
    updateQty(productId, nextQty);
    return;
  }

  if (action === 'dec') {
    updateQty(productId, item.qty - 1);
    return;
  }

  if (action === 'remove') {
    removeFromCart(productId);
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

  const stock = getStock(productId);
  if (stock <= 0) {
    removeFromCart(productId);
    return;
  }

  const parsedQty = Number.parseInt(target.value, 10);
  if (Number.isNaN(parsedQty) || parsedQty <= 0) {
    removeFromCart(productId);
    return;
  }

  const clampedQty = Math.min(parsedQty, stock);
  target.value = String(clampedQty);
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
  return `${Number(value).toLocaleString('ru-RU')} ₽`;
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

  setTimeout(() => {
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
