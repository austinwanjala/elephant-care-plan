
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRevenue() {
    console.log("--- Checking branch_revenue records ---");
    const { data: rev, error: revErr } = await supabase.from('branch_revenue').select('*');
    if (revErr) console.error(revErr);
    else console.log(rev);

    console.log("--- Reading revenue_claims ---");
    const { data: claims, error: claimErr } = await supabase.from('revenue_claims').select('*');
    if (claimErr) console.error(claimErr);
    else console.log(claims);

    console.log("--- Tallying visits compensation ---");
    const { data: visits, error: visitErr } = await supabase.from('visits').select('branch_compensation');
    if (visitErr) console.error(visitErr);
    else {
        const total = visits.reduce((sum, v) => sum + (Number(v.branch_compensation) || 0), 0);
        console.log("Total Compensation in visits table:", total);
    }
}

checkRevenue();
