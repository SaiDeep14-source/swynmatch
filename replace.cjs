const fs = require('fs');
const file = 'src/components/ExpertsDirectory.tsx';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace(/import \{ v4 as uuidv4 \} from 'uuid';/, "import { v4 as uuidv4 } from 'uuid';\nimport { authFetch } from '../lib/api';");
content = content.replace(/await fetch\(/g, 'await authFetch(');
fs.writeFileSync(file, content);
