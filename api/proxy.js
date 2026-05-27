const https = require('https');
const http  = require('http');

/* ── Вспомогательные функции ── */

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (resp) => {
      let data = '';
      resp.on('data', (ch) => { data += ch; });
      resp.on('end', () => {
        try {
          resolve({ status: resp.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: resp.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

function fetchStream(url, maxRedirects) {
  if (maxRedirects === undefined) maxRedirects = 10;
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
        resp.resume();
        return resolve(fetchStream(resp.headers.location, maxRedirects - 1));
      }
      resolve(resp);
    }).on('error', reject);
  });
}

function extractFilename(path) {
  if (!path) return 'download';
  var parts = path.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || 'download';
}

/* ── Основной обработчик ── */

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  var action     = req.query.action;
  var public_key = req.query.public_key;
  var path       = req.query.path;
  var fname      = req.query.filename;          // ★ НОВОЕ: имя файла из UI

  if (!action || !public_key) {
    return res.status(400).json({ error: 'Missing action or public_key' });
  }

  var ek = encodeURIComponent(public_key);
  var ep = path ? '&path=' + encodeURIComponent(path) : '';

  try {
    // ===== Список файлов =====
    if (action === 'list') {
      var listUrl = 'https://cloud-api.yandex.net/v1/disk/public/resources?public_key=' + ek + ep + '&limit=100';
      var listResult = await fetchJson(listUrl);
      return res.status(listResult.status).json(listResult.body);
    }

    // ===== Получить ссылку (JSON) =====
    if (action === 'download') {
      var dlUrl = 'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' + ek + ep;
      var dlResult = await fetchJson(dlUrl);
      return res.status(dlResult.status).json(dlResult.body);
    }

    // ===== Скачать файл через прокси =====
    if (action === 'fetch') {
      // Шаг 1: получаем прямую ссылку от API
      var apiUrl = 'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' + ek + ep;
      var apiResult = await fetchJson(apiUrl);

      if (!apiResult.body || !apiResult.body.href) {
        return res.status(400).json({
          error: 'No download link',
          detail: apiResult.body
        });
      }

      // Шаг 2: скачиваем файл, следуя за редиректами
      var fileStream = await fetchStream(apiResult.body.href);

      // Шаг 3: определяем имя файла
      // Приоритет: query-параметр > путь > фоллбэк
      var filename = fname || extractFilename(path);

      // Шаг 4: заголовки
      var ct = fileStream.headers['content-type'];
      var cl = fileStream.headers['content-length'];

      if (ct) {
        res.setHeader('Content-Type', ct);
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
      }

      if (cl) {
        res.setHeader('Content-Length', cl);
      }

      // ★ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: двойной формат для поддержки кириллицы
      var encoded = encodeURIComponent(filename);
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="' + encoded + '"; filename*=UTF-8\'\'' + encoded
      );

      // Шаг 5: стримим файл клиенту
      res.status(fileStream.statusCode || 200);
      fileStream.pipe(res);
      return;
    }

    return res.status(400).json({ error: 'Invalid action. Use: list, download, fetch' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
