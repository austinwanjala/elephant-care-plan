import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from("audit_logs").select("*");
  console.log("Audit Logs Data:", data?.length);
  console.log("Audit Logs Error:", error);
}

check();
