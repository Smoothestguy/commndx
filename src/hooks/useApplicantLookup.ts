import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FoundApplicantData {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  home_zip: string | null;
  photo_url: string | null;
}

export interface PreviousFieldData {
  id: string;
  label: string;
  type: string;
  options?: string[];
}

export interface LookupResult {
  found: boolean;
  applicant?: FoundApplicantData;
  previousAnswers?: Record<string, any> | null;
  previousFields?: PreviousFieldData[];
  previousSmsConsent?: boolean;
  error?: string;
}

export function useApplicantLookup() {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [foundApplicant, setFoundApplicant] = useState<FoundApplicantData | null>(null);
  const [previousAnswers, setPreviousAnswers] = useState<Record<string, any> | null>(null);
  const [previousSmsConsent, setPreviousSmsConsent] = useState(false);
  const [hasLookedUp, setHasLookedUp] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const lookupApplicant = useCallback(async (email?: string, phone?: string): Promise<LookupResult | null> => {
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Validate input
    if (!email && !phone) {
      return null;
    }

    // Basic email validation
    if (email && !email.includes("@")) {
      return null;
    }

    // Phone must be 10 digits
    if (phone) {
      const normalizedPhone = phone.replace(/\D/g, "");
      if (normalizedPhone.length !== 10) {
        return null;
      }
    }

    setIsLookingUp(true);

    try {
      const { data, error } = await supabase.functions.invoke<LookupResult>("lookup-applicant", {
        body: { email, phone },
      });

      if (error) {
        console.error("[useApplicantLookup] Error:", error);
        setIsLookingUp(false);
        return null;
      }

      if (data?.found && data.applicant) {
        setFoundApplicant(data.applicant);
        setPreviousAnswers(data.previousAnswers || null);
        setPreviousSmsConsent(data.previousSmsConsent || false);
        setHasLookedUp(true);
        setIsLookingUp(false);
        return data;
      }

      setHasLookedUp(true);
      setIsLookingUp(false);
      return null;
    } catch (err) {
      console.error("[useApplicantLookup] Exception:", err);
      setIsLookingUp(false);
      return null;
    }
  }, []);

  const lookupWithDebounce = useCallback((email?: string, phone?: string, delay = 500) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      lookupApplicant(email, phone);
    }, delay);
  }, [lookupApplicant]);

  const clearApplicant = useCallback(() => {
    setFoundApplicant(null);
    setPreviousAnswers(null);
    setPreviousSmsConsent(false);
    setHasLookedUp(false);
  }, []);

  return {
    lookupApplicant,
    lookupWithDebounce,
    isLookingUp,
    foundApplicant,
    previousAnswers,
    previousSmsConsent,
    hasLookedUp,
    clearApplicant,
  };
}
