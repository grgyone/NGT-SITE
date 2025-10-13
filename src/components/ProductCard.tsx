import { useMemo, useState } from 'react';
import { Product } from '../types';
import { formatCurrency } from '../lib/currency';

type ProductCardProps = {
  product: Product;
  onSelect: () => void;
};

const FALLBACK_IMAGE =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#f3f3f3"/><text x="50%" y="50%" font-family="Arial" font-size="18" fill="#555" text-anchor="middle">\u041d\u0435\u0442 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f</text></svg>'
  );

const CARD_LABEL = '\u041e\u0442\u043a\u0440\u044b\u0442\u044c\u0020\u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443\u0020\u0442\u043e\u0432\u0430\u0440\u0430';
const EMPTY_DASH = '\u2014';

export function ProductCard({ product, onSelect }: ProductCardProps) {
  const [imageSrc, setImageSrc] = useState(product.images?.[0] ?? FALLBACK_IMAGE);

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (product.artist) {
      parts.push(product.artist);
    }
    if (product.year) {
      parts.push(String(product.year));
    }
    return parts.join(', ');
  }, [product.artist, product.year]);

  return (
    <article className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onSelect}
        className="relative aspect-square w-full overflow-hidden border border-black/10 bg-white"
        aria-label={`${CARD_LABEL} ${product.title}`}
      >
        <img
          src={imageSrc}
          alt={product.title}
          className="h-full w-full object-cover"
          onError={() => setImageSrc(FALLBACK_IMAGE)}
        />
      </button>
      <div className="flex items-start justify-between gap-2 text-left">
        <div className="flex-1">
          <h3 className="truncate text-sm font-medium uppercase tracking-tight text-black">
            {product.title}
          </h3>
          <p className="truncate text-xs uppercase tracking-wide text-neutral-500">
            {subtitle || EMPTY_DASH}
          </p>
        </div>
        <div className="flex flex-col items-end text-right text-black">
          <span className="text-sm font-semibold leading-none">
            {formatCurrency(product.price, product.currency)}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-neutral-500">
            / {product.unit}
          </span>
        </div>
      </div>
    </article>
  );
}
