import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSystemSettings() {
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('key, value');

            if (error) throw error;

            if (data) {
                const settingsMap: Record<string, string> = {};
                data.forEach(s => {
                    settingsMap[s.key] = s.value;
                });
                setSettings(settingsMap);
            }
        } catch (err) {
            console.error('Error fetching system settings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();

        const channel = supabase
            .channel('system_settings_global')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'system_settings' },
                () => {
                    fetchSettings();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return { settings, loading, fetchSettings };
}
