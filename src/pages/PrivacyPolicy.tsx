import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LegalLayout } from "@/components/LegalLayout";

const PrivacyPolicy = () => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("site_content")
          .select("content")
          .eq("slug", "privacy_policy")
          .single();

        if (error) throw error;
        setContent(data?.content || "Privacy Policy not found. Please contact support.");
      } catch (err) {
        console.error("Error fetching privacy policy:", err);
        setContent("Failed to load Privacy Policy. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How we protect and manage your sensitive health data"
    >
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-12 w-12 animate-spin text-lime-500" />
        </div>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: content }} />
      )}
    </LegalLayout>
  );
};

export default PrivacyPolicy;
