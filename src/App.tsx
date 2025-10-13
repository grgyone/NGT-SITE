import { useCallback, useEffect, useMemo, useState } from 'react';
import { Grid } from './components/Grid';
import { ProductModal } from './components/ProductModal';
import { CartDrawer } from './components/CartDrawer';
import { Toast } from './components/Toast';
import { useLocalStorage } from './lib/useLocalStorage';
import { copyToClipboard } from './lib/clipboard';
import { formatCurrency } from './lib/currency';
import { CartItem, CartStorageItem, Product } from './types';

const CART_STORAGE_KEY = 'ngt-store-cart';

const rawBaseUrl = import.meta.env.BASE_URL || '/';
const normalizedBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl : `${rawBaseUrl}/`;

const withBase = (path: string) => {
  if (!path) {
    return path;
  }
  if (/^(?:[a-z]+:)?\/\//i.test(path)) {
    return path;
  }
  return `${normalizedBaseUrl}${path.replace(/^\/+/, '')}`;
};

const RU = {
  fetchThrow:
    '\u041d\u0435\u0020\u0443\u0434\u0430\u043b\u043e\u0441\u044c\u0020\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c\u0020\u043a\u0430\u0442\u0430\u043b\u043e\u0433',
  fetchFail:
    '\u041e\u0448\u0438\u0431\u043a\u0430\u0020\u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438\u0020\u043a\u0430\u0442\u0430\u043b\u043e\u0433\u0430\u002e\u0020\u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435\u0020\u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c\u0020\u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443\u002e',
  addToCartPrefix: '\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u043e\u0020\u0432\u0020\u043a\u043e\u0440\u0437\u0438\u043d\u0443\u003a\u0020',
  orderHeading: '\u0417\u0430\u044f\u0432\u043a\u0430\u0020\u004e\u0045\u0057\u0020\u0047\u0052\u0047\u0059\u0020\u0054\u0049\u004d\u0045\u0053',
  orderItems: '\u041f\u043e\u0437\u0438\u0446\u0438\u0438\u003a',
  sumLabel: '\u0421\u0443\u043c\u043c\u0430\u0020\u0442\u043e\u0432\u0430\u0440\u043e\u0432\u003a\u0020',
  deliveryLabel: '\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430\u003a\u0020',
  totalLabel: '\u0418\u0442\u043e\u0433\u043e\u003a\u0020',
  contactsLabel: '\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b\u003a',
  nameLabel: '\u0418\u043c\u044f\u003a\u0020',
  phoneLabel: '\u0422\u0435\u043b\u0435\u0444\u043e\u043d\u003a\u0020',
  deliveryMethodLabel: '\u0421\u043f\u043e\u0441\u043e\u0431\u0020\u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438\u003a\u0020',
  pickup: '\u041f\u0412\u0417',
  courier: '\u041a\u0443\u0440\u044c\u0435\u0440',
  addressLabel: '\u0413\u043e\u0440\u043e\u0434\u0020\u002f\u0020\u0410\u0434\u0440\u0435\u0441\u003a\u0020',
  commentLabel: '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439\u003a\u0020',
  copySuccess:
    '\u0417\u0430\u044f\u0432\u043a\u0430\u0020\u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0430\u002c\u0020\u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435\u0020\u0054\u0065\u006c\u0065\u0067\u0072\u0061\u006d\u0020\u0434\u043b\u044f\u0020\u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0438',
  copyFail:
    '\u041d\u0435\u0020\u0443\u0434\u0430\u043b\u043e\u0441\u044c\u0020\u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0020\u0437\u0430\u044f\u0432\u043a\u0443\u002e\u0020\u0421\u043a\u043e\u043f\u0438\u0440\u0443\u0439\u0442\u0435\u0020\u0442\u0435\u043a\u0441\u0442\u0020\u0432\u0440\u0443\u0447\u043d\u0443\u044e\u002e',
  openCart: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c\u0020\u043a\u043e\u0440\u0437\u0438\u043d\u0443',
  loading: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430\u002e\u002e\u002e',
  footer: '\u00a9\u0020\u0032\u0030\u0032\u0035\u0020\u004e\u0045\u0057\u0020\u0047\u0052\u0047\u0059\u0020\u0054\u0049\u004d\u0045\u0053'
} as const;

const ORDER_SEPARATOR = '\u0020\u2014\u0020';
const UNIT_SUFFIX = '\u0020\u0448\u0442\u002e';

