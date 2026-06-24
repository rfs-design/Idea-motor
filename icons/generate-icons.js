#!/usr/bin/env node
// generate-icons.js — genera le icone PNG necessarie per la PWA
// Esegui: node generate-icons.js
// Richiede: npm install sharp

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const SVG    = path.join(__dirname, 'icon.svg');
const outDir = __dirname;

async function generate(size, filename) {
  await sharp(SVG)
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, filename));
  console.log(`✓ ${filename} (${size}x${size})`);
}

(async () => {
  if (!fs.existsSync(SVG)) { console.error('icon.svg non trovato'); process.exit(1); }

  await generate(192, 'icon-192.png');
  await generate(512, 'icon-512.png');
  await generate(180, 'apple-touch-icon.png');

  console.log('\n✓ Icone generate. Copia apple-touch-icon.png in /icons/');
})();
