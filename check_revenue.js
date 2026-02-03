
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRevenue() {
    console.log("--- Checking ALL branch_revenue records ---");
    const { data: rev, error: revErr } = await supabase.from('branch_revenue').select('branch_id, date, total_compensation');
    if (revErr) console.error("Error fetching branch_revenue:", revErr);
    else {
        console.log(`Found ${rev.length} revenue records.`);
        const totals = {};
        rev.forEach(r => {
            totals[r.branch_id] = (totals[r.branch_id] || 0) + Number(r.total_compensation);
        });
        console.log("Total Revenue by Branch (from branch_revenue):", totals);
    }

    console.log("\n--- Checking ALL revenue_claims ---");
    const { data: claims, error: claimErr } = await supabase.from('revenue_claims').select('branch_id, amount, status');
    if (claimErr) console.error("Error fetching revenue_claims:", claimErr);
    else {
        console.log(`Found ${claims.length} claims.`);
        const totals = {};
        claims.forEach(c => {
            if (['pending', 'paid'].includes(c.status)) {
                totals[c.branch_id] = (totals[c.branch_id] || 0) + Number(c.amount);
            }
        });
        console.log("Total Claimed by Branch:", totals);
    }

    console.log("\n--- Checking ALL visits compensation ---");
    const { data: visits, error: visitErr } = await supabase.from('visits').select('branch_id, branch_compensation, status');
    if (visitErr) console.error("Error fetching visits:", visitErr);
    else {
        console.log(`Found ${visits.length} visits.`);
        const totals = {};
        const statusCounts = {};
        visits.forEach(v => {
            statusCounts[v.status] = (statusCounts[v.status] || 0) + 1;
            if (v.status === 'completed') {
                totals[v.branch_id] = (totals[v.branch_id] || 0) + (Number(v.branch_compensation) || 0);
            }
        });
        console.log("Visit Status Counts:", statusCounts);
        console.log("Total Compensation in visits table (completed only):", totals);
    }

    console.log("\n--- Checking ALL branches ---");
    const { data: branches, error: branchErr } = await supabase.from('branches').select('id, name');
    if (branchErr) console.error("Error fetching branches:", branchErr);
    else {
        console.log("Branches:", branches.map(b => `${b.name} (${b.id})`));
    }
}

checkRevenue();
