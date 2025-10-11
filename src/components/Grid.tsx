import { Product } from '../types';
import { ProductCard } from './ProductCard';

interface GridProps {
  products: Product[];
  onSelect: (product: Product) => void;
}

export function Grid({ products, onSelect }: GridProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5 xl:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onSelect={() => onSelect(product)} />
        ))}
      </div>
    </section>
  );
}
