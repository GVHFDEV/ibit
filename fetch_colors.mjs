import https from 'https';

https.get('https://carnelianescuderia.vercel.app/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const cssLinks = data.match(/href="([^"]+\.css)"/gi);
    const colors = data.match(/#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)/g);
    console.log('CSS Links:', cssLinks);
    console.log('Inline Colors:', [...new Set(colors)]);
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
