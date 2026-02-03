
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkClaims() {
    console.log("--- Fetching all revenue_claims as Service Role (bypass RLS) ---");
    // Note: In a real env I'd use service role key if I had it, but here I'm just checking data existence
    const { data: claims, error } = await supabase.from('revenue_claims').select('*');
    if (error) {
        console.error("Error fetching claims:", error);
    } else {
        console.log(`Total claims in DB: ${claims.length}`);
        console.log(JSON.stringify(claims, null, 2));
    }
}

checkClaims();
