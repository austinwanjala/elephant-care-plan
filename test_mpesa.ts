
const url = "https://wtzdddcogjtzzmgjbbvz.supabase.co/functions/v1/mpesa-stk-push";
const headers = {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0emRkZGNvZ2p0enptZ2piYnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTcwMTYsImV4cCI6MjA4NTE5MzAxNn0.hm9Gi0gG16q_KYNeoPTXJw8zWelQ4eRW-Tj4feP_JSc",
    "Content-Type": "application/json"
};
const body = JSON.stringify({
    amount: 1,
    phone: "254700000000",
    member_id: "test-member-id"
});

try {
    const response = await fetch(url, { method: "POST", headers, body });
    const text = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Body: ${text}`);
} catch (error) {
    console.error("Fetch failed:", error);
}
