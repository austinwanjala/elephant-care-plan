import { useEffect } from "react";
import { useSystemSettings } from "@/hooks/useSystemSettings";

export function DynamicTheme() {
    const { settings } = useSystemSettings();

    useEffect(() => {
        const primaryColor = settings.primary_color;
        const appName = settings.app_name;

        if (primaryColor) {
            const root = document.documentElement;

            // Helper to convert hex to hsl for CSS variables
            const hexToHSL = (hex: string) => {
                let r = 0, g = 0, b = 0;
                if (hex.length === 4) {
                    r = parseInt(hex[1] + hex[1], 16);
                    g = parseInt(hex[2] + hex[2], 16);
                    b = parseInt(hex[3] + hex[3], 16);
                } else if (hex.length === 7) {
                    r = parseInt(hex.substring(1, 3), 16);
                    g = parseInt(hex.substring(3, 5), 16);
                    b = parseInt(hex.substring(5, 7), 16);
                }
                r /= 255; g /= 255; b /= 255;
                const max = Math.max(r, g, b), min = Math.min(r, g, b);
                let h = 0, s = 0, l = (max + min) / 2;
                if (max !== min) {
                    const d = max - min;
                    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                    switch (max) {
                        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                        case g: h = (b - r) / d + 2; break;
                        case b: h = (r - g) / d + 4; break;
                    }
                    h /= 6;
                }
                return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
            };

            try {
                const hsl = hexToHSL(primaryColor);
                root.style.setProperty('--primary', hsl);
                root.style.setProperty('--ring', hsl);
                root.style.setProperty('--sidebar-primary', hsl);
                root.style.setProperty('--shadow-primary', `0 10px 30px -10px hsla(${hsl}, 0.4)`);
                root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${hsl}) 0%, hsla(${hsl}, 0.8) 100%)`);
            } catch (e) {
                console.error("Invalid primary color:", primaryColor);
            }
        }

        if (appName) {
            document.title = appName;
        }
    }, [settings]);

    return null;
}

