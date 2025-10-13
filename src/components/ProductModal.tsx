import { useEffect, useMemo, useState } from 'react';
import { Product } from '../types';
import { formatCurrency } from '../lib/currency';

type ProductModalProps = {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
};

const FALLBACK_IMAGE =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#f3f3f3"/><text x="50%" y="50%" font-family="Arial" font-size="18" fill="#555" text-anchor="middle">\u041d\u0435\u0442 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f</text></svg>'
  );

const RU = {
  prevImage: '\u041f\u0440\u0435\u0434\u044b\u0434\u0443\u0449\u0435\u0435\u0020\u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435',
  nextImage: '\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0435\u0020\u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435',
  showImage: '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c\u0020\u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435',
  dimensions: '\u0420\u0430\u0437\u043c\u0435\u0440\u044b',
  materials: '\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b',
  edition: '\u0422\u0438\u0440\u0430\u0436\u002f\u0043\u004f\u0041',
  specs: '\u0425\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043a\u0438',
  stock: '\u0412\u0020\u043d\u0430\u043b\u0438\u0447\u0438\u0438\u003a\u0020',
  quantity: '\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e',
  decrease: '\u0423\u043c\u0435\u043d\u044c\u0448\u0438\u0442\u044c\u0020\u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e',
  increase: '\u0423\u0432\u0435\u043b\u0438\u0447\u0438\u0442\u044c\u0020\u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e',
  addToCart: '\u0412\u0020\u043a\u043e\u0440\u0437\u0438\u043d\u0443',
  close: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c'
} as const;

export function ProductModal({ product, isOpen, onClose, onAddToCart }: ProductModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const images =
    product && product.images.length > 0 ? product.images : [FALLBACK_IMAGE];

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setCurrentIndex(0);
    setQuantity(1);
  }, [isOpen, product]);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.removeProperty('overflow');
      return;
    }
    document.body.style.setProperty('overflow', 'hidden');
    return () => {
      document.body.style.removeProperty('overflow');
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }
      if (event.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images.length, isOpen, onClose]);

  if (!isOpen || !product) {
    return null;
  }

  const currentImage = images[currentIndex] ?? FALLBACK_IMAGE;

  const subtitle = useMemo(() => {
    if (!product) {
      return '';
    }
    const parts: string[] = [];
    if (product.artist) {
      parts.push(product.artist);
    }
    if (product.year) {
      parts.push(String(product.year));
    }
    return parts.join(', ');
  }, [product]);

  const specItems = useMemo(() => {
    if (!product) {
      return [];
    }
    const items: Array<{ label: string; value: string }> = [];
    if (product.dimensions) {
      const { w_cm, h_cm, d_cm } = product.dimensions;
      const depth = d_cm ? ` \u00d7 ${d_cm}` : '';
      items.push({
        label: RU.dimensions,
        value: `${w_cm} \u00d7 ${h_cm}${depth} \u0441\u043c`
      });
    }
    if (product.materials) {
      items.push({ label: RU.materials, value: product.materials });
    }
    if (product.edition) {
      items.push({
        label: RU.edition,
        value: `${product.edition.current} / ${product.edition.of}`
      });
    }
    if (product.specs) {
      for (const [label, value] of Object.entries(product.specs)) {
        items.push({ label, value });
      }
    }
    return items;
  }, [product]);

  const handleDecrease = () => setQuantity((prev) => Math.max(1, prev - 1));
  const handleIncrease = () => setQuantity((prev) => Math.min(product.stock, prev + 1));
  const handleQuantityChange = (next: number) => {
    if (Number.isNaN(next)) {
      return;
    }
    setQuantity(Math.min(product.stock, Math.max(1, next)));
  };

  const handleAddToCart = () => {
    onAddToCart(product, quantity);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/95 px-4 py-6">
      <div className="flex w-full max-w-5xl flex-col gap-6 overflow-y-auto border border-black/20 bg-white p-6 lg:flex-row">
        <div className="flex w-full flex-col gap-4 lg:w-1/2">
          <div className="relative flex items-center justify-center border border-black/10 bg-white">
            <button
              type="button"
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 px-3 py-2 text-sm text-black hover:bg-black hover:text-white"
              onClick={() => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)}
              aria-label={RU.prevImage}
            >
              &lt;
            </button>
            <img
              src={currentImage}
              alt={product.title}
              className="block max-h-[480px] w-full object-contain"
              onError={(event) => {
                event.currentTarget.src = FALLBACK_IMAGE;
              }}
            />
            <button
              type="button"
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 px-3 py-2 text-sm text-black hover:bg-black hover:text-white"
              onClick={() => setCurrentIndex((prev) => (prev + 1) % images.length)}
              aria-label={RU.nextImage}
            >
              &gt;
            </button>
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {images.map((src, index) => (
                <button
                  key={`${src}-${index}`}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`border px-1 py-1 ${index === currentIndex ? 'border-black' : 'border-black/20'}`}
                  aria-label={`${RU.showImage} ${index + 1}`}
                >
                  <img
                    src={src}
                    alt={`${product.title} preview ${index + 1}`}
                    className="h-16 w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK_IMAGE;
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-4 lg:w-1/2">
          <div className="flex flex-col gap-2 border-b border-black/10 pb-4">
            <h2 className="text-2xl font-semibold uppercase text-black">{product.title}</h2>
            {subtitle && <span className="text-sm uppercase text-neutral-600">{subtitle}</span>}
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-lg font-semibold">
                {formatCurrency(product.price, product.currency)} / {product.unit}
              </span>
              <span className="text-sm uppercase text-neutral-600">
                {RU.stock}
                {product.stock}
              </span>
            </div>
          </div>

          {product.description && (
            <p className="text-sm leading-relaxed text-neutral-700">{product.description}</p>
          )}

          {specItems.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">{RU.specs}</h3>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm uppercase text-neutral-700 sm:grid-cols-2">
                {specItems.map(({ label, value }) => (
                  <div key={`${label}-${value}`}>
                    <span className="block text-[11px] uppercase tracking-wide text-neutral-500">
                      {label}
                    </span>
                    <span className="block text-sm uppercase tracking-wide text-neutral-900">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-black/10 pt-4">
            <span className="text-sm uppercase text-neutral-600">{RU.quantity}</span>
            <div className="flex items-center border border-black/40">
              <button
                type="button"
                className="px-3 py-2 text-sm text-black hover:bg-black hover:text-white disabled:bg-neutral-200 disabled:text-neutral-500"
                onClick={handleDecrease}
                disabled={quantity <= 1}
                aria-label={RU.decrease}
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={product.stock}
                value={quantity}
                onChange={(event) => handleQuantityChange(Number(event.target.value))}
                className="w-14 border-x border-black/40 py-2 text-center text-sm focus:outline-none"
              />
              <button
                type="button"
                className="px-3 py-2 text-sm text-black hover:bg-black hover:text-white disabled:bg-neutral-200 disabled:text-neutral-500"
                onClick={handleIncrease}
                disabled={quantity >= product.stock}
                aria-label={RU.increase}
              >
                +
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-black/10 pt-4 md:flex-row">
            <button
              type="button"
              className="w-full border border-black bg-black px-4 py-3 text-center text-sm font-semibold uppercase text-white hover:bg-white hover:text-black"
              onClick={handleAddToCart}
            >
              {RU.addToCart}
            </button>
            <button
              type="button"
              className="w-full border border-black px-4 py-3 text-center text-sm font-semibold uppercase text-black hover:bg-black hover:text-white"
              onClick={onClose}
            >
              {RU.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
