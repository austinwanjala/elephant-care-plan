import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, History, FileText } from "lucide-react";

export default function AdminContent() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [content, setContent] = useState<Record<string, string>>({
        terms_and_conditions: "",
        privacy_policy: "",
    });
    const { toast } = useToast();

    useEffect(() => {
        fetchContent();
    }, []);

    const fetchContent = async () => {
        setLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from("site_content")
                .select("slug, content");

            if (error) throw error;

            const contentMap: Record<string, string> = {};
            data?.forEach((item: any) => {
                contentMap[item.slug] = item.content;
            });
            setContent(prev => ({ ...prev, ...contentMap }));
        } catch (error: any) {
            toast({ title: "Error loading content", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (slug: string) => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // 1. Get current content for history (if it exists)
            const { data: current, error: currentErr } = await (supabase as any)
                .from("site_content")
                .select("id, content")
                .eq("slug", slug)
                .maybeSingle();

            if (currentErr) throw currentErr;

            if (current) {
                // 2. Save to history
                const { error: historyErr } = await (supabase as any)
                    .from("site_content_history")
                    .insert({
                        content_id: current.id,
                        slug: slug,
                        content: current.content,
                        version_by: user?.id
                    });

                if (historyErr) throw historyErr;
            }

            // 3. Update main content
            const { error } = await (supabase as any)
                .from("site_content")
                .upsert({
                    slug,
                    content: content[slug],
                    updated_at: new Date().toISOString(),
                    updated_by: user?.id
                }, { onConflict: 'slug' });

            if (error) throw error;

            toast({ title: "Success", description: `${slug.replace(/_/g, ' ')} updated successfully.` });
        } catch (error: any) {
            toast({ title: "Save failed", description: error.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-serif font-bold">Content Management</h1>
                    <p className="text-muted-foreground">Manage Terms & Conditions and Privacy Policy.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <Tabs defaultValue="terms_and_conditions" className="w-full">
                    <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
                        <TabsTrigger value="terms_and_conditions" className="flex gap-2">
                            <FileText className="h-4 w-4" /> Terms & Conditions
                        </TabsTrigger>
                        <TabsTrigger value="privacy_policy" className="flex gap-2">
                            <FileText className="h-4 w-4" /> Privacy Policy
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="terms_and_conditions">
                        <Card>
                            <CardHeader>
                                <CardTitle>Terms & Conditions</CardTitle>
                                <CardDescription>
                                    This content will be displayed on the /terms-of-service page. Supports HTML.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <textarea
                                    className="min-h-[500px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                                    value={content.terms_and_conditions}
                                    onChange={(e) => setContent({ ...content, terms_and_conditions: e.target.value })}
                                    placeholder="Enter HTML content..."
                                />
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={fetchContent} disabled={saving}>
                                        <History className="mr-2 h-4 w-4" /> Revert
                                    </Button>
                                    <Button onClick={() => handleSave("terms_and_conditions")} disabled={saving}>
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="privacy_policy">
                        <Card>
                            <CardHeader>
                                <CardTitle>Privacy Policy</CardTitle>
                                <CardDescription>
                                    This content will be displayed on the /privacy-policy page. Supports HTML.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <textarea
                                    className="min-h-[500px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                                    value={content.privacy_policy}
                                    onChange={(e) => setContent({ ...content, privacy_policy: e.target.value })}
                                    placeholder="Enter HTML content..."
                                />
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={fetchContent} disabled={saving}>
                                        <History className="mr-2 h-4 w-4" /> Revert
                                    </Button>
                                    <Button onClick={() => handleSave("privacy_policy")} disabled={saving}>
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}