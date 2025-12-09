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
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing work order document...');

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
            content: `You are an expert at extracting line items from work orders and invoices. 
            Extract ALL line items from the document, including:
            - Product/material codes or names
            - Descriptions
            - Quantities (look for SQ, SF, LF, EA, etc.)
            - Unit prices
            - Units of measure
            
            Be thorough and extract every billable line item. Include labor items, materials, and any other charges.
            If a quantity or price is not clearly stated, use 1 for quantity and 0 for price.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all line items from this work order document. Return them using the extract_line_items function.'
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
              name: 'extract_line_items',
              description: 'Extract line items from a work order document',
              parameters: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_code: { 
                          type: 'string',
                          description: 'Product code, SKU, or short identifier'
                        },
                        description: { 
                          type: 'string',
                          description: 'Full description of the item or service'
                        },
                        quantity: { 
                          type: 'number',
                          description: 'Quantity ordered'
                        },
                        unit_price: { 
                          type: 'number',
                          description: 'Price per unit'
                        },
                        unit: { 
                          type: 'string',
                          description: 'Unit of measure (SQ, SF, LF, EA, HR, etc.)'
                        }
                      },
                      required: ['description', 'quantity']
                    }
                  },
                  customer_info: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      address: { type: 'string' },
                      job_name: { type: 'string' }
                    }
                  }
                },
                required: ['items']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_line_items' } }
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
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits to continue.' }),
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

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_line_items') {
      console.error('No valid tool call in response');
      return new Response(
        JSON.stringify({ success: false, error: 'Could not extract items from document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log(`Successfully extracted ${extractedData.items?.length || 0} items`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        items: extractedData.items || [],
        customer_info: extractedData.customer_info || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing work order:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
