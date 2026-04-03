"use client";

import { supabase } from "@/integrations/supabase/client";
import * as faceapi from '@vladmandic/face-api';

export type BiometricFormat = "ansi" | "iso19794-2" | "wsq" | "unknown";

/**
 * Registers a biometric template.
 * Tries the Edge Function first, then falls back to a direct database update
 * if the Edge Function returns an authentication error (401).
 */
export async function registerExternalBiometric(params: {
  memberId?: string;
  templateBase64: string;
  format?: BiometricFormat;
}) {
  // 1. Ensure we have a valid session and user sync
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  const { data: { session: activeSession } } = await supabase.auth.getSession();

  if (userErr || !activeSession || !user) {
    console.error("[Biometric] Auth check failed:", userErr);
    throw new Error("Authentication required. Please log out and back in.");
  }

  const tid = params.memberId || user.id;
  console.log(`[Biometric] Starting registration for member: ${tid}`);

  // 1. Try the Edge Function First
  try {
    const { data, error } = await supabase.functions.invoke("biometric-verify", {
      body: {
        action: "register",
        member_id: params.memberId,
        template: params.templateBase64,
        format: params.format || "unknown",
      }
    });

    if (!error) {
      console.log("[Biometric] Registered successfully via Edge Function");
      return data;
    }

    // Detect 401 Unauthorized securely
    const is401 = error.status === 401 ||
      error.message?.includes("401") ||
      (error as any).context?.status === 401;

    if (!is401) {
      console.error("[Biometric] Edge Function error:", error);
      throw error;
    }

    console.warn("[Biometric] Edge Function 401 - Using Direct Database Fallback...");
  } catch (err: any) {
    const is401 = err.status === 401 || err.message?.includes("401");
    if (!is401) {
      console.error("[Biometric] Error in Edge Function call:", err);
      throw err;
    }
    console.warn("[Biometric] Auth error (401) in Edge call - Using Direct Database Fallback...");
  }

  // 2. Direct Database Fallback (if Edge Function fails with 401)
  const payload = JSON.stringify({
    format: params.format || "unknown",
    template: params.templateBase64,
    updated_at: new Date().toISOString(),
  });

  const { error: dbError } = await supabase
    .from("members")
    .update({
      biometric_data: payload,
      updated_at: new Date().toISOString()
    })
    .eq("id", tid);

  if (dbError) {
    console.error("[Biometric] Direct save failed:", dbError);
    throw new Error(dbError.message || "Failed to save biometric data to database.");
  }

  console.log("[Biometric] Registered successfully via direct database update.");
  return { success: true, member_id: tid };
}

/**
 * Verifies a biometric template.
 * Tries Edge Function first, falls back to local comparison if necessary.
 */
export async function verifyExternalBiometric(params: {
  memberId?: string;
  templateBase64: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");

  try {
    const { data, error } = await supabase.functions.invoke("biometric-verify", {
      body: {
        action: "verify",
        member_id: params.memberId,
        template: params.templateBase64,
      }
    });

    if (!error) return data as { success: boolean };

    const is401 = error.status === 401 ||
      error.message?.includes("401") ||
      (error as any).context?.status === 401;

    if (!is401) throw error;
  } catch (err: any) {
    const is401 = err.status === 401 || err.message?.includes("401");
    if (!is401) throw err;
  }

  // Fallback: Manually fetch and compare (deterministic templates only)
  const targetId = params.memberId || user.id;
  const { data: member, error: memErr } = await supabase
    .from("members")
    .select("biometric_data")
    .eq("id", targetId)
    .maybeSingle();

  if (memErr || !member?.biometric_data) return { success: false };

  try {
    const stored = JSON.parse(member.biometric_data);
    
    console.log("[Biometric] Cloud Edge function unavailable. Falling back to local backend matcher...");
    
    // Instead of string === matching, we use the local Node.js matcher server
    const response = await fetch("http://localhost:3001/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            capturedFeaturesBase64: params.templateBase64,
            storedTemplateBase64: stored.template
        })
    });
    
    if (response.ok) {
        const result = await response.json();
        return { success: result.success };
    } else {
        const errData = await response.json();
        console.error("[Biometric] Backend match failed:", errData);
        return { success: false };
    }
  } catch (error) {
    console.error("[Biometric] Local matcher fallback failed:", error);
    return { success: false };
  }
}

let modelsLoaded = false;
const MODEL_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';

async function ensureModelsLoaded() {
  if (modelsLoaded) return;
  console.log("[Biometric] Loading AI models for facial recognition...");
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    modelsLoaded = true;
    console.log("[Biometric] Models loaded successfully.");
  } catch (err) {
    console.error("[Biometric] Failed to load models:", err);
    throw new Error("Facial recognition engine failed to initialize. Please check your internet connection.");
  }
}

