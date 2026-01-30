import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/hooks/useFormTranslation';

export { SUPPORTED_LANGUAGES, type LanguageCode };

interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
}

interface CacheEntry {
  result: TranslationResult;
  timestamp: number;
}

// Cache TTL: 24 hours
const CACHE_TTL = 24 * 60 * 60 * 1000;

export function useMessageTranslation() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // In-memory cache for translations during session
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  // Generate cache key from text + target language
  const getCacheKey = (text: string, targetLanguage: string) => 
    `${targetLanguage}:${text.substring(0, 100)}:${text.length}`;

  const translateMessage = useCallback(async (
    text: string,
    targetLanguage: LanguageCode,
    sourceLanguage?: string
  ): Promise<TranslationResult | null> => {
    if (!text.trim()) {
      return null;
    }

    const targetLangName = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage;

    // Check cache
    const cacheKey = getCacheKey(text, targetLanguage);
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[useMessageTranslation] Cache hit');
      return cached.result;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('translate-message', {
        body: {
          text,
          targetLanguage: targetLangName,
          sourceLanguage,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Translation failed');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const result: TranslationResult = {
        translatedText: data.translatedText,
        detectedLanguage: data.detectedLanguage,
      };

      // Cache the result
      cacheRef.current.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });

      return result;
    } catch (err: any) {
      console.error('[useMessageTranslation] Error:', err);
      const errorMessage = err.message || 'Translation failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    translateMessage,
    isTranslating,
    error,
    clearError,
    clearCache,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}
