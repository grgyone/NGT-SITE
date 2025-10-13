import { useCallback, useEffect, useMemo, useState } from 'react';
import { Grid } from './components/Grid';
import { ProductModal } from './components/ProductModal';
import { CartDrawer } from './components/CartDrawer';
import { Toast } from './components/Toast';
import { useLocalStorage } from './lib/useLocalStorage';
import { copyToClipboard } from './lib/clipboard';
import { formatCurrency } from './lib/currency';
import { CartItem, CartStorageItem, Product } from './types';

interface FetchState {
  loading: boolean;
  error: string | null;
}

const CART_STORAGE_KEY = 'ngt-store-cart';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>({ loading: true, error: null });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [cartStorage, setCartStorage] = useLocalStorage<CartStorageItem[]>(CART_STORAGE_KEY, []);
  const [isLogoAvailable, setIsLogoAvailable] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setFetchState({ loading: true, error: null });
        const response = await fetch('/products.json');
        if (!response.ok) {
          throw new Error('Не удалось загрузить каталог');
        }
        const data = (await response.json()) as Product[];
        setProducts(data);
        setFetchState({ loading: false, error: null });
      } catch (error) {
        console.error(error);
        setFetchState({
          loading: false,
          error: 'Ошибка загрузки каталога. Попробуйте обновить страницу.'
        });
      }
    };
    loadProducts();
  }, []);

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => map.set(product.id, product));
    return map;
  }, [products]);

  const cartItems: CartItem[] = useMemo(() => {
    return cartStorage
      .map((entry) => {
        const product = productsById.get(entry.productId);
        if (!product) return null;
        const quantity = Math.min(entry.quantity, product.stock);
        return { product, quantity };
      })
      .filter((item): item is CartItem => Boolean(item));
  }, [cartStorage, productsById]);

  const cartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleOpenModal = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedProduct(null);
    setIsModalOpen(false);
  };

  const setCartItemQuantity = useCallback(
    (productId: string, quantity: number) => {
      setCartStorage((prev) => {
        const existing = prev.find((item) => item.productId === productId);
        if (existing) {
          return prev.map((item) => (item.productId === productId ? { ...item, quantity } : item));
        }
        return [...prev, { productId, quantity }];
      });
    },
    [setCartStorage]
  );

  const addToCart = useCallback(
    (product: Product, quantity: number) => {
      setCartStorage((prev) => {
        const existing = prev.find((item) => item.productId === product.id);
        if (existing) {
          const combined = Math.min(product.stock, existing.quantity + quantity);
          return prev.map((item) =>
            item.productId === product.id ? { ...item, quantity: combined } : item
          );
        }
        return [...prev, { productId: product.id, quantity: Math.min(product.stock, quantity) }];
      });
    },
    [setCartStorage]
  );

  const handleAddToCart = useCallback(
    (product: Product, quantity: number) => {
      addToCart(product, quantity);
      setToastMessage(`Добавлено в корзину: ${product.title} - ${quantity} шт.`);
      setIsModalOpen(false);
    },
    [addToCart]
  );

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setCartItemQuantity(productId, quantity);
  };

  const handleRemoveItem = (productId: string) => {
    setCartStorage((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleCheckout = async (form: {
    name: string;
    phone: string;
    delivery: 'pickup' | 'courier';
    city: string;
    comment: string;
  }) => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const deliveryCost = 0;
    const total = subtotal + deliveryCost;

    const lines: string[] = [];
    lines.push('Новая заявка с сайта NEW GRGY TIMES');
    lines.push('');
    lines.push('Товары:');
    cartItems.forEach((item, index) => {
      const number = index + 1;
      const productTotal = item.product.price * item.quantity;
      lines.push(
        `${number}. ${item.product.title} - ${item.quantity} шт x ${formatCurrency(item.product.price)} = ${formatCurrency(productTotal)}`
      );
    });
    lines.push('');
    lines.push(`Сумма товаров: ${formatCurrency(subtotal)}`);
    lines.push(`Доставка: ${formatCurrency(deliveryCost)}`);
    lines.push(`Итого: ${formatCurrency(total)}`);
    lines.push('');
    lines.push('Данные покупателя:');
    lines.push(`Имя: ${form.name}`);
    lines.push(`Телефон: ${form.phone}`);
    lines.push(
      `Способ доставки: ${form.delivery === 'pickup' ? 'ПВЗ' : 'Курьер'}`
    );
    if (form.delivery === 'courier') {
      lines.push(`Город / Адрес: ${form.city || 'Не указан'}`);
    }
    if (form.comment.trim()) {
      lines.push(`Комментарий: ${form.comment.trim()}`);
    }

    const text = lines.join('\n');
    const copied = await copyToClipboard(text);
    if (copied) {
      setToastMessage('Заявка скопирована, откройте Telegram для отправки');
    } else {
      setToastMessage('Не удалось скопировать заявку. Скопируйте вручную.');
    }
    window.open('https://t.me/grgyone', '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(''), 4500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="w-10" />
          <div className="flex items-center justify-center">
            {isLogoAvailable ? (
              <img
                src="/logo.png"
                alt="NEW GRGY TIMES"
                className="h-7"
                onError={() => setIsLogoAvailable(false)}
              />
            ) : (
              <span className="text-base font-semibold uppercase tracking-wide text-black">NEW GRGY TIMES</span>
            )}
          </div>
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center text-black"
            aria-label="Открыть корзину"
            onClick={() => setIsCartOpen(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l2-7H5.4M7 13L5.4 5M7 13l-1.5 7h13L17 13M10 21a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z"
              />
            </svg>
            {cartQuantity > 0 && (
              <span className="absolute -right-2 -top-1 bg-black px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {cartQuantity}
              </span>
            )}
          </button>
        </div>
      </header>

      <main>
        {fetchState.loading && (
          <div className="flex justify-center px-4 py-12 text-sm text-neutral-600">Загрузка...</div>
        )}
        {fetchState.error && (
          <div className="flex justify-center px-4 py-12 text-sm text-red-600">{fetchState.error}</div>
        )}
        {!fetchState.loading && !fetchState.error && products.length > 0 && (
          <Grid products={products} onSelect={handleOpenModal} />
        )}
      </main>

      <footer className="mt-12 border-t border-black/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-center text-sm text-neutral-600 sm:px-6 lg:px-8">
          <div className="space-x-2 uppercase">
            <a href="#" className="hover:text-black">
              About
            </a>
            <span>|</span>
            <a href="#" className="hover:text-black">
              Privacy Policy
            </a>
            <span>|</span>
            <a href="#" className="hover:text-black">
              Terms of Service
            </a>
            <span>|</span>
            <a href="#" className="hover:text-black">
              Return &amp; Refund Policy
            </a>
            <span>|</span>
            <a href="#" className="hover:text-black">
              Support
            </a>
          </div>
          <div className="text-xs text-neutral-500">© 2025 NEW GRGY TIMES</div>
        </div>
      </footer>

      <ProductModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onAddToCart={handleAddToCart}
      />

      <CartDrawer
        isOpen={isCartOpen}
        items={cartItems}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onSubmit={handleCheckout}
      />

      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </div>
  );
}
