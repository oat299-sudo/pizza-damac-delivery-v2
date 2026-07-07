const http = require('http');

const payload = JSON.stringify({
  data: {
    serviceType: 'MOTORCYCLE',
    stops: [
      {
        coordinates: { lat: '13.7563', lng: '100.5018' },
        address: "Pizza Damac Nonthaburi"
      },
      {
        coordinates: { lat: '13.7663', lng: '100.5118' },
        address: "Customer Address"
      }
    ],
    item: {
      quantity: "1",
      weight: "1.0",
      categories: ["FOOD_DELIVERY"],
      deliveries: [
        {
          toStopId: "1",
          toContactName: "Customer",
          toContactPhone: "+66890000000"
        }
      ]
    }
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/lalamove/quote',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, data));
});
req.on('error', (e) => console.error(e));
req.write(payload);
req.end();
