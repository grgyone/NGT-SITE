// TODO: замените на свой ключ из https://web3forms.com/
const WEB3FORMS_ACCESS_KEY = '97052283-3d2d-46b2-86ca-c21f81998914';

document.addEventListener('DOMContentLoaded', () => {
  const placeholderDescription =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum tristique.';

  const products = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    title: `Product #${index + 1}`,
    price: 9_999,
    image: './0.png',
    description: placeholderDescription,
    stock: 5 + (index % 5) * 3,
  }));

  const CART_STORAGE_KEY = 'cart';
  const CART_TRANSITION_MS = 200;

  const grid = document.getElementById('grid');
  const modal = document.getElementById('modal');
  const modalImage = modal?.querySelector('.modal-image');
  const modalTitle = modal?.querySelector('.modal-title');
  const modalDescription = modal?.querySelector('.modal-description');
  const modalPrice = modal?.querySelector('.modal-price');
  const modalAddButton = modal?.querySelector('.modal-add');
  const modalCloseButton = modal?.querySelector('.modal-close');
  const modalQtyInput = modal?.querySelector('.qty-input');
  const modalQtyButtons = modal ? Array.from(modal.querySelectorAll('.qty-btn')) : [];

  const cartPopup = document.getElementById('cart-popup');
  const cartTrigger = document.querySelector('.cart-icon');
  const cartCountElement = document.getElementById('cart-count');
  const toastElement = document.getElementById('toast');

  const defaultFormState = {
    name: '',
    email: '',
    telegram: '',
    consent: false,
  };

  let cart = loadCart();
  let cartFormState = { ...defaultFormState };
  let activeProduct = null;
  let cartHideTimeout = null;
  let toastTimeout = null;

  updateCartCount(cart);

  if (grid) {
    renderProducts();
  }
  renderCart();

  modalAddButton?.addEventListener('click', () => {
    if (!activeProduct) {
      return;
    }
    const { min, max } = getModalQtyLimits();
    const quantity = clampQuantity(modalQtyInput?.value ?? '1', min, max);
    addToCart(activeProduct, quantity);
    closeModal();
    showToast('Товар добавлен в корзину');
  });

  modalCloseButton?.addEventListener('click', closeModal);

  modalQtyButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const { action } = button.dataset;
      const { min, max } = getModalQtyLimits();
      const currentValue = clampQuantity(modalQtyInput?.value ?? '1', min, max);
      const delta = action === 'inc' ? 1 : -1;
      setModalQuantity(currentValue + delta);
    });
  });

  modalQtyInput?.addEventListener('input', () => {
    setModalQuantity(modalQtyInput.value);
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
      if (modal && !modal.classList.contains('hidden')) {
        closeModal();
      } else if (isCartPopupVisible()) {
        hideCartPopup();
      }
    }
  });

  function loadCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map((item) => ({
          id: Number(item.id),
          title: typeof item.title === 'string' ? item.title : '',
          price: Number(item.price) || 0,
          image: typeof item.image === 'string' ? item.image : './0.png',
          qty: Number(item.qty) || 0,
        }))
        .filter((item) => Number.isFinite(item.id) && item.id > 0 && item.qty > 0);
    } catch (error) {
      console.warn('Не удалось загрузить корзину:', error);
      return [];
    }
  }

  function saveCart(currentCart) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(currentCart));
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

  function getCartTotal(currentCart = cart) {
    return currentCart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  function formatPrice(value) {
    return `${Number(value).toLocaleString('ru-RU')} ₽`;
  }

  function showToast(message, duration = 2000) {
    if (!toastElement) {
      return;
    }
    toastElement.textContent = message;
    toastElement.classList.remove('show');
    void toastElement.offsetHeight;
    toastElement.classList.add('show');
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    toastTimeout = window.setTimeout(() => {
      toastElement.classList.remove('show');
    }, duration);
  }

  function captureFormState() {
    if (!cartPopup) {
      return;
    }
    const form = cartPopup.querySelector('#cartForm');
    if (!form) {
      return;
    }
    cartFormState = {
      name: form.querySelector('#custName')?.value ?? cartFormState.name,
      email: form.querySelector('#custEmail')?.value ?? cartFormState.email,
      telegram: form.querySelector('#custTelegram')?.value ?? cartFormState.telegram,
      consent: !!form.querySelector('#privacyConsent')?.checked,
    };
  }

  function resetFormState() {
    cartFormState = { ...defaultFormState };
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderProducts() {
    products.forEach((product) => {
      const card = document.createElement('article');
      card.className = 'product-card';
      card.tabIndex = 0;

      const imageWrapper = document.createElement('div');
      imageWrapper.className = 'product-image-wrapper';

      const image = document.createElement('img');
      image.className = 'product-image';
      image.src = product.image;
      image.alt = product.title;

      const title = document.createElement('h2');
      title.className = 'product-title';
      title.textContent = product.title;

      const price = document.createElement('p');
      price.className = 'product-price';
      price.textContent = formatPrice(product.price);

      imageWrapper.appendChild(image);
      card.appendChild(imageWrapper);
      card.appendChild(title);
      card.appendChild(price);
      grid.appendChild(card);

      const handleOpen = () => openModal(product);

      card.addEventListener('click', handleOpen);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleOpen();
        }
      });
    });
  }

  function clampQuantity(value, min = 1, max = Infinity) {
    const numeric = Number.parseInt(value, 10);
    if (Number.isNaN(numeric)) {
      return min;
    }
    return Math.min(Math.max(numeric, min), max);
  }

  function getModalQtyLimits() {
    const min = Number(modalQtyInput?.min) || 1;
    const maxAttr = modalQtyInput?.getAttribute('max');
    const max = maxAttr ? Number(maxAttr) || min : Infinity;
    return { min, max };
  }

  function setModalQuantity(value) {
    if (!modalQtyInput) {
      return 1;
    }
    const { min, max } = getModalQtyLimits();
    const clamped = clampQuantity(value, min, max);
    modalQtyInput.value = String(clamped);
    return clamped;
  }

  function openModal(product) {
    if (!modal) {
      return;
    }
    hideCartPopup();
    activeProduct = product;

    if (modalImage) {
      modalImage.src = product.image;
      modalImage.alt = product.title;
    }
    if (modalTitle) {
      modalTitle.textContent = product.title;
    }
    if (modalDescription) {
      modalDescription.textContent = product.description;
    }
    if (modalPrice) {
      modalPrice.textContent = formatPrice(product.price);
    }

    if (modalQtyInput) {
      modalQtyInput.value = '1';
      modalQtyInput.min = '1';
      if (typeof product.stock === 'number' && product.stock > 0) {
        modalQtyInput.max = String(product.stock);
      } else {
        modalQtyInput.removeAttribute('max');
      }
    }

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    modalAddButton?.focus();
  }

  function closeModal() {
    if (!modal) {
      return;
    }
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    activeProduct = null;
  }

  function renderCart() {
    updateCartCount(cart);

    if (!cartPopup) {
      return;
    }

    captureFormState();

    if (!cart.length) {
      resetFormState();
      cartPopup.innerHTML = '<p class="cart-empty">Корзина пуста</p>';
      return;
    }

    const itemsMarkup = cart
      .map((item) => {
        const safeTitle = escapeHtml(item.title);
        const lineTotal = formatPrice(item.price * item.qty);
        return `
        <article class="cart-item" data-id="${item.id}">
          <img src="${escapeHtml(item.image)}" alt="${safeTitle}">
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
        <div class="delivery-info">
          Доставка за счёт покупателя, детали доставки обсуждаются после подтверждения заказа.
        </div>
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

    setupCartForm();
  }

  function setupCartForm() {
    if (!cartPopup) {
      return;
    }

    const nameInput = cartPopup.querySelector('#custName');
    const emailInput = cartPopup.querySelector('#custEmail');
    const telegramInput = cartPopup.querySelector('#custTelegram');
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
    const qtyToAdd = Math.max(1, Number(quantity) || 1);
    const maxStock = typeof product.stock === 'number' && product.stock > 0 ? product.stock : Infinity;
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.qty = Math.min(existing.qty + qtyToAdd, maxStock);
    } else {
      cart.push({
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        qty: Math.min(qtyToAdd, maxStock),
      });
    }
    saveCart(cart);
    updateCartCount(cart);
    renderCart();
  }

  function updateQty(productId, newQty) {
    const item = cart.find((entry) => entry.id === productId);
    if (!item) {
      return;
    }
    if (newQty <= 0) {
      cart = cart.filter((entry) => entry.id !== productId);
    } else {
      item.qty = newQty;
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

    let currentCart = loadCart();
    cart = currentCart;
    if (!currentCart || !currentCart.length) {
      showToast('Корзина пуста');
      return;
    }

    const nameInput = document.getElementById('custName');
    const emailInput = document.getElementById('custEmail');
    const telegramInput = document.getElementById('custTelegram');
    const consentInput = document.getElementById('privacyConsent');

    const name = (nameInput?.value || '').trim();
    const email = (emailInput?.value || '').trim();
    let telegram = (telegramInput?.value || '').trim();
    if (telegram === '@') {
      telegram = '';
    }

    cartFormState = {
      name,
      email,
      telegram,
      consent: !!consentInput?.checked,
    };

    const lines = [];
    lines.push('Заявка NEW GRGY TIMES');
    lines.push('---');
    lines.push('Товары:');
    currentCart.forEach((item, index) => {
      const sum = item.price * item.qty;
      lines.push(`${index + 1}) ${item.title} — ${item.qty} × ${item.price.toLocaleString('ru-RU')} ₽ = ${sum.toLocaleString('ru-RU')} ₽`);
    });
    lines.push('---');
    lines.push(`Сумма товаров: ${getCartTotal(currentCart).toLocaleString('ru-RU')} ₽`);
    lines.push('');
    lines.push('Клиент:');
    lines.push(`Имя: ${name}`);
    lines.push(`Email: ${email}`);
    lines.push(`Telegram: ${telegram || '-'}`);

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
        showToast('Заявка отправлена');
      } else {
        showToast('Не удалось отправить заявку, попробуйте позже');
        console.error('Web3Forms error:', data);
      }
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

    const productId = Number(itemElement.dataset.id);
    if (!Number.isFinite(productId)) {
      return;
    }

    const item = cart.find((entry) => entry.id === productId);
    if (!item) {
      return;
    }

    if (action === 'inc') {
      updateQty(productId, item.qty + 1);
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

    const productId = Number(itemElement.dataset.id);
    if (!Number.isFinite(productId)) {
      return;
    }

    const parsedQty = Number.parseInt(target.value, 10);
    if (Number.isNaN(parsedQty) || parsedQty <= 0) {
      updateQty(productId, 1);
      return;
    }

    updateQty(productId, parsedQty);
  }
});
