// Use CommonJS for ESM project: filename ends with .cjs
const tinycolor = require('tinycolor2');
const pairs = require('./contrast-pairs.json');

function checkContrast() {
  console.log('Contrast Audit Report:');
  let pass = true;
  pairs.forEach(p => {
    const ratio = tinycolor.readability(p.fg, p.bg);
    const meets = (ratio >= 4.5) ? 'PASS' : 'FAIL';
    if (ratio < 4.5) pass = false;
    console.log(`${p.fgClass} on ${p.bgClass} (${p.description}): ${ratio.toFixed(2)} - ${meets}`);
  });
  if (!pass) {
    process.exit(1);
  }
}

checkContrast();
