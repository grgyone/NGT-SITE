import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CartItem } from '../types';
import { formatCurrency } from '../lib/currency';

interface CheckoutForm {
  name: string;
  phone: string;
  delivery: 'pickup' | 'courier';
  city: string;
  comment: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  items: CartItem[];
  onClose: () => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onSubmit: (form: CheckoutForm) => Promise<void>;
}

const FALLBACK_IMAGE =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f3f3f3"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#555" text-anchor="middle">Net izobrazheniya</text></svg>'
  );

export function CartDrawer({
  isOpen,
  items,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onSubmit
}: CartDrawerProps) {
  const [form, setForm] = useState<CheckoutForm>({
    name: '',
    phone: '',
    delivery: 'pickup',
    city: '',
    comment: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setErrors({});
      setIsSubmitting(false);
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
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const delivery = 0;
    return {
      subtotal,
      delivery,
      total: subtotal + delivery
    };
  }, [items]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) {
      newErrors.name = 'Введите имя';
    }
    if (!form.phone.trim()) {
      newErrors.phone = 'Введите телефон';
    }
    if (form.delivery === 'courier' && !form.city.trim()) {
      newErrors.city = 'Укажите город или адрес доставки';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0) {
      setErrors({ general: 'Добавьте товары в корзину' });
      return;
    }
    if (!validate()) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="h-full w-full bg-black/30"
        aria-label="Закрыть корзину"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-black/15 bg-white">
        <header className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 className="text-lg font-semibold uppercase text-black">Корзина</h2>
          <button type="button" className="text-sm uppercase text-neutral-600 hover:text-black" onClick={onClose}>
            Закрыть
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-neutral-600">
              Добавьте товары, чтобы оформить заказ.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li key={item.product.id} className="flex gap-3 border-b border-black/10 pb-4">
                  <div className="h-20 w-20 border border-black/10 bg-white">
                    <img
                      src={item.product.images?.[0] ?? FALLBACK_IMAGE}
                      alt={item.product.title}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK_IMAGE;
                      }}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="text-sm font-semibold uppercase text-black">{item.product.title}</h3>
                        <span className="text-xs text-neutral-500">
                          {formatCurrency(item.product.price, item.product.currency)} / {item.product.unit}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-xs uppercase text-neutral-500 hover:text-black"
                        onClick={() => onRemoveItem(item.product.id)}
                      >
                        Удалить
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-black/40">
                        <button
                          type="button"
                          className="px-2 py-2 text-sm text-black hover:bg-black hover:text-white disabled:bg-neutral-200 disabled:text-neutral-500"
                          onClick={() => onUpdateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                          disabled={item.quantity <= 1}
                          aria-label="Меньше"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={item.product.stock}
                          value={item.quantity}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (Number.isNaN(value)) return;
                            const clamped = Math.min(Math.max(1, value), item.product.stock);
                            onUpdateQuantity(item.product.id, clamped);
                          }}
                          className="w-12 border-x border-black/40 py-1 text-center text-xs focus:outline-none"
                          aria-label="Количество"
                        />
                        <button
                          type="button"
                          className="px-2 py-2 text-sm text-black hover:bg-black hover:text-white disabled:bg-neutral-200 disabled:text-neutral-500"
                          onClick={() =>
                            onUpdateQuantity(item.product.id, Math.min(item.product.stock, item.quantity + 1))
                          }
                          disabled={item.quantity >= item.product.stock}
                          aria-label="Больше"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-black">
                        {formatCurrency(item.product.price * item.quantity, item.product.currency)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form className="border-t border-black/10 px-6 py-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs uppercase text-neutral-600">
              Имя *
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="border border-black/40 px-3 py-2 text-sm focus:outline-none"
                required
              />
              {errors.name && <span className="text-xs text-red-600">{errors.name}</span>}
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-neutral-600">
              Телефон *
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                className="border border-black/40 px-3 py-2 text-sm focus:outline-none"
                required
              />
              {errors.phone && <span className="text-xs text-red-600">{errors.phone}</span>}
            </label>
            <fieldset className="flex flex-col gap-2 border border-black/20 p-3 text-xs uppercase text-neutral-600">
              <legend className="px-1">Способ доставки</legend>
              <label className="flex items-center gap-2 text-[11px] normal-case text-black">
                <input
                  type="radio"
                  name="delivery"
                  value="pickup"
                  checked={form.delivery === 'pickup'}
                  onChange={() => setForm((prev) => ({ ...prev, delivery: 'pickup' }))}
                />
                ПВЗ
              </label>
              <label className="flex items-center gap-2 text-[11px] normal-case text-black">
                <input
                  type="radio"
                  name="delivery"
                  value="courier"
                  checked={form.delivery === 'courier'}
                  onChange={() => setForm((prev) => ({ ...prev, delivery: 'courier' }))}
                />
                Курьер
              </label>
            </fieldset>
            {form.delivery === 'courier' && (
              <label className="flex flex-col gap-1 text-xs uppercase text-neutral-600">
                Город / Адрес *
                <input
                  type="text"
                  value={form.city}
                  onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                  className="border border-black/40 px-3 py-2 text-sm focus:outline-none"
                />
                {errors.city && <span className="text-xs text-red-600">{errors.city}</span>}
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs uppercase text-neutral-600">
              Комментарий
              <textarea
                value={form.comment}
                onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
                className="h-20 border border-black/40 px-3 py-2 text-sm focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-black/10 pt-4 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>Сумма товаров</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Доставка</span>
              <span>0 ₽</span>
            </div>
            <div className="flex justify-between border-t border-black/10 pt-2 text-base font-semibold text-black">
              <span>Итого</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
          {errors.general && <p className="mt-2 text-xs text-red-600">{errors.general}</p>}
          <button
            type="submit"
            className="mt-4 w-full border border-black bg-black px-4 py-3 text-sm font-semibold uppercase text-white hover:bg-white hover:text-black disabled:bg-neutral-300 disabled:text-neutral-600"
            disabled={isSubmitting}
          >
            Оформить заказ
          </button>
        </form>
      </aside>
    </div>
  );
}
