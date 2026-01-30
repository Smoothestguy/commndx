
# Add Message Translation to Messaging System

## Overview

Add two translation capabilities to the Messages feature:
1. **Translate incoming messages** - A translate button on received messages to translate them to your preferred language
2. **Translate outgoing messages before sending** - A language selector in the message input area to translate your message before sending

## Technical Approach

### 1. Create a New `translate-message` Edge Function

A lightweight edge function specifically for translating message text (simpler than `translate-form`).

**File:** `supabase/functions/translate-message/index.ts`

```text
Input:
- text: string (the message to translate)
- targetLanguage: string (e.g., "Spanish", "French")
- sourceLanguage?: string (optional, defaults to auto-detect)

Output:
- translatedText: string
- detectedLanguage?: string (if auto-detected)
```

Uses Lovable AI gateway (google/gemini-3-flash-preview) - no additional API keys needed.

### 2. Create `useMessageTranslation` Hook

A reusable hook for message translation with caching.

**File:** `src/hooks/useMessageTranslation.ts`

Features:
- Translate text to any supported language
- Cache translations to avoid redundant API calls
- Loading and error states
- Uses the same `SUPPORTED_LANGUAGES` from `useFormTranslation`

### 3. Update `MessageBubble` Component

Add a translate button to incoming messages.

**Changes:**
- Add a "Translate" button that appears on hover (similar to delete button)
- Shows loading spinner while translating
- Displays translated text below original (or replaces it with toggle)
- Shows detected source language

```text
┌─────────────────────────────────────┐
│ Hola, ¿cómo estás?                  │
│                                     │
│ [🌐 Translate] ← hover to reveal    │
└─────────────────────────────────────┘

After translation:
┌─────────────────────────────────────┐
│ Hola, ¿cómo estás?                  │
│ ─────────────────                   │
│ Hello, how are you?  [Show Original]│
└─────────────────────────────────────┘
```

### 4. Update `MessageInput` Component

Add ability to translate your message before sending.

**Changes:**
- Add a translate button/dropdown next to the SMS toggle
- When clicked, translates the current message to selected language
- Shows translated preview before sending
- Option to send original or translated version

```text
┌──────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Hello, how are you today?                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Translating to: Spanish                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Hola, ¿cómo estás hoy?                              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│  [🌐 Español ▼]  [📱 SMS]  [✓ Send Translated]           │
└──────────────────────────────────────────────────────────┘
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/translate-message/index.ts` | Edge function for message translation |
| `src/hooks/useMessageTranslation.ts` | React hook for translation with caching |
| `src/components/messaging/TranslateButton.tsx` | Reusable translate button component |
| `src/components/messaging/MessageTranslationPreview.tsx` | Shows translated text preview |

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/config.toml` | Add `[functions.translate-message]` entry |
| `src/components/messaging/MessageBubble.tsx` | Add translate button for incoming messages |
| `src/components/messaging/MessageInput.tsx` | Add translation capability before sending |
| `src/components/messaging/ConversationThread.tsx` | Pass translation-related props if needed |

---

## Detailed Component Behavior

### Incoming Message Translation (MessageBubble)

1. User hovers over a received message
2. "Translate" button appears (like the delete button for own messages)
3. User clicks translate
4. Loading spinner shows
5. Translated text appears below original
6. "Show original" toggle to switch between views
7. Translation is cached per message ID + language

### Outgoing Message Translation (MessageInput)

1. User types a message
2. User clicks the translate button (globe icon with dropdown)
3. User selects target language from dropdown
4. Message is translated and shown in a preview area
5. User can:
   - Edit the translation
   - Send the translated version
   - Cancel and send original
6. When sent, the translated message is what gets delivered

---

## Edge Function Design

```typescript
// translate-message/index.ts
serve(async (req) => {
  const { text, targetLanguage, sourceLanguage } = await req.json();
  
  // Validate input
  if (!text || !targetLanguage) {
    return error 400;
  }
  
  // Skip if same language
  if (targetLanguage.toLowerCase() === 'english' && !sourceLanguage) {
    return { translatedText: text };
  }
  
  // Call Lovable AI gateway
  const prompt = `Translate the following text to ${targetLanguage}. 
    Return ONLY the translation, no explanations.
    If you detect the source language, include it.`;
  
  // Return translated text
  return { translatedText, detectedLanguage };
});
```

---

## UX Considerations

1. **Non-blocking**: Translation errors don't prevent sending messages
2. **Cached**: Same message + language combo is cached to avoid redundant calls
3. **Fast**: Uses gemini-3-flash-preview for quick responses
4. **Visual feedback**: Loading spinners and clear state indicators
5. **Intuitive**: Globe icon is universally recognized for translation
6. **Preserves original**: Original message is always accessible

---

## Summary

This implementation adds bidirectional translation:
- **Incoming**: Translate messages you receive in other languages
- **Outgoing**: Translate your messages before sending to personnel/customers who speak other languages

Both features use the same backend (Lovable AI) and share the language list from the existing form translation system for consistency.
