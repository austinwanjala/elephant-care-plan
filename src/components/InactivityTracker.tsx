import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes
const WARNING_BEFORE = 30 * 1000; // 30 seconds

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/update-password",
  "/terms-of-service",
  "/privacy-policy",
  "/maintenance",
];

export const InactivityTracker = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef<NodeJS.Timeout>();
  const warningTimerRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<number>(Date.now());

  const logout = async () => {
    // Check if we already logged out or are on a public path
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || PUBLIC_PATHS.includes(location.pathname)) return;
    
    toast.error("You have been logged out due to inactivity");
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const resetTimer = () => {
    lastActivityRef.current = Date.now();
    
    if (PUBLIC_PATHS.includes(location.pathname)) {
      clearTimeout(timerRef.current);
      clearTimeout(warningTimerRef.current);
      return;
    }

    toast.dismiss("inactivity-warning");
    clearTimeout(timerRef.current);
    clearTimeout(warningTimerRef.current);

    warningTimerRef.current = setTimeout(() => {
      toast.warning("You will be logged out soon due to inactivity.", {
        id: "inactivity-warning",
        duration: WARNING_BEFORE,
      });
    }, INACTIVITY_LIMIT - WARNING_BEFORE);

    timerRef.current = setTimeout(() => {
      logout();
    }, INACTIVITY_LIMIT);
  };

  useEffect(() => {
    resetTimer();

    const handleActivity = () => {
      // Throttle to max 1 reset per second
      if (Date.now() - lastActivityRef.current > 1000) {
        resetTimer();
      }
    };

    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click"
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Intercept fetch for API calls
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      handleActivity();
      return originalFetch(...args);
    };

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      window.fetch = originalFetch;
      clearTimeout(timerRef.current);
      clearTimeout(warningTimerRef.current);
      toast.dismiss("inactivity-warning");
    };
  }, [location.pathname]);

  return null;
};
