
import https from 'https';

const data = JSON.stringify({
    amount: 1,
    phone: "254700000000",
    member_id: "test-member-id"
});

const options = {
    hostname: 'wtzdddcogjtzzmgjbbvz.supabase.co',
    path: '/functions/v1/mpesa-stk-push',
    method: 'POST',
    headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0emRkZGNvZ2p0enptZ2piYnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTcwMTYsImV4cCI6MjA4NTE5MzAxNn0.hm9Gi0gG16q_KYNeoPTXJw8zWelQ4eRW-Tj4feP_JSc',
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);

    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
