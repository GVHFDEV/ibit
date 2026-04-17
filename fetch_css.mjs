import https from 'https';

https.get('https://carnelianescuderia.vercel.app/style.css', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(data.substring(0, 1000));
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
