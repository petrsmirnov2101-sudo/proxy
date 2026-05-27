const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, public_key, path } = req.query;

  if (!action || !public_key) {
    return res.status(400).json({ error: 'Missing action or public_key' });
  }

  const encodedKey = encodeURIComponent(public_key);

  try {
    if (action === 'list') {
      const pathParam = path ? `&path=${encodeURIComponent(path)}` : '';
      const url = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodedKey}${pathParam}&limit=100`;
      const result = await fetchJSON(url);
      return res.status(result.status).json(result.body);
    }

    if (action === 'download') {
      const pathParam = path ? `&path=${encodeURIComponent(path)}` : '';
      const url = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodedKey}${pathParam}`;
      const result = await fetchJSON(url);
      return res.status(result.status).json(result.body);
    }

    return res.status(400).json({ error: 'Unknown action. Use list or download' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
