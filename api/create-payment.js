// api/create-payment.js
'use strict';

const crypto = require('crypto');

// В Vercel Node 18+ fetch доступен глобально — лишних пакетов не нужно.
const fetchFn = globalThis.fetch;

/**
 * Serverless handler (Vercel)
 */
module.exports = async (req, res) => {
  // Разрешаем только POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    // Аккуратно читаем тело: в Vercel оно уже распарсено,
    // но на всякий случай поддержим и строку.
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }

    const cart = Array.isArray(body.cart) ? body.cart : [];
    const customer = body.customer || {};
    const delivery = body.delivery || {};

    // Пересчёт корзины на сервере
    const priced = await priceAndValidate(cart);
    const items = priced.items;
    const total = priced.total;

    // Тело платежа для YooKassa (metadata — только ПЛОСКИЕ строки/числа)
    const payment = {
      amount: { value: String(total.toFixed(2)), currency: 'RUB' },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: String(process.env.BASE_URL || '') + '/thankyou.html'
      },
      description: 'NGT Order ' + Date.now(),
      receipt: {
        customer: {
          email: customer.email || '',
          phone: customer.phone || '',
          full_name: customer.name || ''
        },
        items: items.map((it) => ({
          description: it.title,
          quantity: Number(it.qty),
          amount: { value: String(it.lineTotal.toFixed(2)), currency: 'RUB' },
          vat_code: (it.vat_code != null ? it.vat_code : 1),
          payment_mode: 'full_payment',
          payment_subject: 'commodity'
        }))
      },
      metadata: {
        delivery_type: delivery.type || '',
        delivery_address: delivery.address || '',
        delivery_comment: delivery.comment || '',
        items: items.map(function (x) {
          return x.id + ':' + x.title + '×' + x.qty + '=' + x.price;
        }).join('; ')
      }
    };

    const idemKey = crypto.randomUUID();
    const auth = Buffer.from(
      String(process.env.YOOKASSA_SHOP_ID || '') + ':' + String(process.env.YOOKASSA_SECRET_KEY || '')
    ).toString('base64');

    // Запрос в YooKassa
    const resp = await fetchFn('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idemKey,
        'Authorization': 'Basic ' + auth
      },
      body: JSON.stringify(payment)
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error('YooKassa error:', data);
      return res.status(resp.status).json(data);
    }

    // Отдаём фронту ссылку для редиректа
    return res.status(200).json({
      payment_id: data.id,
      confirmation_url: data && data.confirmation ? data.confirmation.confirmation_url : ''
    });
  } catch (err) {
    console.error('create-payment error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
};

/**
 * Серверный пересчёт корзины и валидация
 */
async function priceAndValidate(cart) {
  const inventory = await getInventory();

  const items = cart.map(function (ci) {
    const stock = inventory[ci.id];
    if (!stock) throw new Error('Item not found: ' + ci.id);

    const qty = Number(ci.qty) || 0;
    if (qty < 1 || qty > Number(stock.qty)) {
      throw new Error('Qty invalid for ' + ci.id);
    }

    const price = Number(stock.price);
    const lineTotal = price * qty;

    return {
      id: ci.id,
      title: String(stock.title),
      qty: qty,
      price: price,
      lineTotal: lineTotal,
      vat_code: stock.vat_code
    };
  });

  const total = items.reduce(function (sum, it) { return sum + it.lineTotal; }, 0);
  return { items: items, total: total };
}

/**
 * Заглушка вместо БД/JSONBin. Подставишь своё чтение.
 */
async function getInventory() {
  return {
    'sku-001': { title: 'GRGY Cap', price: 1990, qty: 5,  vat_code: 1 },
    'sku-002': { title: 'Print A3',  price: 1490, qty: 12, vat_code: 1 }
  };
}