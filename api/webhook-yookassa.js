module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
  try {
    // ЮKassa шлёт JSON
    const event = req.body || {};
    console.log('Webhook:', JSON.stringify(event));

    if (event.event === 'payment.succeeded') {
      const p = event.object;
      // здесь ты отметишь заказ оплаченным и спишешь остаток
      // fulfillOrder(p.id)
    }
    if (event.event === 'payment.canceled') {
      // отметить отмену / снять резерв
    }

    res.status(200).end('ok');
  } catch (e) {
    console.error(e);
    res.status(500).end('error');
  }
};
