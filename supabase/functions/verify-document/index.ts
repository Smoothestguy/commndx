import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface VerificationResult {
  verified: boolean;
  documentType: 'ssn_card' | 'government_id' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
  message: string;
  extracted_ssn_last4?: string;
  extracted_name?: string;
  ssn_matches?: boolean;
}

const getSSNCardVerificationPrompt = (expectedSSNLast4?: string) => {
  return `You are a document verification expert. Analyze this Social Security Card image.

CRITICAL: You must respond ONLY with a valid JSON object, no other text.

Check the following:
1. Document Type: Is this actually a Social Security Card?
2. Legitimacy: Does it appear to be a real SSN card (not a screenshot, not photoshopped, not a printed copy)?
3. Image Quality: Is the image clear enough to read the SSN and name?
4. Required Elements:
   - Social Security Administration header/logo
   - A 9-digit SSN number visible
   - Name on the card

5. SSN EXTRACTION - CRITICAL: 
   - Extract the LAST 4 DIGITS of the SSN visible on the card
   - Extract the full name shown on the card
${expectedSSNLast4 ? `   
6. SSN CROSS-VERIFICATION:
   - The user entered an SSN ending in: ${expectedSSNLast4}
   - Verify if the SSN on the card ends with these same 4 digits
   - Set ssn_matches to true ONLY if the last 4 digits match exactly
` : ''}

Respond with this exact JSON structure:
{
  "verified": true/false,
  "documentType": "ssn_card",
  "confidence": "high" | "medium" | "low",
  "extracted_ssn_last4": "1234",
  "extracted_name": "John Doe",
  "ssn_matches": true/false,
  "issues": ["issue1", "issue2"],
  "message": "Human-readable summary of verification result"
}

Verification Guidelines:
- verified=true: Document appears legitimate AND ${expectedSSNLast4 ? 'SSN matches entered value AND' : ''} is a real SSN card
- verified=false: Wrong document type, appears fake, SSN doesn't match, or major issues
- confidence=high: Clear image, all elements visible, appears authentic
- confidence=medium: Some minor quality issues but document is identifiable  
- confidence=low: Poor quality or some suspicious elements
- issues: List specific problems found (empty array if none)
- ssn_matches: Set to false if cannot read SSN clearly or digits don't match`;
};

const getGovernmentIDVerificationPrompt = () => {
  return `You are a document verification expert. Analyze this Government-issued ID image.

CRITICAL: You must respond ONLY with a valid JSON object, no other text.

Check the following:
1. Document Type: Is this a legitimate Government-issued ID (Driver's License, State ID, or Passport)?
2. Legitimacy: Does it appear to be a real document (not a screenshot, not photoshopped, not a printed copy)?
3. Image Quality: Is the image clear enough to read important details?
4. Required Elements:
   - Photo of the ID holder
   - Name clearly visible
   - ID number/document number
   - Expiration date (if applicable)
   - Issuing authority (state seal, government logo)

5. EXTRACT the full name shown on the ID

Respond with this exact JSON structure:
{
  "verified": true/false,
  "documentType": "government_id",
  "confidence": "high" | "medium" | "low",
  "extracted_name": "John Doe",
  "issues": ["issue1", "issue2"],
  "message": "Human-readable summary of verification result"
}

Verification Guidelines:
- verified=true: Document appears legitimate and is a valid government ID
- verified=false: Wrong document type, appears fake, or major issues
- confidence=high: Clear image, all elements visible, appears authentic
- confidence=medium: Some minor quality issues but document is identifiable
- confidence=low: Poor quality or some suspicious elements
- issues: List specific problems found (empty array if none)`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, imageType, expectedDocumentType, expectedSSN } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!expectedDocumentType || !['ssn_card', 'government_id'].includes(expectedDocumentType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid document type. Must be ssn_card or government_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract last 4 digits of expected SSN for cross-verification
    const expectedSSNLast4 = expectedSSN && expectedSSN.length >= 4 
      ? expectedSSN.slice(-4) 
      : undefined;

    console.log(`Verifying document: expected type = ${expectedDocumentType}, has expected SSN = ${!!expectedSSNLast4}`);

    // Use document-specific prompts
    const prompt = expectedDocumentType === 'ssn_card'
      ? getSSNCardVerificationPrompt(expectedSSNLast4)
      : getGovernmentIDVerificationPrompt();
    
    // Prepare the image URL
    const mimeType = imageType || 'image/jpeg';
    const imageUrl = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:${mimeType};base64,${imageBase64}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI service credits exhausted.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI verification service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'AI returned empty response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI response content:', content);

    // Parse the JSON response
    let result: VerificationResult;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        // Try to find JSON object directly
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonStr = objectMatch[0];
        }
      }
      
      result = JSON.parse(jsonStr);
      
      // Validate the result structure
      if (typeof result.verified !== 'boolean') {
        result.verified = false;
      }
      if (!['ssn_card', 'government_id', 'unknown'].includes(result.documentType)) {
        result.documentType = 'unknown';
      }
      if (!['high', 'medium', 'low'].includes(result.confidence)) {
        result.confidence = 'low';
      }
      if (!Array.isArray(result.issues)) {
        result.issues = [];
      }
      if (typeof result.message !== 'string') {
        result.message = result.verified 
          ? 'Document verified successfully' 
          : 'Document verification failed';
      }

      // SSN mismatch override - if SSN was provided but doesn't match, fail verification
      if (expectedDocumentType === 'ssn_card' && expectedSSNLast4) {
        if (result.ssn_matches === false) {
          result.verified = false;
          result.confidence = 'high';
          if (!result.issues.includes('SSN on card does not match entered SSN')) {
            result.issues.push('SSN on card does not match entered SSN');
          }
          result.message = 'The SSN on your card does not match the number you entered. Please verify and try again.';
        } else if (result.ssn_matches === true && result.verified) {
          result.message = 'SSN card verified and matches your entered SSN.';
        }
      }

    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError, content);
      result = {
        verified: false,
        documentType: 'unknown',
        confidence: 'low',
        issues: ['Could not parse verification response'],
        message: 'Unable to verify document. Please try again with a clearer image.'
      };
    }

    console.log('Verification result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-document function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
