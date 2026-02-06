
import https from 'https';

const consumerKey = "v8BxQzwnjeMuddnQ3fCaiTT4Kz7S6qD0zAUcbIWwiDYWlEuM";
const consumerSecret = "ezORYyIPAzFgXRGSTmIXXR96SNlfKNRCk9v6GDMqoDay35dOo21qxXvE8o9GpBuA";

const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

const options = {
    hostname: 'sandbox.safaricom.co.ke',
    path: '/oauth/v1/generate?grant_type=client_credentials',
    method: 'GET',
    headers: {
        'Authorization': `Basic ${auth}`
    }
};

console.log("Testing creds...");

const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);

    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.end();
