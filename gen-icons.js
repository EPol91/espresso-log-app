// Converte icon.svg nei PNG richiesti dalla PWA (192/512/180).
// Usa il TTF Bebas Neue in _iconbuild/ per rendere il wordmark.
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');

const svg = fs.readFileSync(__dirname + '/icon.svg', 'utf8');
const fontBuffer = fs.readFileSync(__dirname + '/_iconbuild/Oswald.ttf');

function render(size, out){
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { fontBuffers: [fontBuffer], loadSystemFonts: false, defaultFontFamily: 'Oswald' }
  });
  const png = resvg.render().asPng();
  fs.writeFileSync(__dirname + '/' + out, png);
  console.log('wrote', out, size + 'x' + size);
}

render(192, 'icon-192.png');
render(512, 'icon-512.png');
render(180, 'apple-touch-icon.png');
