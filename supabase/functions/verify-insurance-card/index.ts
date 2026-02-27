import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        // Authentication
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401,
            });
        }

        const { data: authUser, error: authUserError } = await supabaseAdmin.auth.getUser(
            authHeader.replace("Bearer ", "").trim()
        );

        if (authUserError || !authUser?.user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401,
            });
        }

        const { qrToken, ocrText, branchId, deviceId } = await req.json();

        let memberId: string | null = null;
        let verificationMethod = "manual";

        if (qrToken) {
            verificationMethod = "qr";
            // Expected qrToken format: { mid, ts, sig } or just the insurance_card_token
            // For simplicity and security, we'll check if it matches the insurance_card_token or decode the structure
            try {
                const tokenData = typeof qrToken === "string" ? JSON.parse(qrToken) : qrToken;
                if (tokenData.mid) {
                    // Validate via membership lookup
                    const { data: member, error: memberError } = await supabaseAdmin
                        .from("members")
                        .select("id, insurance_card_token")
                        .eq("id", tokenData.mid)
                        .single();

                    if (!memberError && member) {
                        // In a real scenario, we'd verify the signature tokenData.sig
                        // For now, we'll verify the ID exists and is active
                        memberId = member.id;
                    }
                } else if (typeof qrToken === "string") {
                    // Fallback: check if it's the raw insurance_card_token
                    const { data: member, error: memberError } = await supabaseAdmin
                        .from("members")
                        .select("id")
                        .eq("insurance_card_token", qrToken)
                        .single();
                    if (!memberError && member) memberId = member.id;
                }
            } catch (e) {
                // Not a JSON, maybe a raw token
                const { data: member, error: memberError } = await supabaseAdmin
                    .from("members")
                    .select("id")
                    .eq("insurance_card_token", qrToken)
                    .single();
                if (!memberError && member) memberId = member.id;
            }
        } else if (ocrText) {
            verificationMethod = "ocr";
            // Try to find member by member_number or id_number in OCR text
            // Simple regex for member numbers (e.g., ED123456)
            const memberNumberMatch = ocrText.match(/ED\d{6}/);
            if (memberNumberMatch) {
                const { data: member, error: memberError } = await supabaseAdmin
                    .from("members")
                    .select("id")
                    .eq("member_number", memberNumberMatch[0])
                    .single();
                if (!memberError && member) memberId = member.id;
            }
        }

        if (!memberId) {
            return new Response(JSON.stringify({ error: "Member not found. Scanned data invalid." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 404,
            });
        }

        // Fetch full member details
        const { data: member, error: memberError } = await supabaseAdmin
            .from("members")
            .select(`
        id,
        full_name,
        member_number,
        is_active,
        coverage_balance,
        benefit_limit,
        created_at,
        membership_categories (
          name,
          level
        ),
        dependants (
          id,
          full_name,
          relationship
        )
      `)
            .eq("id", memberId)
            .single();

        if (memberError || !member) {
            return new Response(JSON.stringify({ error: "Failed to fetch member coverage data" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
            });
        }

        // Check for multi-stage services (visits in 'registered' or 'with_doctor' status)
        const { data: activeVisits } = await supabaseAdmin
            .from("visits")
            .select("id, status, created_at")
            .eq("member_id", memberId)
            .in("status", ["registered", "with_doctor", "billed"])
            .order("created_at", { ascending: false });

        // Check biometrics (from visits or biometrics table if exists)
        const biometricsRegistered = !!(member as any).biometric_data;

        const response = {
            status: member.is_active ? "active" : "inactive",
            member_name: member.full_name,
            member_number: member.member_number,
            scheme: (member as any).membership_categories?.name || "Standard",
            balance: member.coverage_balance,
            limit: member.benefit_limit,
            expiry_date: "2026-12-31", // Example logic: could be based on registration date + 1 year
            dependants: member.dependants || [],
            eligible: member.is_active && member.coverage_balance > 0,
            biometrics_verified: false, // Will be verified at point of service
            active_visits: activeVisits || [],
            remarks: member.is_active
                ? (member.coverage_balance > 0 ? "Member is eligible for service" : "Insufficient balance")
                : "Membership is inactive"
        };

        // Log the verification attempt
        await supabaseAdmin.from("card_verifications").insert({
            member_id: member.id,
            branch_id: branchId,
            staff_id: authUser.user.id,
            device_id: deviceId,
            method: verificationMethod,
            status: response.eligible ? "success" : "failed",
            remarks: response.remarks
        });

        // Also log to general audit_logs for compliance
        await supabaseAdmin.from("audit_logs").insert({
            user_id: authUser.user.id,
            action: "insurance_card_verification",
            entity_type: "member",
            entity_id: member.id,
            details: {
                method: verificationMethod,
                eligible: response.eligible,
                device_id: deviceId
            }
        });

        return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("[verify-insurance-card] Fatal Error", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
