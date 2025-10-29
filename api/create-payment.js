// api/create-payment.js
'use strict';

const crypto = require('crypto');
const fetchFn = globalThis.fetch;

/** --- helpers --- */
function getEnv(name) {
  const v = (process.env[name] || '').trim();
  return v;
}

function badCreds(res, shopId, secret) {
  console.error('Bad YooKassa creds: shopId="%s", secretLen=%d', shopId, (secret || '').length);
  return res.status(500).json({ error: 'yookassa_env_invalid' });
}

/** --- handler --- */
module.exports = async (req, res) => {
  // Разрешаем только POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    // Тело запроса (на всякий случай поддержим строку)
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }

    const cart = Array.isArray(body.cart) ? body.cart : [];
    const customer = body.customer || {};
    const delivery = body.delivery || {};

    // Серверный пересчёт корзины
    const { items, total } = await priceAndValidate(cart);

    // Готовим платёж (metadata — только плоские строки/числа!)
    const payment = {
      amount: { value: String(total.toFixed(2)), currency: 'RUB' },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: String(getEnv('BASE_URL')) + '/thankyou.html'
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
        items: items.map((x) => x.id + ':' + x.title + '×' + x.qty + '=' + x.price).join('; ')
      }
    };

    // --- Авторизация YooKassa ---
    const shopId = getEnv('YOOKASSA_SHOP_ID');
    const secret = getEnv('YOOKASSA_SECRET_KEY');
    if (!/^\d+$/.test(shopId) || secret.length < 20) {
      return badCreds(res, shopId, secret);
    }
    const auth = Buffer.from(shopId + ':' + secret).toString('base64');

    // Идемпотентность
    const idemKey = crypto.randomUUID();

    // Запрос в YooKassa
    const resp = await fetchFn('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idemKey,
        'Authorization': 'Basic ' + auth,
        'User-Agent': 'NGT-SITE/1.0 (newgrgytimes)'
      },
      body: JSON.stringify(payment)
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error('YooKassa error:', data);
      return res.status(resp.status).json(data);
    }

    // Ответ фронту
    return res.status(200).json({
      payment_id: data.id,
      confirmation_url: data?.confirmation?.confirmation_url || ''
    });
  } catch (err) {
    console.error('create-payment error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
};

/** ----- server-side pricing/validation ----- */
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
  return { items, total };
}

/** ----- inventory stub (замени на JSONBin/БД на сервере) ----- */
async function getInventory() {
  return {
    'sku-001': { title: 'GRGY Cap', price: 1990, qty: 5,  vat_code: 1 },
    'sku-002': { title: 'Print A3',  price: 1490, qty: 12, vat_code: 1 }
  };
}
