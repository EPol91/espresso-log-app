// Converte icon.svg nei PNG richiesti dalla PWA (192/512/180).
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');

const svg = fs.readFileSync(__dirname + '/icon.svg', 'utf8');

function render(size, out){
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  const png = resvg.render().asPng();
  fs.writeFileSync(__dirname + '/' + out, png);
  console.log('wrote', out, size + 'x' + size);
}

render(192, 'icon-192.png');
render(512, 'icon-512.png');
render(180, 'apple-touch-icon.png');
