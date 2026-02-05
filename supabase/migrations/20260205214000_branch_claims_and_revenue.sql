-- Create branch_claims table
CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected', 'paid');

CREATE TABLE IF NOT EXISTS "public"."branch_claims" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "branch_id" UUID NOT NULL REFERENCES "public"."branches"("id"),
    "amount" NUMERIC NOT NULL,
    "status" claim_status DEFAULT 'pending',
    "period_start" DATE,
    "period_end" DATE,
    "notes" TEXT,
    "admin_notes" TEXT,
    "processed_by" UUID REFERENCES "public"."staff"("id"),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE "public"."branch_claims" ENABLE ROW LEVEL SECURITY;

-- Policies for branch_claims
CREATE POLICY "Directors can view their branch claims" ON "public"."branch_claims"
    FOR SELECT USING (
        (auth.uid() IN ( 
            SELECT user_id FROM staff WHERE branch_id = branch_claims.branch_id AND role = 'branch_director'
        )) OR (auth.uid() IN (SELECT user_id FROM staff WHERE role = 'admin'))
    );

CREATE POLICY "Directors can insert claims for their branch" ON "public"."branch_claims"
    FOR INSERT WITH CHECK (
        auth.uid() IN ( 
            SELECT user_id FROM staff WHERE branch_id = branch_claims.branch_id AND role = 'branch_director'
        )
    );

CREATE POLICY "Admins can update claims" ON "public"."branch_claims"
    FOR UPDATE USING (
        auth.uid() IN (SELECT user_id FROM staff WHERE role = 'admin')
    );

-- Create branch_revenue view
create or replace view branch_revenue as
select
    b.id as branch_id,
    b.name as branch_name,
    date(v.created_at) as date,
    count(v.id) as visit_count,
    coalesce(sum(v.branch_compensation), 0) as total_compensation,
    coalesce(sum(v.profit_loss), 0) as total_profit_loss
from branches b
left join visits v on b.id = v.branch_id
group by b.id, b.name, date(v.created_at);
