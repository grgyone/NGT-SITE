import { useEffect, useMemo, useState } from 'react';
import { Product } from '../types';
import { formatCurrency } from '../lib/currency';

interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

const FALLBACK_IMAGE =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#f3f3f3"/><text x=\"50%\" y=\"50%\" font-family=\"Arial\" font-size=\"20\" fill=\"#555\" text-anchor=\"middle\">Net izobrazheniya</text></svg>'
  );

export function ProductModal({ product, isOpen, onClose, onAddToCart }: ProductModalProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [imageSources, setImageSources] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen || !product) {
      return;
    }
    setActiveIndex(0);
    setQuantity(1);
    setImageSources(product.images && product.images.length > 0 ? product.images : [FALLBACK_IMAGE]);
  }, [isOpen, product]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'ArrowRight') {
        setActiveIndex((prev) => (imageSources.length > 0 ? (prev + 1) % imageSources.length : prev));
      }
      if (event.key === 'ArrowLeft') {
        setActiveIndex((prev) =>
          imageSources.length > 0 ? (prev - 1 + imageSources.length) % imageSources.length : prev
        );
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, imageSources.length, onClose]);

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

  const disableDecrease = quantity <= 1;
  const disableIncrease = product ? quantity >= product.stock : true;

  const metaLine = useMemo(() => {
    if (!product) return '';
    const items: string[] = [];
    if (product.artist) items.push(product.artist);
    if (product.year) items.push(String(product.year));
    return items.join(', ');
  }, [product]);

  if (!isOpen || !product) {
    return null;
  }

  const currentImage = imageSources[activeIndex] ?? FALLBACK_IMAGE;

  const handleAdd = () => {
    if (!product) return;
    onAddToCart(product, quantity);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/95 px-4 py-6">
      <div className="flex w-full max-w-5xl flex-col gap-6 overflow-y-auto border border-black/20 bg-white p-6 lg:flex-row">
        <div className="flex w-full flex-col gap-4 lg:w-1/2">
          <div className="relative flex items-center justify-center border border-black/10 bg-white">
            <button
              type="button"
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 px-3 py-2 text-sm text-black hover:bg-black hover:text-white"
              onClick={() =>
                setActiveIndex((prev) =>
                  imageSources.length > 0 ? (prev - 1 + imageSources.length) % imageSources.length : prev
                )
              }
              aria-label="Предыдущее изображение"
            >
              &lt;
            </button>
            <img
              src={currentImage}
              alt={product.title}
              className="block max-h-[480px] w-full object-contain"
              onError={(event) => {
                const target = event.currentTarget;
                target.src = FALLBACK_IMAGE;
              }}
            />
            <button
              type="button"
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 px-3 py-2 text-sm text-black hover:bg-black hover:text-white"
              onClick={() =>
                setActiveIndex((prev) =>
                  imageSources.length > 0 ? (prev + 1) % imageSources.length : prev
                )
              }
              aria-label="Следующее изображение"
            >
              &gt;
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {imageSources.map((src, index) => (
              <button
                key={src + index}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`border px-1 py-1 ${index === activeIndex ? 'border-black' : 'border-black/20'}`}
              >
                <img
                  src={src}
                  alt={`${product.title} превью ${index + 1}`}
                  className="h-16 w-full object-cover"
                  onError={(event) => {
                    const target = event.currentTarget;
                    target.src = FALLBACK_IMAGE;
                  }}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="flex w-full flex-col gap-4 lg:w-1/2">
          <div className="flex flex-col gap-2 border-b border-black/10 pb-4">
            <h2 className="text-2xl font-semibold uppercase text-black">{product.title}</h2>
            {metaLine && <span className="text-sm text-neutral-600">{metaLine}</span>}
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-lg font-semibold">
                {formatCurrency(product.price, product.currency)} / {product.unit}
              </span>
              <span className="text-sm text-neutral-600">В наличии: {product.stock}</span>
            </div>
          </div>

          {product.description && <p className="text-sm leading-relaxed text-neutral-700">{product.description}</p>}

          <div className="flex flex-col gap-1 text-sm text-neutral-700">
            {product.materials && <div>Материалы: {product.materials}</div>}
            {product.dimensions && (
              <div>
                Размеры: {product.dimensions.w_cm} x {product.dimensions.h_cm}
                {product.dimensions.d_cm ? ` x ${product.dimensions.d_cm}` : ''} см
              </div>
            )}
            {product.edition && (
              <div>
                Тираж / COA: {product.edition.current} / {product.edition.of}
              </div>
            )}
            {product.specs && (
              <div className="mt-2 flex flex-col gap-1">
                {Object.entries(product.specs).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-neutral-500">{key}:</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-black/10 pt-4">
            <span className="text-sm uppercase text-neutral-600">Количество</span>
            <div className="flex items-center border border-black/40">
              <button
                type="button"
                className="px-3 py-2 text-sm text-black hover:bg-black hover:text-white disabled:bg-neutral-200 disabled:text-neutral-500"
                onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                disabled={disableDecrease}
                aria-label="Уменьшить количество"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={product.stock}
                value={quantity}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isNaN(value)) return;
                  const clamped = Math.min(Math.max(1, value), product.stock);
                  setQuantity(clamped);
                }}
                className="w-14 border-x border-black/40 py-2 text-center text-sm focus:outline-none"
              />
              <button
                type="button"
                className="px-3 py-2 text-sm text-black hover:bg-black hover:text-white disabled:bg-neutral-200 disabled:text-neutral-500"
                onClick={() => setQuantity((prev) => Math.min(product.stock, prev + 1))}
                disabled={disableIncrease}
                aria-label="Увеличить количество"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-black/10 pt-4 md:flex-row">
            <button
              type="button"
              className="w-full border border-black bg-black px-4 py-3 text-center text-sm font-semibold uppercase text-white hover:bg-white hover:text-black"
              onClick={handleAdd}
            >
              В корзину
            </button>
            <button
              type="button"
              className="w-full border border-black px-4 py-3 text-center text-sm font-semibold uppercase text-black hover:bg-black hover:text-white"
              onClick={onClose}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
