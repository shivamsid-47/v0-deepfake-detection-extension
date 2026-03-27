// Script to generate PNG icons from SVG
// Run with: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

// Simple shield SVG
const createShieldSVG = (size, color = '#6b7280') => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
  <path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z" fill="${color}" stroke="${color}" stroke-width="1"/>
  <path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.3"/>
</svg>
`;

const sizes = [16, 48, 128];
const outputDir = path.join(__dirname, '../public/extension/icons');

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write SVG files (Chrome can use SVG in manifest v3)
sizes.forEach(size => {
  const svg = createShieldSVG(size, '#6b7280');
  fs.writeFileSync(path.join(outputDir, `icon-${size}.svg`), svg);
  console.log(`Created icon-${size}.svg`);
});

console.log('Icons generated successfully!');
