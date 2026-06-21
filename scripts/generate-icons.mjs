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

// Transparent-background SVG: magnifying glass + gear, professional mark
// Thick strokes and drop shadow ensure visibility on any taskbar color
const svgIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lens" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#6366F1"/>
      <stop offset="100%" stop-color="#8B5CF6"/>
    </linearGradient>
    <linearGradient id="gearGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#EF4444"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <!-- Magnifying glass handle — bottom-right angled -->
  <line x1="340" y1="340" x2="460" y2="460"
        stroke="url(#lens)" stroke-width="38" stroke-linecap="round"
        filter="url(#shadow)"/>
  <!-- Magnifying glass lens ring -->
  <circle cx="195" cy="195" r="130"
          fill="none" stroke="url(#lens)" stroke-width="28"
          filter="url(#shadow)"/>
  <!-- Lens inner highlight -->
  <circle cx="195" cy="195" r="130"
          fill="url(#lens)" fill-opacity="0.12"/>
  <!-- Gear body inside lens -->
  <circle cx="195" cy="195" r="62"
          fill="none" stroke="url(#gearGrad)" stroke-width="22"/>
  <!-- Gear inner ring -->
  <circle cx="195" cy="195" r="30"
          fill="none" stroke="url(#gearGrad)" stroke-width="14"/>
  <!-- Gear teeth — 8 teeth -->
  <g stroke="url(#gearGrad)" stroke-width="16" stroke-linecap="round">
    <!-- N -->
    <line x1="195" y1="93" x2="195" y2="128"/>
    <!-- NE -->
    <line x1="267" y1="123" x2="246" y2="148"/>
    <!-- E -->
    <line x1="297" y1="195" x2="262" y2="195"/>
    <!-- SE -->
    <line x1="267" y1="267" x2="246" y2="242"/>
    <!-- S -->
    <line x1="195" y1="297" x2="195" y2="262"/>
    <!-- SW -->
    <line x1="123" y1="267" x2="144" y2="242"/>
    <!-- W -->
    <line x1="93" y1="195" x2="128" y2="195"/>
    <!-- NW -->
    <line x1="123" y1="123" x2="144" y2="148"/>
  </g>
  <!-- Center dot -->
  <circle cx="195" cy="195" r="10" fill="url(#gearGrad)"/>
</svg>`;

const sizes = [
  { name: '32x32.png',    size: 32 },
  { name: '128x128.png',  size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png',     size: 256 },
];

async function generate() {
  for (const { name, size } of sizes) {
    const svg = svgIcon(size);
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    const outPath = resolve(iconsDir, name);
    writeFileSync(outPath, buf);
    console.log(`Created ${name} (${buf.length} bytes)`);
  }

  // Generate multi-resolution ICO: 16, 24, 32, 48, 256
  const icoSizes = [16, 24, 32, 48, 256];
  const icoPngs = await Promise.all(
    icoSizes.map((s) => sharp(Buffer.from(svgIcon(s))).png().toBuffer())
  );
  const icoBuf = await ico(icoPngs);
  const icoPath = resolve(iconsDir, 'icon.ico');
  writeFileSync(icoPath, icoBuf);
  console.log(`Created icon.ico (${icoBuf.length} bytes)`);

  console.log('\nAll icon files generated successfully.');
}

generate().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
