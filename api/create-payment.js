// api/create-payment.js
const crypto = require('crypto');
const fetch = global.fetch || require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  try {
    const { cart = [], customer = {}, delivery = {} } = req.body || {};
    const { items, total } = await priceAndValidate(cart);

    const payment = {
      amount: { value: total.toFixed(2), currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: process.env.BASE_URL + '/thankyou.html' },
      description: `NGT Order ${Date.now()}`,
      receipt: {
        customer: {
          email: customer.email,
          phone: customer.phone,
          full_name: customer.name,
        },
        items: items.map(it => ({
          description: it.title,
          quantity: it.qty,
          amount: { value: it.lineTotal.toFixed(2), currency: 'RUB' },
          vat_code: it.vat_code ?? 1,
          payment_mode: 'full_payment',
          payment_subject: 'commodity'
        }))
      },
      // В metadata — только плоские строки/числа, без вложенных объектов!
      metadata: {
        delivery_type: delivery.type || '',
        delivery_address: delivery.address || '',
        delivery_comment: delivery.comment || '',
        items: items.map(({ id, title, qty, price }) => `${id}:${title}×${qty}=${price}`).join('; ')
      }
    };

    const idemKey = crypto.randomUUID();
    const auth = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');

    const resp = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idemKey,
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(payment)
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('YooKassa error:', data);
      return res.status(resp.status).json(data);
    }

    return res.status(200).json({
      payment_id: data.id,
      confirmation_url: data?.confirmation?.confirmation_url
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal_error' });
  }
};

// ===== helpers =====
async function priceAndValidate(cart) {
  const inventory = await getInventory();
  const items = cart.map(ci => {
    const stock = inventory[ci.id];
    if (!stock) throw new Error(`Item not found: ${ci.id}`);
    if (ci.qty < 1 || ci.qty > stock.qty) throw new Error(`Qty invalid for ${ci.id}`);
    const price = Number(stock.price);
    const lineTotal = price * ci.qty;
    return { id: ci.id, title: stock.title, qty: ci.qty, price, lineTotal, vat_code: stock.vat_code };
  });
  const total = items.reduce((s, i) => s + i.lineTotal, 0);
  return { items, total };
}

async function getInventory() {
  return {
    'sku-001': { title: 'GRGY Cap', price: 1990, qty: 5, vat_code: 1 },
    'sku-002': { title: 'Print A3', price: 1490, qty: 12, vat_code: 1 }
  };
}
