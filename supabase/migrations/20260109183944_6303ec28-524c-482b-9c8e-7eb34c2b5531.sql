-- Set spreadsheet-style compact dashboard for cg@codewcg.com
INSERT INTO public.dashboard_configurations (user_id, layout, widgets, theme)
VALUES (
  '17c51c9c-c27c-4403-882f-10b4e78b994b',
  '{"columns": 4, "widgets": []}',
  '[]',
  '{"fontSize": "small", "spacing": "compact", "borderRadius": "none", "density": "spreadsheet", "cardOpacity": 100}'
)
ON CONFLICT (user_id) 
DO UPDATE SET 
  theme = '{"fontSize": "small", "spacing": "compact", "borderRadius": "none", "density": "spreadsheet", "cardOpacity": 100}',
  updated_at = now();