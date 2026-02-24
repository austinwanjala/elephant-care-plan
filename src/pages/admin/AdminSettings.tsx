import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Users, DollarSign, ShieldAlert, Palette, Layout, Save, Loader2, Info, Phone, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminSettings() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({
    maintenance_mode: "false",
    app_name: "Elephant Dental",
    hero_title: "Dental Insurance That Doubles Your Investment",
    hero_subtitle: "Pay KES 500, get KES 1,000 coverage. Simple, affordable dental care for you and your family.",
    primary_color: "#32CD32",
    footer_text: "Providing accessible oral healthcare for everyone across Kenya.",
    copyright_text: "© 2024 Elephant Dental Hospital. All rights reserved.",
    contact_phone: "+254 700 000 000",
    contact_email: "info@elephantdental.co.ke"
  });
  const { toast } = useToast();

  useEffect(() => {
    checkRoleAndLoadSettings();
  }, []);

  const checkRoleAndLoadSettings = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      setIsSuperAdmin(roleData?.role === 'super_admin');
    }

    const { data: settingsData } = await supabase.from("system_settings").select("key, value");
    if (settingsData) {
      const settingsMap: Record<string, string> = { ...settings };
      settingsData.forEach(s => {
        settingsMap[s.key] = s.value;
      });
      setSettings(settingsMap);
    }
    setLoading(false);
  };

  const handleSaveSetting = async (key: string, value: string) => {
    setSaving(key);
    try {
      const { error } = await supabase.from("system_settings").upsert({
        key,
        value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));
      toast({ title: "Setting Updated", description: `${key.replace(/_/g, ' ')} has been saved.` });
    } catch (error: any) {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">System configuration and preferences</p>
      </div>

      {isSuperAdmin ? (
        <Tabs defaultValue="system" className="space-y-6">
          <TabsList>
            <TabsTrigger value="system" className="gap-2"><ShieldAlert className="h-4 w-4" /> System Control</TabsTrigger>
            <TabsTrigger value="frontend" className="gap-2"><Layout className="h-4 w-4" /> Frontend & Branding</TabsTrigger>
            <TabsTrigger value="general" className="gap-2"><Settings className="h-4 w-4" /> General</TabsTrigger>
          </TabsList>

          <TabsContent value="system" className="space-y-6">
            <Card className="border-red-100 bg-red-50/30">
              <CardHeader>
                <CardTitle className="text-red-700">Maintenance Mode</CardTitle>
                <CardDescription>Shut down member access for system updates. Admins can still log in.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-red-200 shadow-sm">
                  <div className="space-y-0.5">
                    <Label className="text-base font-bold text-red-900">Enable Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">Members will see a maintenance page upon login.</p>
                  </div>
                  <Switch
                    checked={settings.maintenance_mode === "true"}
                    onCheckedChange={(checked) => handleSaveSetting("maintenance_mode", checked.toString())}
                    disabled={saving === "maintenance_mode"}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="frontend" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Layout className="h-5 w-5" /> Hero Section</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Application Name</Label>
                    <div className="flex gap-2">
                      <Input value={settings.app_name} onChange={e => setSettings({ ...settings, app_name: e.target.value })} />
                      <Button size="sm" onClick={() => handleSaveSetting("app_name", settings.app_name)} disabled={saving === "app_name"}>
                        {saving === "app_name" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Hero Title</Label>
                    <Textarea value={settings.hero_title} onChange={e => setSettings({ ...settings, hero_title: e.target.value })} />
                    <Button size="sm" className="w-full" onClick={() => handleSaveSetting("hero_title", settings.hero_title)} disabled={saving === "hero_title"}>
                      {saving === "hero_title" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Title
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Hero Subtitle</Label>
                    <Textarea value={settings.hero_subtitle} onChange={e => setSettings({ ...settings, hero_subtitle: e.target.value })} />
                    <Button size="sm" className="w-full" onClick={() => handleSaveSetting("hero_subtitle", settings.hero_subtitle)} disabled={saving === "hero_subtitle"}>
                      {saving === "hero_subtitle" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Subtitle
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5" /> Footer & Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Footer Description</Label>
                    <Textarea value={settings.footer_text} onChange={e => setSettings({ ...settings, footer_text: e.target.value })} />
                    <Button size="sm" className="w-full" onClick={() => handleSaveSetting("footer_text", settings.footer_text)} disabled={saving === "footer_text"}>
                      {saving === "footer_text" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Footer Text
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Copyright Text</Label>
                    <Input value={settings.copyright_text} onChange={e => setSettings({ ...settings, copyright_text: e.target.value })} />
                    <Button size="sm" className="w-full" onClick={() => handleSaveSetting("copyright_text", settings.copyright_text)} disabled={saving === "copyright_text"}>
                      {saving === "copyright_text" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Copyright
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</Label>
                      <Input value={settings.contact_phone} onChange={e => setSettings({ ...settings, contact_phone: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
                      <Input value={settings.contact_email} onChange={e => setSettings({ ...settings, contact_email: e.target.value })} />
                    </div>
                    <Button size="sm" className="col-span-2" onClick={() => {
                      handleSaveSetting("contact_phone", settings.contact_phone);
                      handleSaveSetting("contact_email", settings.contact_email);
                    }}>Save Contact Info</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Visual Identity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Primary Theme Color (Hex)</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 p-1 h-10" value={settings.primary_color} onChange={e => setSettings({ ...settings, primary_color: e.target.value })} />
                      <Input value={settings.primary_color} onChange={e => setSettings({ ...settings, primary_color: e.target.value })} />
                      <Button size="sm" onClick={() => handleSaveSetting("primary_color", settings.primary_color)} disabled={saving === "primary_color"}>
                        {saving === "primary_color" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Note: This updates the database setting. CSS variables may require a page refresh to fully apply.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="general" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Membership Categories</CardTitle>
                  <Link to="/admin/membership-categories"><Button variant="outline" size="sm">Manage</Button></Link>
                </CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">Define and manage different membership levels, their costs, and benefits.</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Rollover Policy</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>• 10% unused balance rolls over yearly</p>
                  <p>• Maximum rollover period: 3 years</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Membership Categories</CardTitle>
              <Link to="/admin/membership-categories"><Button variant="outline" size="sm">Manage</Button></Link>
            </CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Define and manage different membership levels, their costs, and benefits.</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Fee Structure</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Registration Fee</span><span>KES 500</span></div>
              <div className="flex justify-between"><span>Management Fee</span><span>KES 1,000</span></div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}