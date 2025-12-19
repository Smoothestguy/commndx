import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FormField as FormFieldType } from '@/integrations/supabase/hooks/useApplicationFormTemplates';
import { toast } from 'sonner';

export interface TranslatedContent {
  coreLabels: Record<string, string>;
  customFields: Array<{
    id: string;
    label: string;
    placeholder?: string;
    helpText?: string;
    options?: string[];
  }>;
  uiText: {
    submitButton: string;
    successMessage: string;
    requiredIndicator: string;
  };
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

interface UseFormTranslationOptions {
  formTemplateId?: string;
  customFields: FormFieldType[];
  successMessage?: string;
}

// Cache key generator
const getCacheKey = (formId: string | undefined, langCode: string) => 
  `form_translation_${formId || 'default'}_${langCode}`;

export function useFormTranslation({ 
  formTemplateId, 
  customFields, 
  successMessage = 'Thank you for your submission!' 
}: UseFormTranslationOptions) {
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translations, setTranslations] = useState<TranslatedContent | null>(null);

  // Default English content
  const defaultContent: TranslatedContent = {
    coreLabels: {
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      phone: 'Phone',
      homeZip: 'Home ZIP Code',
      profilePicture: 'Profile Picture',
    },
    customFields: customFields.map(f => ({
      id: f.id,
      label: f.label,
      placeholder: f.placeholder,
      helpText: f.helpText,
      options: f.options,
    })),
    uiText: {
      submitButton: 'Submit Application',
      successMessage: successMessage,
      requiredIndicator: '*',
    },
  };

  // Load saved language preference
  useEffect(() => {
    const savedLang = localStorage.getItem('preferred_form_language') as LanguageCode | null;
    if (savedLang && SUPPORTED_LANGUAGES.some(l => l.code === savedLang)) {
      setCurrentLanguage(savedLang);
    }
  }, []);

  // Translate when language changes
  useEffect(() => {
    if (currentLanguage === 'en') {
      setTranslations(null);
      return;
    }

    const translateContent = async () => {
      // Check cache first
      const cacheKey = getCacheKey(formTemplateId, currentLanguage);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // Verify the cached translation matches current fields
          const currentFieldIds = customFields.map(f => f.id).sort().join(',');
          const cachedFieldIds = parsed.customFields?.map((f: any) => f.id).sort().join(',') || '';
          
          if (currentFieldIds === cachedFieldIds) {
            setTranslations(parsed);
            return;
          }
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }

      setIsTranslating(true);
      try {
        const langName = SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage)?.name || currentLanguage;
        
        const { data, error } = await supabase.functions.invoke('translate-form', {
          body: {
            content: defaultContent,
            targetLanguage: langName,
            sourceLanguage: 'English',
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.translations) {
          setTranslations(data.translations);
          // Cache the translation
          localStorage.setItem(cacheKey, JSON.stringify(data.translations));
        }
      } catch (err: any) {
        console.error('[useFormTranslation] Error:', err);
        toast.error('Translation failed. Showing original content.');
        setTranslations(null);
      } finally {
        setIsTranslating(false);
      }
    };

    translateContent();
  }, [currentLanguage, formTemplateId, customFields.length]);

  const changeLanguage = useCallback((langCode: LanguageCode) => {
    setCurrentLanguage(langCode);
    localStorage.setItem('preferred_form_language', langCode);
  }, []);

  // Helper to get translated label for core fields
  const getCoreLabel = useCallback((field: 'firstName' | 'lastName' | 'email' | 'phone' | 'homeZip' | 'profilePicture') => {
    return translations?.coreLabels?.[field] || defaultContent.coreLabels[field];
  }, [translations, defaultContent]);

  // Helper to get translated custom field
  const getCustomField = useCallback((fieldId: string) => {
    const translated = translations?.customFields?.find(f => f.id === fieldId);
    const original = customFields.find(f => f.id === fieldId);
    
    if (translated) {
      return {
        label: translated.label || original?.label || '',
        placeholder: translated.placeholder || original?.placeholder,
        helpText: translated.helpText || original?.helpText,
        options: translated.options || original?.options,
      };
    }
    
    return {
      label: original?.label || '',
      placeholder: original?.placeholder,
      helpText: original?.helpText,
      options: original?.options,
    };
  }, [translations, customFields]);

  // Helper to get UI text
  const getUIText = useCallback((key: keyof TranslatedContent['uiText']) => {
    return translations?.uiText?.[key] || defaultContent.uiText[key];
  }, [translations, defaultContent]);

  return {
    currentLanguage,
    changeLanguage,
    isTranslating,
    getCoreLabel,
    getCustomField,
    getUIText,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}
