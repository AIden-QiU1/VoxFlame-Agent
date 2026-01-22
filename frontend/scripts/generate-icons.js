/**
 * PWA 图标生成脚本
 * 使用 sharp 库从 SVG 生成各种尺寸的 PNG 图标
 * 运行: node scripts/generate-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '../public/icons');
const SVG_SOURCE = path.join(__dirname, '../public/icon.svg');

const ICON_SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512];
const APPLE_SIZES = [57, 60, 72, 76, 114, 120, 144, 152, 180];

async function generateIcons() {
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  const svgBuffer = fs.readFileSync(SVG_SOURCE);
  console.log('🎨 开始生成 PWA 图标...\n');

  // 标准图标
  for (const size of ICON_SIZES) {
    const filename = `icon-${size}x${size}.png`;
    await sharp(svgBuffer).resize(size, size).png().toFile(path.join(ICONS_DIR, filename));
    console.log(`✅ ${filename}`);
  }

  // Maskable 图标
  for (const size of [192, 512]) {
    const filename = `icon-maskable-${size}x${size}.png`;
    const padding = Math.floor(size * 0.1);
    const innerSize = size - padding * 2;
    await sharp(svgBuffer)
      .resize(innerSize, innerSize)
      .extend({ top: padding, bottom: padding, left: padding, right: padding, background: { r: 245, g: 158, b: 11, alpha: 1 } })
      .png()
      .toFile(path.join(ICONS_DIR, filename));
    console.log(`✅ ${filename} (maskable)`);
  }

  // Apple touch icons
  for (const size of APPLE_SIZES) {
    const filename = `apple-touch-icon-${size}x${size}.png`;
    await sharp(svgBuffer).resize(size, size).png().toFile(path.join(ICONS_DIR, filename));
    console.log(`✅ ${filename}`);
  }

  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(ICONS_DIR, 'apple-touch-icon.png'));
  console.log(`✅ apple-touch-icon.png`);

  // 快捷方式图标
  const micSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="18" fill="#F59E0B"/><path fill="white" d="M48 12c-6.6 0-12 5.4-12 12v24c0 6.6 5.4 12 12 12s12-5.4 12-12V24c0-6.6-5.4-12-12-12z"/><path fill="white" d="M66 42v6c0 9.9-8.1 18-18 18s-18-8.1-18-18v-6h-6v6c0 12.3 9.4 22.5 21.5 23.8V78H38v6h20v-6h-7.5v-6.2c12.1-1.3 21.5-11.5 21.5-23.8v-6h-6z"/></svg>`;
  await sharp(Buffer.from(micSvg)).resize(96, 96).png().toFile(path.join(ICONS_DIR, 'shortcut-mic.png'));
  console.log(`✅ shortcut-mic.png`);

  const contributeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="18" fill="#F59E0B"/><path fill="white" d="M48 18c-16.5 0-30 13.5-30 30s13.5 30 30 30 30-13.5 30-30-13.5-30-30-30zm13.5 33h-10.5v10.5c0 1.7-1.3 3-3 3s-3-1.3-3-3V51H34.5c-1.7 0-3-1.3-3-3s1.3-3 3-3H45V34.5c0-1.7 1.3-3 3-3s3 1.3 3 3V45h10.5c1.7 0 3 1.3 3 3s-1.3 3-3 3z"/></svg>`;
  await sharp(Buffer.from(contributeSvg)).resize(96, 96).png().toFile(path.join(ICONS_DIR, 'shortcut-contribute.png'));
  console.log(`✅ shortcut-contribute.png`);

  // Favicons
  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(ICONS_DIR, 'favicon-32x32.png'));
  await sharp(svgBuffer).resize(16, 16).png().toFile(path.join(ICONS_DIR, 'favicon-16x16.png'));
  console.log(`✅ favicon-32x32.png\n✅ favicon-16x16.png`);

  // Safari pinned tab
  const safariSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#F59E0B" d="M256 64c-26.5 0-48 21.5-48 48v128c0 26.5 21.5 48 48 48s48-21.5 48-48V112c0-26.5-21.5-48-48-48z"/><path fill="#F59E0B" d="M352 224v16c0 53-43 96-96 96s-96-43-96-96v-16h-32v16c0 65.8 50.2 120 114 127v49h-50v32h132v-32h-50v-49c63.8-7 114-61.2 114-127v-16h-32z"/></svg>`;
  fs.writeFileSync(path.join(ICONS_DIR, 'safari-pinned-tab.svg'), safariSvg);
  console.log(`✅ safari-pinned-tab.svg`);

  console.log('\n🎉 所有图标生成完成！');
}

generateIcons().catch(console.error);
