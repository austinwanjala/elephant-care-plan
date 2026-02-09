import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Users, DollarSign, ShieldAlert, Palette, Layout, Save, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettings() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({
    maintenance_mode: "false",
    app_name: "Elephant Dental",
    hero_title: "Dental Insurance That Doubles Your Investment",
    hero_subtitle: "Pay KES 500, get KES 1,000 coverage. Simple, affordable dental care for you and your family.",
    primary_color: "#1e40af"
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
    setSaving(true);
    try {
      const { error } = await supabase.from("system_settings").upsert({
        key,
        value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));
      toast({ title: "Setting Updated", description: `${key.replace('_', ' ')} has been saved.` });
    } catch (error: any) {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">System configuration and preferences</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Super Admin Controls */}
        {isSuperAdmin && (
          <Card className="border-red-100 bg-red-50/30 md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <ShieldAlert className="h-5 w-5" />
                System Control (Super Admin Only)
              </CardTitle>
              <CardDescription>Critical system-wide overrides and maintenance tools.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-red-200 shadow-sm">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold text-red-900">Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">Shut down member access for system updates. Admins can still log in.</p>
                </div>
                <Switch 
                  checked={settings.maintenance_mode === "true"} 
                  onCheckedChange={(checked) => handleSaveSetting("maintenance_mode", checked.toString())}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-red-100">
                <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2"><Layout className="h-4 w-4" /> Branding & Text</h4>
                  <div className="space-y-2">
                    <Label>Application Name</Label>
                    <div className="flex gap-2">
                      <Input value={settings.app_name} onChange={e => setSettings({...settings, app_name: e.target.value})} />
                      <Button size="sm" onClick={() => handleSaveSetting("app_name", settings.app_name)}><Save className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Hero Title</Label>
                    <Textarea value={settings.hero_title} onChange={e => setSettings({...settings, hero_title: e.target.value})} />
                    <Button size="sm" className="w-full" onClick={() => handleSaveSetting("hero_title", settings.hero_title)}>Save Title</Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2"><Palette className="h-4 w-4" /> Visuals</h4>
                  <div className="space-y-2">
                    <Label>Primary Theme Color (Hex)</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-12 p-1 h-10" value={settings.primary_color} onChange={e => setSettings({...settings, primary_color: e.target.value})} />
                      <Input value={settings.primary_color} onChange={e => setSettings({...settings, primary_color: e.target.value})} />
                      <Button size="sm" onClick={() => handleSaveSetting("primary_color", settings.primary_color)}><Save className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Hero Subtitle</Label>
                    <Textarea value={settings.hero_subtitle} onChange={e => setSettings({...settings, hero_subtitle: e.target.value})} />
                    <Button size="sm" className="w-full" onClick={() => handleSaveSetting("hero_subtitle", settings.hero_subtitle)}>Save Subtitle</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Membership Categories
            </CardTitle>
            <Link to="/admin/membership-categories">
              <Button variant="outline" size="sm">Manage</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Define and manage different membership levels, their costs, and benefits.</p>
              <p>Set registration and management fees for each scheme.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" /> Fee Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Registration Fee</span>
                <span>KES 500</span>
              </div>
              <div className="flex justify-between">
                <span>Management Fee</span>
                <span>KES 1,000</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rollover Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• 10% unused balance rolls over yearly</p>
              <p>• Maximum rollover period: 3 years</p>
              <p>• Rollover calculated at end of membership year</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}