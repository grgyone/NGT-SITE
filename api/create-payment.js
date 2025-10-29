import crypto from 'node:crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  try {
    const {
      cart = [],        // [{id,title,price,qty,vat_code?}]
      customer = {},    // {email, phone, name}
      delivery = {},    // {type,address, comment}
    } = req.body || {};

    // 1) Серверная валидация и пересчёт стоимости (доверяем только серверу)
    const { items, total } = await priceAndValidate(cart); // самописная функция ниже

    // 2) Подготовка тела платежа
    const payment = {
      amount: { value: total.toFixed(2), currency: 'RUB' },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: process.env.BASE_URL + '/thankyou.html'
      },
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
          vat_code: it.vat_code ?? 1,           // проверь код НДС под себя
          payment_mode: 'full_payment',
          payment_subject: 'commodity'
        }))
      },
      metadata: {
        delivery,
        items: items.map(({id, title, qty, price}) => ({id, title, qty, price}))
      }
    };

    // 3) Idempotence-Key
    const idemKey = crypto.randomUUID();

    // 4) Запрос к YooKassa
    const auth = Buffer
      .from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`)
      .toString('base64');

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

    // 5) Сохрани черновик заказа (по необходимости)
    // await saveDraft({ paymentId: data.id, items, total, customer, delivery, idemKey });

    // 6) Верни ссылку для редиректа
    return res.status(200).json({
      payment_id: data.id,
      confirmation_url: data?.confirmation?.confirmation_url
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

// ===== пример серверного пересчёта =====
async function priceAndValidate(cart) {
  // 1) Подтянуть актуальные цены/остатки (JSONBin/БД)
  const inventory = await getInventory(); // сам реализуешь
  // 2) Свести позиции
  const items = cart.map(ci => {
    const stock = inventory[ci.id];
    if (!stock) throw new Error(`Item not found: ${ci.id}`);
    if (ci.qty < 1 || ci.qty > stock.qty) throw new Error(`Qty invalid for ${ci.id}`);
    const price = Number(stock.price); // цена берётся с сервера
    const lineTotal = price * ci.qty;
    return { id: ci.id, title: stock.title, qty: ci.qty, price, lineTotal, vat_code: stock.vat_code };
  });
  const total = items.reduce((s, i) => s + i.lineTotal, 0);
  return { items, total };
}

async function getInventory() {
  // Вариант с JSONBin (read-only на фронте; write — только здесь)
  // Используй секрет в заголовке, не светя его на фронт.
  // Заглушка:
  return {
    'sku-001': { title: 'GRGY Cap', price: 1990, qty: 5, vat_code: 1 },
    'sku-002': { title: 'Print A3', price: 1490, qty: 12, vat_code: 1 }
  };
}
