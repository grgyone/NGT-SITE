document.addEventListener('DOMContentLoaded', () => {
  const products = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    title: `Product #${index + 1}`,
    priceLabel: '9 999 ₽',
    image: './0.png',
  }));

  const grid = document.getElementById('grid');

  products.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'product-card';

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
  });
});
