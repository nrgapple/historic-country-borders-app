import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const SPIKE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(SPIKE, '..');
export const hash16 = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

/** The 30 legacy source colors, in the order lib/mapStyle.ts remaps them. */
export const SOURCE_COLORS = [
  '#FF6B6B','#4ECDC4','#45B7D1','#FFA07A','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9','#F8C471','#82E0AA',
  '#F1C40F','#E74C3C','#3498DB','#2ECC71','#9B59B6','#E67E22','#1ABC9C','#34495E','#F39C12','#D35400',
  '#27AE60','#2980B9','#8E44AD','#16A085','#F4D03F','#58D68D','#5DADE2','#AF7AC5','#F8D7DA','#D5DBDB',
];
