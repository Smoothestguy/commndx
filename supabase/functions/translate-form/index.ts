import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranslationRequest {
  content: {
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
  };
  targetLanguage: string;
  sourceLanguage?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, targetLanguage, sourceLanguage = 'English' }: TranslationRequest = await req.json();
    
    if (!content || !targetLanguage) {
      return new Response(
        JSON.stringify({ error: 'Missing content or targetLanguage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If target language is English and source is English, return original content
    if (targetLanguage.toLowerCase() === 'english') {
      return new Response(
        JSON.stringify({ translations: content }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a professional translator. Translate the following JSON content from ${sourceLanguage} to ${targetLanguage}. 
    
IMPORTANT RULES:
1. Maintain the exact JSON structure
2. Only translate the text values, not the keys
3. Keep placeholder syntax like {name} unchanged
4. Preserve any HTML or markdown formatting
5. Return ONLY valid JSON, no explanations
6. For field IDs, do NOT translate them - keep them exactly as they are`;

    const userPrompt = `Translate this form content to ${targetLanguage}:

${JSON.stringify(content, null, 2)}

Return the translated JSON with the exact same structure.`;

    console.log('[translate-form] Translating to:', targetLanguage);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('[translate-form] AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const translatedContent = data.choices?.[0]?.message?.content;

    if (!translatedContent) {
      throw new Error('No translation received from AI');
    }

    // Parse the JSON response - handle markdown code blocks
    let cleanedContent = translatedContent.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    let translations;
    try {
      translations = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('[translate-form] Failed to parse translation:', cleanedContent);
      throw new Error('Invalid translation format received');
    }

    console.log('[translate-form] Translation successful');

    return new Response(
      JSON.stringify({ translations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[translate-form] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Translation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
