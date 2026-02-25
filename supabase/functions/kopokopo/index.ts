import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedToken: { token: string; expiry: number } | null = null;

async function getAccessToken() {
  const clientId = Deno.env.get("KOPO_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("KOPO_CLIENT_SECRET")?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("KopoKopo credentials missing (KOPO_CLIENT_ID or KOPO_CLIENT_SECRET)");
  }

  if (cachedToken && cachedToken.expiry > Date.now()) {
    return cachedToken.token;
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch("https://api.kopokopo.com/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ "grant_type": "client_credentials" })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`KopoKopo OAuth failed: ${errorText}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiry: Date.now() + (data.expires_in * 1000) - 60000
  };

  return data.access_token;
}

// Improved signature verification with logging
async function verifySignature(payload: string, signature: string, apiKey: string) {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const messageData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));

    // Check both Hex and Base64 since KopoKopo variants exist
    const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const signatureBase64 = btoa(String.fromCharCode.apply(null, signatureArray));

    console.log("[kopokopo] Received Signature:", signature);
    console.log("[kopokopo] Calculated Hex:", signatureHex);
    console.log("[kopokopo] Calculated Base64:", signatureBase64);

    return signature.toLowerCase() === signatureHex.toLowerCase() || signature === signatureBase64;
  } catch (e) {
    console.error("[kopokopo] Signature verification error:", e.message);
    return false;
  }
}

