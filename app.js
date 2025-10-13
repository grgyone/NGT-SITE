document.addEventListener('DOMContentLoaded', () => {
  const placeholderDescription =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum tristique.';

  const products = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    title: `Product #${index + 1}`,
    priceLabel: '9 999 ₽',
    image: './0.png',
    description: placeholderDescription,
  }));

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
  const CART_TRANSITION_MS = 200;
  let cartHideTimeout = null;

  const isCartPopupVisible = () =>
    cartPopup && !cartPopup.classList.contains('hidden');

  const showCartPopup = () => {
    if (!cartPopup || isCartPopupVisible()) {
      return;
    }
    clearTimeout(cartHideTimeout);
    cartPopup.classList.remove('hidden');
    requestAnimationFrame(() => {
      cartPopup.classList.add('active');
    });
  };

  const hideCartPopup = () => {
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
  };

  const toggleCartPopup = () => {
    if (isCartPopupVisible()) {
      hideCartPopup();
    } else {
      showCartPopup();
    }
  };

  const openModal = (product) => {
    hideCartPopup();
    modalImage.src = product.image;
    modalImage.alt = product.title;
    modalTitle.textContent = product.title;
    modalDescription.textContent = product.description;
    modalPrice.textContent = product.priceLabel;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    modalAddButton.focus();
  };

  const closeModal = () => {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  };

  products.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.tabIndex = 0;

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'product-image-wrapper';

    const image = document.createElement('img');
    image.className = 'product-image';
    image.src = product.image;
    image.alt = `${product.title}`;

    const title = document.createElement('h2');
    title.className = 'product-title';
    title.textContent = product.title;

    const price = document.createElement('p');
    price.className = 'product-price';
    price.textContent = product.priceLabel;

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

  if (cartTrigger && cartPopup) {
    cartTrigger.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleCartPopup();
    });
  }

  if (cartPopup) {
    cartPopup.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  }

  modalCloseButton.addEventListener('click', closeModal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

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
});
