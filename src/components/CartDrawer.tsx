import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CartItem } from '../types';
import { formatCurrency } from '../lib/currency';

type CheckoutForm = {
  name: string;
  phone: string;
  delivery: 'pickup' | 'courier';
  city: string;
  comment: string;
};

type CartDrawerProps = {
  isOpen: boolean;
  items: CartItem[];
  onClose: () => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onSubmit: (form: CheckoutForm) => Promise<void>;
};

const FALLBACK_IMAGE =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f3f3f3"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#555" text-anchor="middle">\u041d\u0435\u0442 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f</text></svg>'
  );

const RU = {
  enterName: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435\u0020\u0438\u043c\u044f',
  enterPhone: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435\u0020\u0442\u0435\u043b\u0435\u0444\u043e\u043d',
  enterAddress: '\u0423\u043a\u0430\u0436\u0438\u0442\u0435\u0020\u0433\u043e\u0440\u043e\u0434\u0020\u0438\u043b\u0438\u0020\u0430\u0434\u0440\u0435\u0441\u0020\u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438',
  emptyCart: '\u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435\u0020\u0442\u043e\u0432\u0430\u0440\u044b\u002c\u0020\u0447\u0442\u043e\u0431\u044b\u0020\u043e\u0444\u043e\u0440\u043c\u0438\u0442\u044c\u0020\u0437\u0430\u043a\u0430\u0437\u002e',
  closeOverlay: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c\u0020\u043a\u043e\u0440\u0437\u0438\u043d\u0443',
  title: '\u041a\u043e\u0440\u0437\u0438\u043d\u0430',
  close: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c',
  remove: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c',
  less: '\u041c\u0435\u043d\u044c\u0448\u0435',
  more: '\u0411\u043e\u043b\u044c\u0448\u0435',
  quantity: '\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e',
  nameLabel: '\u0418\u043c\u044f\u0020\u002a',
  phoneLabel: '\u0422\u0435\u043b\u0435\u0444\u043e\u043d\u0020\u002a',
  deliveryLabel: '\u0421\u043f\u043e\u0441\u043e\u0431\u0020\u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438',
  pickup: '\u041f\u0412\u0417',
  courier: '\u041a\u0443\u0440\u044c\u0435\u0440',
  addressLabel: '\u0413\u043e\u0440\u043e\u0434\u0020\u002f\u0020\u0410\u0434\u0440\u0435\u0441\u0020\u002a',
  commentLabel: '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439',
  subtotal: '\u0421\u0443\u043c\u043c\u0430\u0020\u0442\u043e\u0432\u0430\u0440\u043e\u0432',
  delivery: '\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430',
  total: '\u0418\u0442\u043e\u0433\u043e',
  checkout: '\u041e\u0444\u043e\u0440\u043c\u0438\u0442\u044c\u0020\u0437\u0430\u043a\u0430\u0437'
} as const;

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
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

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
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) {
      nextErrors.name = RU.enterName;
    }
    if (!form.phone.trim()) {
      nextErrors.phone = RU.enterPhone;
    }
    if (form.delivery === 'courier' && !form.city.trim()) {
      nextErrors.city = RU.enterAddress;
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0) {
      setErrors({ general: RU.emptyCart });
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

  const updateField = <K extends keyof CheckoutForm>(field: K, value: CheckoutForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="h-full w-full bg-black/30"
        onClick={onClose}
        aria-label={RU.closeOverlay}
      />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-black/15 bg-white">
        <header className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 className="text-lg font-semibold uppercase text-black">{RU.title}</h2>
          <button
            type="button"
            className="text-sm uppercase text-neutral-600 hover:text-black"
            onClick={onClose}
          >
            {RU.close}
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-neutral-600">{RU.emptyCart}</p>
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
                        <p className="text-sm font-medium uppercase text-black">{item.product.title}</p>
                        <p className="text-xs uppercase text-neutral-500">
                          {formatCurrency(item.product.price, item.product.currency)} / {item.product.unit}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-xs uppercase text-neutral-600 hover:text-black"
                        onClick={() => onRemoveItem(item.product.id)}
                      >
                        {RU.remove}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-black/40">
                        <button
                          type="button"
                          className="px-2 py-2 text-sm text-black hover:bg-black hover:text-white disabled:bg-neutral-200 disabled:text-neutral-500"
                          onClick={() =>
                            onUpdateQuantity(item.product.id, Math.max(1, item.quantity - 1))
                          }
                          disabled={item.quantity <= 1}
                          aria-label={RU.less}
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
                            if (Number.isNaN(value)) {
                              return;
                            }
                            const clamped = Math.min(Math.max(1, value), item.product.stock);
                            onUpdateQuantity(item.product.id, clamped);
                          }}
                          className="w-12 border-x border-black/40 py-1 text-center text-xs focus:outline-none"
                          aria-label={RU.quantity}
                        />
                        <button
                          type="button"
                          className="px-2 py-2 text-sm text-black hover:bg-black hover:text-white disabled:bg-neutral-200 disabled:text-neutral-500"
                          onClick={() =>
                            onUpdateQuantity(item.product.id, Math.min(item.product.stock, item.quantity + 1))
                          }
                          disabled={item.quantity >= item.product.stock}
                          aria-label={RU.more}
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
              {RU.nameLabel}
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="border border-black/40 px-3 py-2 text-sm focus:outline-none"
                required
              />
              {errors.name && <span className="text-xs text-red-600">{errors.name}</span>}
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-neutral-600">
              {RU.phoneLabel}
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                className="border border-black/40 px-3 py-2 text-sm focus:outline-none"
                required
              />
              {errors.phone && <span className="text-xs text-red-600">{errors.phone}</span>}
            </label>
            <fieldset className="flex flex-col gap-2 border border-black/20 p-3 text-xs uppercase text-neutral-600">
              <legend className="px-1">{RU.deliveryLabel}</legend>
              <label className="flex items-center gap-2 text-[11px] normal-case text-black">
                <input
                  type="radio"
                  name="delivery"
                  value="pickup"
                  checked={form.delivery === 'pickup'}
                  onChange={() => updateField('delivery', 'pickup')}
                />
                {RU.pickup}
              </label>
              <label className="flex items-center gap-2 text-[11px] normal-case text-black">
                <input
                  type="radio"
                  name="delivery"
                  value="courier"
                  checked={form.delivery === 'courier'}
                  onChange={() => updateField('delivery', 'courier')}
                />
                {RU.courier}
              </label>
            </fieldset>
            {form.delivery === 'courier' && (
              <label className="flex flex-col gap-1 text-xs uppercase text-neutral-600">
                {RU.addressLabel}
                <input
                  type="text"
                  value={form.city}
                  onChange={(event) => updateField('city', event.target.value)}
                  className="border border-black/40 px-3 py-2 text-sm focus:outline-none"
                />
                {errors.city && <span className="text-xs text-red-600">{errors.city}</span>}
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs uppercase text-neutral-600">
              {RU.commentLabel}
              <textarea
                value={form.comment}
                onChange={(event) => updateField('comment', event.target.value)}
                className="h-20 border border-black/40 px-3 py-2 text-sm focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-black/10 pt-4 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>{RU.subtotal}</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>{RU.delivery}</span>
              <span>{formatCurrency(totals.delivery)}</span>
            </div>
            <div className="flex justify-between border-t border-black/10 pt-2 text-base font-semibold text-black">
              <span>{RU.total}</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
          {errors.general && <p className="mt-2 text-xs text-red-600">{errors.general}</p>}
          <button
            type="submit"
            className="mt-4 w-full border border-black bg-black px-4 py-3 text-sm font-semibold uppercase text-white hover:bg-white hover:text-black disabled:bg-neutral-300 disabled:text-neutral-600"
            disabled={isSubmitting}
          >
            {RU.checkout}
          </button>
        </form>
      </aside>
    </div>
  );
}