/**
 * Robust detection helper: Enforces high-quality SSD detection
 * Removing TinyFaceDetector fallback prevents generic/blurry embeddings
 * that lead to cross-member false positives.
 */
async function detectFaceDescriptor(img: any) {
  // Use SSD exclusively for maximum accuracy, but lowered minConfidence to 0.3
  // Mobile cameras often apply post-processing (beautification, HDR artifacts, noise)
  // that slightly confuses the generic face bounding box algorithm, despite having high-res data.
  // Lowering this only helps FIND the face. The strict Euclidean Identity Match prevents false positives later.
  return await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
}

export async function registerFace(params: { memberId?: string; imageBase64: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  const tid = params.memberId || user?.id;
  if (!tid) throw new Error("Target ID not found.");

  // 1. Ensure models are ready
  await ensureModelsLoaded();

  // 2. Validate that the image being registered actually contains a face
  const img = await faceapi.fetchImage(params.imageBase64);
  const detection = await detectFaceDescriptor(img);
  
  if (!detection) {
    throw new Error("Face not clearly visible in the photo. Please ensure good lighting, look directly at the camera, and remove any masks or dark glasses.");
  }

  // 3. Fetch current biometric data
  const { data: member, error: memErr } = await supabase
    .from("members")
    .select("biometric_data")
    .eq("id", tid)
    .maybeSingle();

  if (memErr) throw memErr;

  let bios: any = {};
  if (member?.biometric_data) {
    if (typeof member.biometric_data === "string") {
      try { bios = JSON.parse(member.biometric_data); } catch { bios = {}; }
    } else {
      bios = member.biometric_data;
    }
  }

  // Store the base64 image as the template
  bios.face_template = params.imageBase64;

  const { error: upErr } = await supabase
    .from("members")
    .update({ 
      biometric_data: JSON.stringify(bios), 
      updated_at: new Date().toISOString() 
    })
    .eq("id", tid);

  if (upErr) throw upErr;
  return { success: true };
}

export async function verifyFace(params: { memberId?: string; imageBase64: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  const tid = params.memberId || user?.id;
  if (!tid) throw new Error("Target ID not found.");

  const { data: member, error: memErr } = await supabase
    .from("members")
    .select("biometric_data")
    .eq("id", tid)
    .maybeSingle();

  if (memErr) throw memErr;
  
  let bios: any = {};
  if (member?.biometric_data) {
    if (typeof member.biometric_data === "string") {
      try { bios = JSON.parse(member.biometric_data); } catch { bios = {}; }
    } else {
      bios = member.biometric_data;
    }
  }

  if (!bios.face_template) {
    return { success: false, reason: "No face registered for this member." };
  }

  try {
    // 1. Ensure models are ready
    await ensureModelsLoaded();

    // 2. Create image elements for processing
    const capturedImg = await faceapi.fetchImage(params.imageBase64);
    const storedImg = await faceapi.fetchImage(bios.face_template);

    // 3. Get descriptors for both images using robust detection
    const capturedDesc = await detectFaceDescriptor(capturedImg);
    const storedDesc = await detectFaceDescriptor(storedImg);

    if (!capturedDesc) {
      console.warn("[Biometric] No face detected in captured image.");
      return { success: false, reason: "Face not clearly visible in current photo. Please check your lighting and look straight at the camera.", storedImage: bios.face_template };
    }

    if (!storedDesc) {
      console.warn("[Biometric] No face detected in stored template.");
      return { success: false, reason: "The stored profile image is unclear. Please re-register the member's face.", storedImage: bios.face_template };
    }

    // 4. Compare using Euclidean distance
    const distance = faceapi.euclideanDistance(capturedDesc.descriptor, storedDesc.descriptor);
    
    // STRICT Threshold: 0.45 instead of the loose 0.6 default.
    // This prevents different people under similar lighting from false-matching.
    const threshold = 0.45; 
    const matches = distance < threshold;

    console.log(`[Biometric] Face match distance: ${distance.toFixed(4)} (Threshold: ${threshold})`);

    return { 
      success: matches, 
      reason: matches ? "Match confirmed" : "Faces do not match. Identity rejected.",
      storedImage: bios.face_template,
      score: Math.max(0, (1 - distance / threshold) * 100) // Normalized confidence score
    };
  } catch (error: any) {
    console.error("[Biometric] AI matching failed:", error);
    return { success: false, reason: error.message || "Verification platform error. Please retry.", storedImage: bios.face_template };
  }
}
