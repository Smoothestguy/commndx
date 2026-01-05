import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const analysisPrompt = `You are analyzing a screenshot of development work. Extract all development activities visible.

Look for:
- Git commits (commit messages, files changed, timestamps)
- Code deployments (what was deployed, when, where)
- Database migrations (schema changes, table modifications)
- Feature work (what was built/modified)
- Bug fixes (issues resolved)
- Code reviews (pull requests, feedback)
- Time spent on tasks (if visible)
- Technologies/languages used
- Project or client name (if mentioned)

For EACH activity found, return a JSON object with these exact fields:
- title: Brief summary (50 chars max)
- description: Full details extracted
- activity_type: One of: git_commit, deployment, database_migration, schema_change, feature_development, bug_fix, code_review, configuration, testing, documentation, other
- duration_minutes: REQUIRED - Estimated time in minutes. If time is not explicitly visible, you MUST estimate based on the complexity:
  * Small changes (typo fix, config tweak): 10-15 minutes
  * Git commits (single commit): 15-30 minutes
  * Bug fixes: 20-45 minutes depending on complexity
  * Code reviews: 15-30 minutes per PR
  * Feature development: 30-120 minutes based on scope
  * Database migrations/schema changes: 30-60 minutes
  * Deployments: 15-30 minutes
  * Documentation: 20-45 minutes
  * Testing: 30-60 minutes
  NEVER return null for duration - always provide your best estimate!
- activity_date: YYYY-MM-DD format (extract from screenshot or use today's date)
- activity_time: HH:MM format in 24-hour time. CRITICAL: Extract the EXACT timestamp visible in the screenshot!
  * If screenshot shows "8:53 AM" → return "08:53"
  * If screenshot shows "10:46 AM" → return "10:46"  
  * If screenshot shows "2:30 PM" → return "14:30"
  * If screenshot shows "11:15 PM" → return "23:15"
  * Return null ONLY if absolutely no time is visible
- project_name: Project/client name if visible, or null
- technologies: Array of technologies/languages used (e.g., ["React", "TypeScript", "Supabase"])
- confidence: "high", "medium", or "low" based on how clear the information is

IMPORTANT: 
1. Return ONLY a valid JSON object with an "activities" array
2. ALWAYS provide a duration_minutes value - this is REQUIRED. Estimate based on activity complexity if not visible.

Example format:
{
  "activities": [
    {
      "title": "Added user authentication",
      "description": "Implemented login/signup flow with email verification",
      "activity_type": "feature_development",
      "duration_minutes": 90,
      "activity_date": "2024-01-15",
      "activity_time": "08:53",
      "project_name": "MyApp",
      "technologies": ["React", "Supabase"],
      "confidence": "high"
    }
  ]
}

If no development activities are found in the image, return: {"activities": []}`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error('AI service is not configured');
    }

    const { imageBase64, imageType = 'image/jpeg' } = await req.json();

    if (!imageBase64) {
      throw new Error('No image provided');
    }

    console.log('Analyzing screenshot with Lovable AI...');
    console.log('Image type:', imageType);
    console.log('Image data length:', imageBase64.length);

    const today = new Date().toISOString().split('T')[0];
    const promptWithDate = analysisPrompt.replace("use today's date", `use ${today}`);

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
              { type: 'text', text: promptWithDate },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add credits to continue.');
      }
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ activities: [], message: 'No activities detected in screenshot' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Raw AI response content:', content.substring(0, 500));

    // Default duration estimates based on activity type
    const defaultDurations: Record<string, number> = {
      git_commit: 15,
      deployment: 30,
      database_migration: 45,
      schema_change: 30,
      feature_development: 60,
      bug_fix: 30,
      code_review: 20,
      configuration: 15,
      testing: 45,
      documentation: 30,
      other: 30,
    };

    // Parse the JSON response
    let activities = [];
    try {
      // Try to extract JSON from the response (it might be wrapped in markdown code blocks)
      let jsonStr = content;
      
      // Remove markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      const parsed = JSON.parse(jsonStr);
      activities = parsed.activities || [];
      
      // Validate and clean each activity - ensure duration is always set
      activities = activities.map((activity: any) => {
        const activityType = ['git_commit', 'deployment', 'database_migration', 'schema_change', 'feature_development', 'bug_fix', 'code_review', 'configuration', 'testing', 'documentation', 'other'].includes(activity.activity_type) 
          ? activity.activity_type 
          : 'other';
        
        // Ensure duration is always a positive number
        let duration = typeof activity.duration_minutes === 'number' && activity.duration_minutes > 0 
          ? activity.duration_minutes 
          : defaultDurations[activityType] || 30;
        
        return {
          title: String(activity.title || '').substring(0, 100),
          description: String(activity.description || ''),
          activity_type: activityType,
          duration_minutes: duration,
          activity_date: activity.activity_date || today,
          activity_time: activity.activity_time || null,
          project_name: activity.project_name || null,
          technologies: Array.isArray(activity.technologies) ? activity.technologies : [],
          confidence: ['high', 'medium', 'low'].includes(activity.confidence) ? activity.confidence : 'medium',
        };
      });

      console.log(`Extracted ${activities.length} activities`);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.log('Content that failed to parse:', content);
      
      // Return empty activities with a message
      return new Response(
        JSON.stringify({ 
          activities: [], 
          message: 'Could not parse activities from screenshot. Try a clearer image or add manually.',
          raw_response: content.substring(0, 200)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ activities }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-dev-screenshot function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        activities: []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