// Function to send SMS confirmation via KopoKopo Messaging API
async function sendSmsConfirmation(phone: string, message: string, token: string) {
  try {
    const response = await fetch("https://api.kopokopo.com/api/v1/sms_batches", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        sms_batch: {
          recipients: [phone],
          message: message
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[kopokopo] SMS sending failed:", errorText);
    } else {
      console.log("[kopokopo] SMS confirmation sent to:", phone);
    }
  } catch (e) {
    console.error("[kopokopo] SMS helper error:", e.message);
  }
}

serve(async (req) => {
  const { method, url } = req;
  const path = new URL(url).pathname;

  if (method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const rawBody = await req.text();
    let body: any = {};
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        console.warn("[kopokopo] JSON parse failed");
      }
    }

    const action = body.action || (path.includes("/stkpush") ? "stkpush" : path.includes("/token") ? "token" : null);

    // CALLBACK HANDLING (Identified by KopoKopo specific header)
    const signature = req.headers.get("X-Kopo-Signature");
    if (signature && method === "POST") {
      const apiKey = Deno.env.get("KOPO_API_KEY")?.trim();

      // Log for debugging
      await supabase.from("system_logs").insert({
        action: "KOPOKOPO_WEBHOOK_RECEIVED",
        details: {
          event: body.event,
          resource_id: body.data?.id || body.data?.attributes?.id || body.data?.resource_id,
          raw_body: body
        }
      });

      if (!apiKey) return new Response("Error: API Key missing", { status: 500 });

      const isValid = await verifySignature(rawBody, signature, apiKey);
      if (!isValid) {
        console.warn("[kopokopo] Signature mismatch. Received:", signature);
        // During debugging, we might want to continue or return 401
        return new Response("Unauthorized", { status: 401 });
      }

      console.log("[kopokopo] Processing event:", body.event);

      const eventData = body.data?.attributes || body.data || {};
      const resourceId = body.data?.id || eventData.resource_id || eventData.id;

      if (body.event === "incoming_payment.success") {
        // Log all available fields to find where the M-PESA code is hiding
        console.log("[kopokopo] All attributes keys:", Object.keys(eventData));

        // Exhaustive search for the M-PESA transaction code
        const mpesaCode =
          eventData.reference ||
          eventData.mpesa_reference ||
          eventData.external_reference ||
          eventData.receipt_number ||
          eventData.transaction_reference ||
          body.data?.id; // Fallback to raw resource ID if others fail

        console.log(`[kopokopo] Resolved Transaction Reference: ${mpesaCode} for resource: ${resourceId}`);

        const { data: payment, error: pError } = await supabase
          .from("payments")
          .update({
            status: "completed",
            payment_date: new Date().toISOString(),
            mpesa_code: mpesaCode,
            mpesa_reference: mpesaCode, // Legacy support
            kopokopo_metadata: body // Save full raw body into the existing JSONB column for inspection
          })
          .eq("kopo_resource_id", resourceId)
          .select("*, members(user_id, branch_id, full_name)")
          .single();

        if (pError) console.error("[kopokopo] DB Update Error:", pError.message);

        if (payment) {
          await supabase.from("members").update({ is_active: true }).eq("id", payment.member_id);

          // Get the most reliable info for notification
          const currentMemberId = payment.member_id;
          const { data: memberProfile } = await supabase
            .from("members")
            .select("phone, email")
            .eq("id", currentMemberId)
            .single();

          const targetPhone = payment.phone_used || memberProfile?.phone || (eventData as any).sender_phone;
          const memberData = (payment as any).members;

          // --- SYSTEM NOTIFICATIONS ---

          // 1. Notify Member (In-App)
          if (memberData?.user_id) {
            await supabase.from("notifications").insert({
              recipient_id: memberData.user_id,
              title: "Payment Received",
              message: `Your payment of KES ${payment.amount} (Ref: ${mpesaCode}) has been processed successfully. Your individual coverage is now active.`,
              type: "success"
            });
          }

          // 2. Notify Member (SMS via central service)
          if (targetPhone) {
            try {
              // Call the centralized send-sms service used elsewhere in the app
              await supabase.functions.invoke('send-sms', {
                body: {
                  type: 'payment_confirmation',
                  phone: targetPhone,
                  email: memberProfile?.email,
                  data: {
                    benefit_amount: payment.amount,
                    ref: mpesaCode
                  }
                }
              });
              console.log("[kopokopo] Triggered central SMS for:", targetPhone);
            } catch (err) {
              console.error("[kopokopo] Central SMS invocation failed:", err);

              // Fallback to internal KopoKopo SMS helper if central fails
              const smsToken = await getAccessToken();
              const smsMessage = `Confirmed! We have received your payment of KES ${payment.amount} (Ref: ${mpesaCode}). Your Elephant Care coverage is now active. Thank you!`;
              await sendSmsConfirmation(targetPhone, smsMessage, smsToken);
            }
          }

          // 3. Notify Branch Staff (Receptionists/Directors)
          if (memberData?.branch_id) {
            const { data: branchStaff } = await supabase
              .from("staff")
              .select("user_id")
              .eq("branch_id", memberData.branch_id)
              .eq("is_active", true);

            if (branchStaff && branchStaff.length > 0) {
              const staffNotifs = branchStaff.map((s: { user_id: string }) => ({
                recipient_id: s.user_id,
                title: "New Payment Received",
                message: `Payment of KES ${payment.amount} received from ${memberData.full_name}. Ref: ${mpesaCode}.`,
                type: "info"
              }));
              await supabase.from("notifications").insert(staffNotifs).catch((err: Error) => console.error("[kopokopo] Staff notif error:", err));
            }
          }

          await supabase.from("system_logs").insert({
            action: "KOPOKOPO_PAYMENT_SUCCESS",
            details: {
              resource_id: resourceId,
              member_id: payment.member_id,
              amount: payment.amount,
              mpesa_code: mpesaCode
            }
          });
        } else {
          console.warn("[kopokopo] No matching payment found for resourceId:", resourceId);
        }
      } else if (body.event === "incoming_payment.failed") {
        await supabase.from("payments").update({ status: "failed" }).eq("kopo_resource_id", resourceId);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    // ACTION: stkpush
    if (action === "stkpush") {
      const { amount, phone, memberId, paymentType, invoiceNumber, coverageAmount } = body;

      if (!amount || !phone || !memberId) throw new Error("Missing parameters");

      const token = await getAccessToken();
      const tillNumber = Deno.env.get("KOPO_TILL_NUMBER")?.trim();
      const callbackUrl = Deno.env.get("KOPO_CALLBACK_URL")?.trim();

      if (!tillNumber || !callbackUrl) throw new Error("Missing KopoKopo secrets");

      let formattedPhone = phone.toString().replace(/[^0-9]/g, "");
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "+254" + formattedPhone.slice(1);
      } else if (!formattedPhone.startsWith("+")) {
        formattedPhone = "+" + (formattedPhone.startsWith("254") ? formattedPhone : "254" + formattedPhone);
      }

      const { data: member } = await supabase.from("members").select("full_name").eq("id", memberId).single();
      const names = (member?.full_name || "Customer").split(" ");
      const firstName = names[0] || "Customer";
      const lastName = names.length > 1 ? names[names.length - 1] : "Member";

      const payload = {
        payment_channel: "m_pesa",
        till_number: tillNumber,
        subscriber: {
          first_name: firstName,
          last_name: lastName,
          phone_number: formattedPhone,
          email: "customer@elephantcare.com"
        },
        amount: {
          currency: "KES",
          value: Number(amount).toFixed(2)
        },
        metadata: {
          member_id: memberId,
          reference: invoiceNumber || `REF-${Date.now()}`
        },
        _links: {
          callback_url: callbackUrl
        }
      };

      console.log("[kopokopo] Sending STK Push to:", formattedPhone);

      const stkResponse = await fetch("https://api.kopokopo.com/api/v1/incoming_payments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!stkResponse.ok) {
        const errorText = await stkResponse.text();
        throw new Error(`KopoKopo API Error (${stkResponse.status}): ${errorText}`);
      }

      const location = stkResponse.headers.get("Location");
      let resourceId = location ? location.split("/").pop() : null;

      if (!resourceId) {
        try {
          const resData = await stkResponse.json();
          resourceId = resData.resource_id;
        } catch (e) {
          console.warn("[kopokopo] Empty response body");
        }
      }

      if (!resourceId) throw new Error("No resource_id in KopoKopo response");

      await supabase.from("payments").insert({
        member_id: memberId,
        amount: amount,
        coverage_added: coverageAmount || amount,
        kopo_resource_id: resourceId,
        phone_used: formattedPhone,
        status: "pending",
        reference: payload.metadata.reference
      });

      return new Response(JSON.stringify({ success: true, resource_id: resourceId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ACTION: status (Manual Check)
    if (action === "status" || path.includes("/status")) {
      const resourceId = body.resourceId || path.split("/").pop();
      if (!resourceId || resourceId === "status") throw new Error("resource_id required");

      const token = await getAccessToken();
      const response = await fetch(`https://api.kopokopo.com/api/v1/incoming_payments/${resourceId}`, {
        headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
      });
      const data = await response.json();

      // Auto-update if successful during manual check
      if (data.data?.attributes?.status === 'Success') {
        const mpesaCode = data.data.attributes.reference;
        await supabase.from("payments").update({
          status: "completed",
          payment_date: new Date().toISOString(),
          mpesa_code: mpesaCode,
          mpesa_reference: mpesaCode
        }).eq("kopo_resource_id", resourceId).eq("status", "pending");
      }

      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });

  } catch (error: any) {
    console.error(`[kopokopo] Error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
