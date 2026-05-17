import * as fs from 'fs';
import * as path from 'path';

function processDir(d: string) {
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d, { withFileTypes: true }).forEach(ent => {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) processDir(p);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      if (p.includes('SwynLogo.tsx')) return;
      let orig = fs.readFileSync(p, 'utf8');
      
      let res = orig
        .replace(/indigo/g, 'orange')
        .replace(/purple/g, 'amber')
        .replace(/SwynMatch/g, 'Swyn');
        
      if (orig !== res) {
        fs.writeFileSync(p, res, 'utf8');
      }
    }
  });
}

processDir('./src');