type FetchState = {
  loading: boolean;
  error: string | null;
};

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
        const response = await fetch(withBase('products.json'));
        if (!response.ok) {
          throw new Error(RU.fetchThrow);
        }
        const data = (await response.json()) as Product[];
        const normalized = data.map((product) => ({
          ...product,
          images: product.images?.map(withBase) ?? []
        }));
        setProducts(normalized);
        setFetchState({ loading: false, error: null });
      } catch (error) {
        console.error(error);
        setFetchState({
          loading: false,
          error: RU.fetchFail
        });
      }
    };
    loadProducts();
  }, []);

  const productsById = useMemo(() => {
    const entries = products.map((product) => [product.id, product] as const);
    return new Map(entries);
  }, [products]);

  const cartItems: CartItem[] = useMemo(() => {
    return cartStorage
      .map((entry) => {
        const product = productsById.get(entry.productId);
        if (!product) {
          return null;
        }
        const quantity = Math.min(entry.quantity, product.stock);
        return { product, quantity };
      })
      .filter((item): item is CartItem => Boolean(item));
  }, [cartStorage, productsById]);

  const cartQuantity = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );
  const cartSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cartItems]
  );

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
          return prev.map((item) =>
            item.productId === productId ? { ...item, quantity } : item
          );
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
      setToastMessage(
        `${RU.addToCartPrefix}${product.title}${ORDER_SEPARATOR}${quantity}${UNIT_SUFFIX}`
      );
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

  const handleCheckout = useCallback(
    async (form: {
      name: string;
      phone: string;
      delivery: 'pickup' | 'courier';
      city: string;
      comment: string;
    }) => {
      const lines: string[] = [];
      lines.push(RU.orderHeading);
      lines.push('');
      lines.push(RU.orderItems);
      cartItems.forEach((item, index) => {
        const lineTotal = item.product.price * item.quantity;
        lines.push(
          `${index + 1}. ${item.product.title}${ORDER_SEPARATOR}${item.quantity}\u0020\u00d7\u0020${formatCurrency(
            item.product.price,
            item.product.currency
          )}\u0020=\u0020${formatCurrency(lineTotal, item.product.currency)}`
        );
      });
      lines.push('');
      lines.push(`${RU.sumLabel}${formatCurrency(cartSubtotal)}`);
      lines.push(`${RU.deliveryLabel}${formatCurrency(0)}`);
      lines.push(`${RU.totalLabel}${formatCurrency(cartSubtotal)}`);
      lines.push('');
      lines.push(RU.contactsLabel);
      lines.push(`${RU.nameLabel}${form.name.trim() || '\u2014'}`);
      lines.push(`${RU.phoneLabel}${form.phone.trim() || '\u2014'}`);
      lines.push(
        `${RU.deliveryMethodLabel}${form.delivery === 'pickup' ? RU.pickup : RU.courier}`
      );
      if (form.delivery === 'courier') {
        lines.push(`${RU.addressLabel}${form.city.trim() || '\u2014'}`);
      } else {
        lines.push(`${RU.addressLabel}\u2014`);
      }
      lines.push(`${RU.commentLabel}${form.comment.trim() || '\u2014'}`);

      const copied = await copyToClipboard(lines.join('\n'));
      if (copied) {
        setToastMessage(RU.copySuccess);
        setIsCartOpen(false);
        window.open('https://t.me/grgyone', '_blank', 'noopener,noreferrer');
      } else {
        setToastMessage(RU.copyFail);
      }
    },
    [cartItems, cartSubtotal]
  );

  const logoSrc = withBase('logo.png');

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="w-10" />
          <div className="flex items-center justify-center">
            {isLogoAvailable ? (
              <img
                src={logoSrc}
                alt="NEW GRGY TIMES"
                className="h-7"
                onError={() => setIsLogoAvailable(false)}
              />
            ) : (
              <span className="text-base font-semibold uppercase tracking-wide text-black">
                NEW GRGY TIMES
              </span>
            )}
          </div>
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center text-black"
            aria-label={RU.openCart}
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
          <div className="flex justify-center px-4 py-12 text-sm text-neutral-600">
            {RU.loading}
          </div>
        )}
        {fetchState.error && (
          <div className="flex justify-center px-4 py-12 text-sm text-red-600">
            {fetchState.error}
          </div>
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
          <div className="text-xs text-neutral-500">{RU.footer}</div>
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
