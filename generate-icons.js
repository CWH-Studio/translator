// generate-icons.js
// Run this script to generate PWA and Android icons from a source PNG
// Usage: node generate-icons.js

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

const sourceIcon = path.join(__dirname, 'resources', 'icon-512.png');

const androidIconSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function generateIcons() {
  // Check if source icon exists
  try {
    await fs.access(sourceIcon);
  } catch {
    console.error('❌ Source icon not found:', sourceIcon);
    console.log('Please place a 512x512 PNG icon at resources/icon-512.png');
    process.exit(1);
  }

  const outputDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

  // Generate Android icons from PNG
  for (const [dir, size] of Object.entries(androidIconSizes)) {
    const dirPath = path.join(outputDir, dir);
    await fs.mkdir(dirPath, { recursive: true });

    const filepath = path.join(dirPath, 'ic_launcher.png');
    await sharp(sourceIcon)
      .resize(size, size)
      .toFile(filepath);
    console.log(`✓ Generated ${filepath}`);
    
    const roundFilepath = path.join(dirPath, 'ic_launcher_round.png');
    await sharp(sourceIcon)
      .resize(size, size)
      .toFile(roundFilepath);
    console.log(`✓ Generated ${roundFilepath}`);
  }

  // Generate PWA icon (192x192)
  const pwaIconPath = path.join(__dirname, 'icon-192.png');
  await sharp(sourceIcon)
    .resize(192, 192)
    .toFile(pwaIconPath);
  console.log(`✓ Generated ${pwaIconPath}`);

  console.log('\n📱 All icons generated successfully!');
}

generateIcons();