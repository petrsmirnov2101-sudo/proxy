export default async function handler(req, res) {
  const { action, public_key, path } = req.query;

  let url = 'https://cloud-api.yandex.net/v1/disk/public/resources';
  if (action === 'download') url += '/download';

  url += `?public_key=${encodeURIComponent(public_key)}`;
  if (path) url += `&path=${encodeURIComponent(path)}`;
  url += '&limit=100';

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
