// Genera icone PNG semplici (monogramma "E" gold su sfondo scuro) senza dipendenze esterne.
const zlib = require('zlib');
const fs = require('fs');

const BG = [13, 13, 13];       // #0d0d0d
const GOLD = [201, 162, 39];   // #c9a227

// font bitmap 5x7 per "E"
const E_GLYPH = [
  '11111',
  '10000',
  '10000',
  '11110',
  '10000',
  '10000',
  '11111'
];

function buildPixels(size){
  const px = new Uint8Array(size * size * 4);
  const glyphRows = E_GLYPH.length, glyphCols = E_GLYPH[0].length;
  const scale = Math.floor(size * 0.5 / glyphRows);
  const gW = glyphCols * scale, gH = glyphRows * scale;
  const offX = Math.floor((size - gW) / 2), offY = Math.floor((size - gH) / 2);
  const margin = Math.round(size * 0.08);

  for(let y = 0; y < size; y++){
    for(let x = 0; x < size; x++){
      const idx = (y * size + x) * 4;
      let col = BG;

      // bordo arrotondato gold sottile
      const border = margin;
      const onBorderRing = (x >= border && x < size-border && y >= border && y < size-border);

      // glifo "E"
      let isGlyph = false;
      if(x >= offX && x < offX+gW && y >= offY && y < offY+gH){
        const gr = Math.floor((y-offY)/scale);
        const gc = Math.floor((x-offX)/scale);
        if(E_GLYPH[gr][gc] === '1') isGlyph = true;
      }
      if(isGlyph) col = GOLD;

      px[idx] = col[0]; px[idx+1] = col[1]; px[idx+2] = col[2]; px[idx+3] = 255;

      // cornice sottile gold
      const w = 3;
      if((x < w || x >= size-w || y < w || y >= size-w) && !isGlyph){
        px[idx] = GOLD[0]; px[idx+1] = GOLD[1]; px[idx+2] = GOLD[2]; px[idx+3] = 255;
      }
    }
  }
  return px;
}

function crc32(buf){
  let table = crc32.table;
  if(!table){
    table = crc32.table = new Int32Array(256);
    for(let n=0;n<256;n++){
      let c = n;
      for(let k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let crc = -1;
  for(let i=0;i<buf.length;i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data){
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function writePNG(size, outPath){
  const px = buildPixels(size);
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // raw scanlines con filter byte 0 per riga
  const raw = Buffer.alloc(size * (1 + size*4));
  for(let y=0;y<size;y++){
    const rowStart = y * (1 + size*4);
    raw[rowStart] = 0;
    px.copy ? null : null;
    for(let x=0;x<size;x++){
      const srcIdx = (y*size+x)*4;
      const dstIdx = rowStart + 1 + x*4;
      raw[dstIdx] = px[srcIdx];
      raw[dstIdx+1] = px[srcIdx+1];
      raw[dstIdx+2] = px[srcIdx+2];
      raw[dstIdx+3] = px[srcIdx+3];
    }
  }
  const idatData = zlib.deflateSync(raw);

  const png = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(outPath, png);
  console.log('wrote', outPath, size+'x'+size);
}

writePNG(192, __dirname + '/icon-192.png');
writePNG(512, __dirname + '/icon-512.png');
writePNG(180, __dirname + '/apple-touch-icon.png');
