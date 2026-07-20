/**
 * 图标生成脚本
 * 优先从 icon-source.png 生成各尺寸；若无源 PNG 则回退到 icon.svg。
 *
 * 使用方法:
 *   node scripts/generate-icons.js
 *   node scripts/generate-ico.js
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.join(__dirname, '../src-tauri/icons');
const pngSourcePath = path.join(iconsDir, 'icon-source.png');
const svgPath = path.join(iconsDir, 'icon.svg');
const publicLogoPath = path.join(__dirname, '../public/logo.png');

// Tauri 需要的图标尺寸
const sizes = [
  { name: '32x32.png', size: 32 },
  // Windows 大图标视图会优先使用 48px 资源，缺失时容易出现放大模糊。
  { name: '48x48.png', size: 48 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
  // Windows Store 图标
  { name: 'Square30x30Logo.png', size: 30 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square71x71Logo.png', size: 71 },
  { name: 'Square89x89Logo.png', size: 89 },
  { name: 'Square107x107Logo.png', size: 107 },
  { name: 'Square142x142Logo.png', size: 142 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'Square284x284Logo.png', size: 284 },
  { name: 'Square310x310Logo.png', size: 310 },
  { name: 'StoreLogo.png', size: 50 },
];

async function loadSourceImage() {
  if (fs.existsSync(pngSourcePath)) {
    console.log(`使用 PNG 源图: ${pngSourcePath}`);
    return sharp(pngSourcePath);
  }

  if (fs.existsSync(svgPath)) {
    console.log(`使用 SVG 源图: ${svgPath}`);
    return sharp(fs.readFileSync(svgPath));
  }

  throw new Error('未找到 icon-source.png 或 icon.svg，无法生成图标');
}

/**
 * 生成圆角矩形 Alpha 遮罩 PNG。
 * 源图若用黑底导出，四角会在 Windows 桌面/任务栏显示黑边，需裁成透明。
 */
async function createRoundedRectMaskImage(size, radiusRatio = 0.223) {
  const radius = Math.round(size * radiusRatio);
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
  </svg>`;

  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

/** 统一源图尺寸并套用圆角遮罩，输出带透明通道的 PNG Buffer */
async function prepareSourceBuffer() {
  const source = await loadSourceImage();
  const meta = await source.metadata();
  const baseSize = Math.max(meta.width ?? 512, meta.height ?? 512);
  const maskImage = await createRoundedRectMaskImage(baseSize);

  return source
    .resize(baseSize, baseSize, {
      fit: 'cover',
      position: 'centre',
    })
    .ensureAlpha()
    .composite([
      {
        input: maskImage,
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();
}

async function generateIcons() {
  console.log('开始生成图标...\n');

  const sourceBuffer = await prepareSourceBuffer();
  const source = sharp(sourceBuffer);

  for (const { name, size } of sizes) {
    const outputPath = path.join(iconsDir, name);

    await source
      .clone()
      .resize(size, size, {
        fit: 'cover',
        position: 'centre',
      })
      .png()
      .toFile(outputPath);

    console.log(`✓ 生成 ${name} (${size}x${size})`);
  }

  // 同步一份到 public，供启动屏与网页 favicon 使用。
  await source
    .clone()
    .resize(512, 512, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(publicLogoPath);

  // 回写源图，避免后续手工替换 PNG 时再次带入黑底四角。
  fs.writeFileSync(pngSourcePath, sourceBuffer);

  console.log(`✓ 同步 public/logo.png`);
  console.log(`✓ 回写 icon-source.png（透明圆角）`);
  console.log('\n所有图标生成完成！');
  console.log('\n请继续执行: node scripts/generate-ico.js');
}

generateIcons().catch(console.error);
