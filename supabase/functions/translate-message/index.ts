import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, targetLanguage, sourceLanguage } = await req.json();
    
    // Validate input
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!targetLanguage || typeof targetLanguage !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Target language is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error('[translate-message] LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Translation service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[translate-message] Translating to ${targetLanguage}${sourceLanguage ? ` from ${sourceLanguage}` : ''}`);
    console.log(`[translate-message] Text length: ${text.length} characters`);

    const systemPrompt = `You are a professional translator. Translate text accurately while preserving tone, meaning, and any formatting.
Return ONLY the translation with no explanations, no quotation marks around it, and no additional text.
If the text contains emojis or special characters, preserve them in the translation.`;

    const userPrompt = sourceLanguage 
      ? `Translate the following text from ${sourceLanguage} to ${targetLanguage}:\n\n${text}`
      : `Detect the source language and translate the following text to ${targetLanguage}. After the translation, on a new line write "DETECTED:" followed by the detected language name.\n\n${text}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.3, // Lower temperature for more consistent translations
      }),
    });

    if (!response.ok) {
      const errorStatus = response.status;
      
      if (errorStatus === 429) {
        console.error('[translate-message] Rate limit exceeded');
        return new Response(
          JSON.stringify({ error: 'Translation service rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (errorStatus === 402) {
        console.error('[translate-message] Payment required');
        return new Response(
          JSON.stringify({ error: 'Translation service credits exhausted.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const errorText = await response.text();
      console.error(`[translate-message] AI gateway error: ${errorStatus}`, errorText);
      return new Response(
        JSON.stringify({ error: 'Translation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[translate-message] Empty response from AI');
      return new Response(
        JSON.stringify({ error: 'Translation returned empty result' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the response - check if it contains detected language
    let translatedText = content.trim();
    let detectedLanguage: string | undefined;

    if (!sourceLanguage && content.includes('DETECTED:')) {
      const parts = content.split('DETECTED:');
      translatedText = parts[0].trim();
      detectedLanguage = parts[1]?.trim();
    }

    console.log(`[translate-message] Translation successful. Detected: ${detectedLanguage || 'N/A'}`);

    return new Response(
      JSON.stringify({ 
        translatedText, 
        detectedLanguage: detectedLanguage || sourceLanguage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[translate-message] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
