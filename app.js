document.addEventListener('DOMContentLoaded', () => {
  const placeholderDescription =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum tristique.';

  const products = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    title: `Product #${index + 1}`,
    price: 9999,
    image: './0.png',
    description: placeholderDescription,
  }));

  const CART_STORAGE_KEY = 'cart';
  const CART_TRANSITION_MS = 200;

  const grid = document.getElementById('grid');
  const modal = document.getElementById('modal');
  const modalImage = modal.querySelector('.modal-image');
  const modalTitle = modal.querySelector('.modal-title');
  const modalDescription = modal.querySelector('.modal-description');
  const modalPrice = modal.querySelector('.modal-price');
  const modalAddButton = modal.querySelector('.modal-add');
  const modalCloseButton = modal.querySelector('.modal-close');

  const cartPopup = document.getElementById('cart-popup');
  const cartButton = document.querySelector('.cart-button');
  const cartTrigger = cartButton || document.querySelector('.cart-icon');
  const cartCountElement = document.querySelector('.cart-count');

  let activeProduct = null;
  let cart = loadCart();
  let cartHideTimeout = null;

  renderProducts();
  renderCart();

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map((item) => ({
          id: Number(item.id),
          title: String(item.title || ''),
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

  function getCartCount(currentCart) {
    return currentCart.reduce((sum, item) => sum + item.qty, 0);
  }

  function getCartTotal(currentCart) {
    return currentCart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  function formatPrice(value) {
    return `${Number(value).toLocaleString('ru-RU')} ₽`;
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
    const count = getCartCount(cart);
    cartCountElement.textContent = String(count);

    if (!cartPopup) {
      return;
    }

    if (!cart.length) {
      cartPopup.innerHTML = '<p class="cart-empty">Корзина пуста</p>';
      return;
    }

    const itemsMarkup = cart
      .map(
        (item) => `
        <article class="cart-item" data-id="${item.id}">
          <img src="${item.image}" alt="${item.title}">
          <div class="cart-item-body">
            <p class="title">${item.title}</p>
            <p class="price">${formatPrice(item.price)}</p>
            <div class="controls">
              <button type="button" data-action="dec" aria-label="Уменьшить количество товара ${item.title}">−</button>
              <input type="number" data-role="qty" min="1" value="${item.qty}" aria-label="Количество товара ${item.title}">
              <button type="button" data-action="inc" aria-label="Увеличить количество товара ${item.title}">+</button>
            </div>
          </div>
          <div class="cart-item-total">
            <span class="line-total">${formatPrice(item.price * item.qty)}</span>
            <button type="button" data-action="remove" aria-label="Удалить товар ${item.title}">✕</button>
          </div>
        </article>`
      )
      .join('');

    const total = formatPrice(getCartTotal(cart));

    cartPopup.innerHTML = `
      <div class="cart-items" role="list">
        ${itemsMarkup}
      </div>
      <div class="cart-summary">
        <span>Сумма товаров:</span>
        <strong>${total}</strong>
      </div>
      <div class="cart-actions">
        <button type="button" data-action="checkout">Оформить заказ</button>
        <button type="button" class="secondary" data-action="clear">Очистить корзину</button>
      </div>
    `;
  }

  function addToCart(product) {
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        qty: 1,
      });
    }
    saveCart(cart);
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
    renderCart();
  }

  function removeFromCart(productId) {
    cart = cart.filter((entry) => entry.id !== productId);
    saveCart(cart);
    renderCart();
  }

  function clearCart() {
    cart = [];
    saveCart(cart);
    renderCart();
  }

  function openModal(product) {
    hideCartPopup();
    activeProduct = product;
    modalImage.src = product.image;
    modalImage.alt = product.title;
    modalTitle.textContent = product.title;
    modalDescription.textContent = product.description;
    modalPrice.textContent = formatPrice(product.price);
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    modalAddButton.focus();
  }

  function closeModal() {
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

  modalAddButton.addEventListener('click', () => {
    if (!activeProduct) {
      return;
    }
    addToCart(activeProduct);
    closeModal();
    renderCart();
    showCartPopup();
  });

  modalCloseButton.addEventListener('click', closeModal);

  modal.addEventListener('click', (event) => {
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
      if (!modal.classList.contains('hidden')) {
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
      alert('Заявка отправлена!');
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
