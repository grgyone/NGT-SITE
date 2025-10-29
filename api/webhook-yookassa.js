export const config = { api: { bodyParser: false } }; // получим «сырой» body

import { createHmac } from 'node:crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  try {
    const raw = await readRawBody(req);
    const sig = req.headers['content-hmac'] || req.headers['content-signature'];

    // (опционально) проверить подпись, если включена в ЛК
    if (sig && !verifySignature(raw, sig)) {
      return res.status(401).end('Bad signature');
    }

    const event = JSON.parse(raw.toString('utf8'));

    if (event.event === 'payment.succeeded') {
      const p = event.object;
      // 1) отметить заказ оплаченным (paymentId = p.id)
      // 2) списать остаток
      // 3) отправить письмо/уведомление
      // await fulfillOrder(p.id);
    }

    if (event.event === 'payment.canceled') {
      // отметить как отменённый/освободить резерв
    }

    return res.status(200).end('ok');
  } catch (e) {
    console.error(e);
    return res.status(500).end('error');
  }
}

function verifySignature(raw, headerValue) {
  // пример под HMAC-схему; адаптируй под фактический формат подписи в ЛК
  const secret = process.env.YOOKASSA_SECRET_KEY;
  const h = createHmac('sha256', secret).update(raw).digest('hex');
  return headerValue.includes(h);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
