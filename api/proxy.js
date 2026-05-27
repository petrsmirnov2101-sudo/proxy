export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Укажи ?url=ССЫЛКА' });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const contentType = response.headers.get('content-type');
    const data = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.send(Buffer.from(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
