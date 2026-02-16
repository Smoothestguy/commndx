import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileBase64, mimeType } = await req.json();

    if (!fileBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing room/unit document...');

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
            role: 'system',
            content: `You are an expert at extracting room/unit data from construction spreadsheets and documents.

Extract ALL rooms/units from the document. Each row represents one hotel room or unit with scope quantities.

IMPORTANT RULES:
1. SKIP any "TOTALS" row — the last row with summed values is NOT a room.
2. For each room, extract: unit number, shower size, ceiling height, and all scope quantities.
3. Scope columns may include: Carpet, Floor Tile, Shower Floor, Shower Wall, Trim Top, Trim Side, Bath Threshold, Entry Threshold, Shower Curbs.
4. If a cell is blank or empty, set its value to 0.
5. Detect special notes in the Shower Size column like "Double Curb" or "ADA" — store these in a separate notes field and keep the shower size dimension value.
6. Unit numbers are typically 3-digit numbers (e.g., 201, 416, 520).
7. Ceiling heights are typically 8 or 9 (feet).
8. Shower sizes are typically formatted like "4.6x2.10" or "3x3".`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all room/unit data from this document. Return them using the extract_room_units function. Skip any totals/summary rows.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'application/pdf'};base64,${fileBase64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_room_units',
              description: 'Extract room/unit data from a construction spreadsheet',
              parameters: {
                type: 'object',
                properties: {
                  rooms: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        unit_number: { type: 'string', description: 'Room/unit number (e.g. "251")' },
                        shower_size: { type: 'string', description: 'Shower dimensions (e.g. "4.6x2.10")' },
                        ceiling_height: { type: 'number', description: 'Ceiling height in feet (e.g. 8 or 9)' },
                        notes: { type: 'string', description: 'Special notes like "Double Curb", "ADA", etc.' },
                        carpet: { type: 'number', description: 'Carpet quantity (sqft)' },
                        floor_tile: { type: 'number', description: 'Floor tile quantity (sqft)' },
                        shower_floor: { type: 'number', description: 'Shower floor quantity (sqft)' },
                        shower_wall: { type: 'number', description: 'Shower wall quantity (sqft)' },
                        trim_top: { type: 'number', description: 'Trim top quantity (lf)' },
                        trim_side: { type: 'number', description: 'Trim side quantity (lf)' },
                        bath_threshold: { type: 'number', description: 'Bath threshold count' },
                        entry_threshold: { type: 'number', description: 'Entry threshold count' },
                        shower_curbs: { type: 'number', description: 'Shower curbs count' }
                      },
                      required: ['unit_number']
                    }
                  }
                },
                required: ['rooms']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_room_units' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('AI response received:', JSON.stringify(data).slice(0, 500));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_room_units') {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not extract room data from document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log(`Successfully extracted ${extractedData.rooms?.length || 0} rooms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        rooms: extractedData.rooms || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing room units:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
