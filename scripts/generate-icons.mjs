import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import ico from 'to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '..', 'src-tauri', 'icons');

if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

// SVG: magnifying glass + gear on a rounded square background
// Designed to be visible on both dark and light taskbars
const svgIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#7C3AED"/>
    </linearGradient>
  </defs>
  <!-- Rounded background -->
  <rect x="24" y="24" width="464" height="464" rx="96" ry="96" fill="url(#bg)"/>
  <!-- Magnifying glass -->
  <g transform="translate(155, 140)" stroke="white" stroke-width="22" fill="none">
    <circle cx="88" cy="88" r="72" stroke-linecap="round"/>
    <line x1="138" y1="138" x2="188" y2="188" stroke-linecap="round"/>
  </g>
  <!-- Gear -->
  <g transform="translate(312, 256)" stroke="white" stroke-width="18" fill="none">
    <circle cx="0" cy="0" r="56"/>
    <circle cx="0" cy="0" r="28" stroke-width="14"/>
    <!-- Gear teeth -->
    <g stroke-width="14" stroke-linecap="round">
      <line x1="0" y1="-76" x2="0" y2="-56"/>
      <line x1="0" y1="56" x2="0" y2="76"/>
      <line x1="-76" y1="0" x2="-56" y2="0"/>
      <line x1="56" y1="0" x2="76" y2="0"/>
      <line x1="-54" y1="-54" x2="-40" y2="-40"/>
      <line x1="40" y1="40" x2="54" y2="54"/>
      <line x1="54" y1="-54" x2="40" y2="-40"/>
      <line x1="-40" y1="40" x2="-54" y2="54"/>
    </g>
  </g>
</svg>`;

const sizes = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 256 },
];

async function generate() {
  for (const { name, size } of sizes) {
    const svg = svgIcon(size);
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    const outPath = resolve(iconsDir, name);
    writeFileSync(outPath, buf);
    console.log(`Created ${name} (${buf.length} bytes)`);
  }

  // Generate ICO from 32x32 PNG
  const png32 = await sharp(Buffer.from(svgIcon(32))).png().toBuffer();
  const icoBuf = await ico([png32]);
  const icoPath = resolve(iconsDir, 'icon.ico');
  writeFileSync(icoPath, icoBuf);
  console.log(`Created icon.ico (${icoBuf.length} bytes)`);

  console.log('\nAll icon files generated successfully.');
}

generate().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
