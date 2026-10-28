// Measure the visible ink of each colour logo once, so the TV can size them evenly without pixel work.
import { readdirSync, writeFileSync } from 'node:fs';
import { openPreview, root } from './browser.mjs';

const files = readdirSync(root + 'app/assets/logos').filter(n => /\.(png|svg|webp)$/.test(n));
const preview = await openPreview();
try {
  const page = await preview.browser.newPage();
  await page.goto(preview.baseURL + '/home/');
  const metrics = await page.evaluate(async files => {
    const result = {}, size = 240;
    for (const file of files) {
      const image = new Image();
      image.src = '/home/assets/logos/' + file;
      await image.decode();
      // Draw contained in a square, as the TV draws it with object-fit:contain.
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      const k = Math.min(size / image.naturalWidth, size / image.naturalHeight), w = image.naturalWidth * k, h = image.naturalHeight * k;
      context.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
      const pixels = context.getImageData(0, 0, size, size).data;
      let left = size, top = size, right = -1, bottom = -1;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (pixels[(y * size + x) * 4 + 3] > 40) {
            left = Math.min(left, x); top = Math.min(top, y);
            right = Math.max(right, x); bottom = Math.max(bottom, y);
          }
        }
      }
      if (right < left || bottom < top) throw Error('Empty logo: ' + file);
      result[file] = { n: size, x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
    }
    return result;
  }, files);
  writeFileSync(root + 'app/assets/logos/metrics.js', '/* Visible logo ink measured at build time by scripts/build-logo-metrics.mjs. */\nwindow.FrameLogoMetrics = ' + JSON.stringify(metrics) + ';\n');
  console.log('Measured ' + files.length + ' logos. Output: app/assets/logos/metrics.js');
} finally { await preview.close(); }
