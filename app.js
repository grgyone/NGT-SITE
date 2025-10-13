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
    phone: '',
    delivery: 'pickup',
    address: '',
    comment: '',
  };

  let cart = loadCart();
  let activeProduct = null;
  let cartHideTimeout = null;
  let toastTimeout = null;
  let cartFormState = { ...defaultFormState };

  updateCartCount(cart);

  if (grid) {
    renderProducts();
  }
  renderCart();

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

  function getCartTotal(currentCart) {
    return currentCart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  function formatPrice(value) {
    return `${Number(value).toLocaleString('ru-RU')} ₽`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      phone: form.querySelector('#custPhone')?.value ?? cartFormState.phone,
      delivery: form.querySelector('input[name="delivery"]:checked')?.value ?? cartFormState.delivery,
      address: form.querySelector('#custAddress')?.value ?? cartFormState.address,
      comment: form.querySelector('#custComment')?.value ?? cartFormState.comment,
    };
  }

  function resetFormState() {
    cartFormState = { ...defaultFormState };
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

    const total = formatPrice(getCartTotal(cart));
    const isCourier = cartFormState.delivery === 'courier';

    cartPopup.innerHTML = `
      <div class="cart-items" role="list">
        ${itemsMarkup}
      </div>
      <div class="cart-summary">
        <span>Сумма товаров:</span>
        <strong>${total}</strong>
      </div>
      <div class="cart-form" id="cartForm">
        <div class="row">
          <label for="custName">Имя *</label>
          <input type="text" id="custName" placeholder="Ваше имя" value="${escapeHtml(cartFormState.name)}" required>
        </div>
        <div class="row">
          <label for="custPhone">Телефон *</label>
          <input type="tel" id="custPhone" placeholder="+7..." value="${escapeHtml(cartFormState.phone)}" required>
        </div>
        <div class="row">
          <label>Способ доставки</label>
          <div class="radios">
            <label><input type="radio" name="delivery" value="pickup" ${isCourier ? '' : 'checked'}> ПВЗ</label>
            <label><input type="radio" name="delivery" value="courier" ${isCourier ? 'checked' : ''}> Курьер</label>
          </div>
          <div class="delivery-note" id="deliveryNoteCommon">Доставка оплачивается отдельно.</div>
          <div class="delivery-note subtle" id="deliveryNotePvz" style="display: ${isCourier ? 'none' : 'block'};">При выборе ПВЗ стоимость доставки оплачивается отдельно при получении/по тарифу.</div>
        </div>
        <div class="row" id="addressRow" style="display: ${isCourier ? 'block' : 'none'};">
          <label for="custAddress">Город/Адрес</label>
          <input type="text" id="custAddress" placeholder="Город, улица, дом" value="${escapeHtml(cartFormState.address)}">
        </div>
        <div class="row">
          <label for="custComment">Комментарий</label>
          <textarea id="custComment" rows="3" placeholder="Комментарии к заказу">${escapeHtml(cartFormState.comment)}</textarea>
        </div>
      </div>
      <div class="cart-hint">
        После нажатия «Оформить заказ» текст заявки будет скопирован в буфер обмена — просто вставьте его в сообщение в Telegram.
      </div>
      <div class="cart-actions">
        <button type="button" data-action="checkout">Оформить заказ</button>
        <button type="button" class="secondary" data-action="clear">Очистить корзину</button>
      </div>
    `;

    setupCartForm();
  }

  function setupCartForm() {
    const form = cartPopup.querySelector('#cartForm');
    if (!form) {
      return;
    }

    const nameInput = form.querySelector('#custName');
    const phoneInput = form.querySelector('#custPhone');
    const addressInput = form.querySelector('#custAddress');
    const commentInput = form.querySelector('#custComment');
    const addressRow = form.querySelector('#addressRow');
    const deliveryRadios = Array.from(form.querySelectorAll('input[name="delivery"]'));
    const notePvz = form.querySelector('#deliveryNotePvz');

    const updateFormState = () => {
      cartFormState = {
        name: nameInput?.value ?? '',
        phone: phoneInput?.value ?? '',
        delivery: form.querySelector('input[name="delivery"]:checked')?.value ?? 'pickup',
        address: addressInput?.value ?? '',
        comment: commentInput?.value ?? '',
      };
    };

    const toggleDeliveryNotes = () => {
      const selected = form.querySelector('input[name="delivery"]:checked');
      const isCourier = selected && selected.value === 'courier';
      if (addressRow) {
        addressRow.style.display = isCourier ? 'block' : 'none';
      }
      if (notePvz) {
        notePvz.style.display = isCourier ? 'none' : 'block';
      }
      updateFormState();
    };

    deliveryRadios.forEach((radio) => {
      radio.addEventListener('change', toggleDeliveryNotes);
    });

    [nameInput, phoneInput, addressInput, commentInput].forEach((input) => {
      if (!input) {
        return;
      }
      input.addEventListener('input', () => {
        input.classList.remove('input-error');
        updateFormState();
      });
    });

    form.addEventListener('input', updateFormState);
    form.addEventListener('change', updateFormState);

    toggleDeliveryNotes();
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
    resetFormState();
    renderCart();
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

  function isCartPopupVisible() {
    return cartPopup && !cartPopup.classList.contains('hidden');
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
    if (!cart.length) {
      showToast('Корзина пуста');
      return;
    }

    const form = cartPopup.querySelector('#cartForm');
    if (!form) {
      return;
    }

    const nameInput = form.querySelector('#custName');
    const phoneInput = form.querySelector('#custPhone');
    const addressInput = form.querySelector('#custAddress');
    const commentInput = form.querySelector('#custComment');
    const deliveryRadio = form.querySelector('input[name="delivery"]:checked');

    const requiredInputs = [nameInput, phoneInput];
    let hasError = false;

    requiredInputs.forEach((input) => {
      if (!input) {
        return;
      }
      input.classList.remove('input-error');
      if (!input.value.trim()) {
        input.classList.add('input-error');
        hasError = true;
      }
    });

    if (hasError) {
      alert('Заполните обязательные поля');
      nameInput?.focus();
      return;
    }

    const name = nameInput?.value.trim() ?? '';
    const phone = phoneInput?.value.trim() ?? '';
    const delivery = deliveryRadio?.value === 'courier' ? 'courier' : 'pickup';
    const address = delivery === 'courier' ? (addressInput?.value.trim() ?? '') : '';
    const comment = commentInput?.value.trim() ?? '';
    const total = formatPrice(getCartTotal(cart));

    cartFormState = {
      name,
      phone,
      delivery,
      address,
      comment,
    };

    const itemsText = cart
      .map((item, index) => {
        const lineTotal = formatPrice(item.price * item.qty);
        return `${index + 1}) ${item.title} — ${item.qty} × ${formatPrice(item.price)} = ${lineTotal}`;
      })
      .join('\n');

    const orderLines = [
      'Заявка NEW GRGY TIMES',
      '---',
      'Товары:',
      itemsText,
      '---',
      `Сумма товаров: ${total}`,
      '',
      'Клиент:',
      `Имя: ${name}`,
      `Телефон: ${phone}`,
      `Доставка: ${delivery === 'courier' ? 'Курьер' : 'ПВЗ'}`,
    ];

    if (delivery === 'courier') {
      orderLines.push(`Адрес: ${address || '—'}`);
    }

    orderLines.push(`Комментарий: ${comment || '—'}`);

    const orderText = orderLines.join('\n');

    try {
      await navigator.clipboard.writeText(orderText);
      showToast('Заявка скопирована, откройте Telegram');
    } catch (error) {
      console.error('Не удалось скопировать заявку в буфер обмена:', error);
      showToast('Не удалось скопировать, скопируйте заявку вручную');
    }

    window.open('https://t.me/grgyone', '_blank', 'noopener');
  }

  if (modalAddButton) {
    modalAddButton.addEventListener('click', () => {
      if (!activeProduct) {
        return;
      }
      const { min, max } = getModalQtyLimits();
      const quantity = clampQuantity(modalQtyInput?.value ?? '1', min, max);
      addToCart(activeProduct, quantity);
      closeModal();
      showCartPopup();
    });
  }

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

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  if (cartTrigger && cartPopup) {
    cartTrigger.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleCartPopup();
    });
  }

  if (cartPopup) {
    cartPopup.addEventListener('click', (event) => {
      event.stopPropagation();
      handleCartPopupClick(event);
    });
    cartPopup.addEventListener('change', (event) => {
      event.stopPropagation();
      handleCartPopupChange(event);
    });
  }

  document.addEventListener('click', (event) => {
    if (!cartPopup || cartPopup.classList.contains('hidden')) {
      return;
    }
    const clickedInsidePopup = cartPopup.contains(event.target);
    const clickedOnTrigger =
      cartTrigger && cartTrigger.contains(event.target);
    if (!clickedInsidePopup && !clickedOnTrigger) {
      hideCartPopup();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!modal?.classList.contains('hidden')) {
        closeModal();
      }
      if (isCartPopupVisible()) {
        hideCartPopup();
      }
    }
  });

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
      submitOrder().catch((error) => {
        console.error('Ошибка при оформлении заказа:', error);
        showToast('Не удалось подготовить заявку');
      });
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
