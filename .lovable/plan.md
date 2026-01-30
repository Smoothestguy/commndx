
# Fix: Translation to English Not Working

## Problem Identified

When clicking translate on a Spanish message ("Buenas noche. El. Link. No deja seguir. Como hacemos"), the system:
1. **Showed the original Spanish text** instead of translating to English
2. **Displayed "Translated from English"** which is incorrect - the message was in Spanish

**Root Cause:**
Both the frontend hook and edge function have faulty "optimization" logic that skips translation when the target language is English, assuming the text is already in English. This breaks the core use case of translating foreign language messages to English.

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useMessageTranslation.ts` | Remove incorrect English shortcut logic |
| `supabase/functions/translate-message/index.ts` | Remove incorrect English shortcut logic |

---

## Technical Changes

### 1. Fix `useMessageTranslation.ts` (lines 42-45)

**Current (broken):**
```typescript
// If target is English, return original (assume it's already English or user wants English)
if (targetLanguage === 'en' && !sourceLanguage) {
  return { translatedText: text, detectedLanguage: 'English' };
}
```

**Fixed:**
Remove this block entirely. Let the edge function handle all translations, including to English.

---

### 2. Fix `translate-message/index.ts` (lines 32-39)

**Current (broken):**
```typescript
// If target is English and no source specified, likely already English - return as-is
if (targetLanguage.toLowerCase() === 'english' && !sourceLanguage) {
  console.log('[translate-message] Target is English, returning original text');
  return new Response(
    JSON.stringify({ translatedText: text, detectedLanguage: 'English' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**Fixed:**
Remove this block entirely. The AI model should detect the source language and translate to English properly.

---

## Why This Fixes the Issue

| Before | After |
|--------|-------|
| Spanish → English: Returns original Spanish, says "from English" | Spanish → English: Actually translates to English, correctly shows "from Spanish" |
| AI is never called for English targets | AI properly detects language and translates |

---

## Logic Flow After Fix

```text
User clicks "Translate" on: "Buenas noche. El. Link. No deja seguir."
↓
translateMessage(text, 'en') called
↓
Edge function invoked with targetLanguage: "English"
↓
AI prompt: "Detect source language and translate to English"
↓
AI returns: "Good evening. The link. It won't let me continue. What do we do?"
         + "DETECTED: Spanish"
↓
UI shows: "Good evening. The link. It won't let me continue. What do we do?"
         "Translated from Spanish"
```

---

## Summary

Two lines of faulty "optimization" code prevented translation to English from working. Removing these shortcuts ensures:
1. All translations go through the AI, regardless of target language
2. Source language is properly detected
3. English users can translate incoming foreign language messages
