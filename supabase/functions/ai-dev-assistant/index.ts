import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an expert AI Developer Assistant for a React/TypeScript/Supabase application.

When the user describes what they want to build or fix:
1. First understand the goal clearly
2. Produce a SHORT, actionable plan (3-7 steps max)
3. List exact files to edit
4. Provide copy-paste ready code patches
5. Prefer minimal changes - do not rebuild entire components
6. Never output secrets or API keys
7. If something is unknown, ask for the specific missing info (file name, error, table) - ONE question only

ALWAYS return your response in this EXACT JSON structure:
{
  "plan": ["Step 1 description", "Step 2 description", ...],
  "files_to_edit": ["src/path/to/file.tsx", ...],
  "patches": [
    {
      "file": "src/path/to/file.tsx",
      "explanation": "Why this change is needed",
      "code": "// Full updated function or relevant code block"
    }
  ],
  "questions": ["Only include if absolutely required to proceed"],
  "notes": "Any additional notes or warnings"
}

Rules:
- Be concise and actionable
- Code should be copy-paste ready
- Prefer search-replace style patches when possible
- If you need more info, ask ONE specific question
- Consider RLS policies, type safety, and error handling`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { goal, context, command } = await req.json();
    
    if (!goal && !command) {
      return new Response(
        JSON.stringify({ error: 'Goal or command is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the user message with context
    let userMessage = '';
    
    if (command) {
      userMessage += `[QUICK COMMAND: ${command}]\n\n`;
    }
    
    userMessage += `Goal: ${goal || 'Execute the command above'}\n\n`;
    
    if (context) {
      if (context.route) {
        userMessage += `Current Route: ${context.route}\n\n`;
      }
      if (context.code) {
        userMessage += `Code Snippet:\n\`\`\`\n${context.code}\n\`\`\`\n\n`;
      }
      if (context.error) {
        userMessage += `Error Message:\n\`\`\`\n${context.error}\n\`\`\`\n\n`;
      }
      if (context.schema) {
        userMessage += `Database Schema:\n\`\`\`sql\n${context.schema}\n\`\`\`\n\n`;
      }
    }

    console.log('Sending request to Lovable AI with goal:', goal || command);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to parse the JSON response
    let parsedResponse;
    try {
      // Remove markdown code blocks if present
      let cleanContent = content;
      if (content.includes('```json')) {
        cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (content.includes('```')) {
        cleanContent = content.replace(/```\n?/g, '');
      }
      parsedResponse = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.log('Could not parse as JSON, returning raw content');
      // If not valid JSON, wrap the content
      parsedResponse = {
        plan: [],
        files_to_edit: [],
        patches: [],
        questions: [],
        notes: content
      };
    }

    console.log('Successfully processed AI response');
    
    return new Response(
      JSON.stringify(parsedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-dev-assistant:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
