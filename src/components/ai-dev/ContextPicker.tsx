import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, AlertTriangle, Database, Route } from "lucide-react";
import { useLocation } from "react-router-dom";

export interface ContextData {
  route?: string;
  code?: string;
  error?: string;
  schema?: string;
}

interface ContextPickerProps {
  onContextChange: (context: ContextData) => void;
}

export function ContextPicker({ onContextChange }: ContextPickerProps) {
  const location = useLocation();
  const [includeRoute, setIncludeRoute] = useState(true);
  const [includeCode, setIncludeCode] = useState(false);
  const [includeError, setIncludeError] = useState(false);
  const [includeSchema, setIncludeSchema] = useState(false);
  
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [schema, setSchema] = useState("");

  const updateContext = () => {
    const context: ContextData = {};
    if (includeRoute) context.route = location.pathname;
    if (includeCode && code.trim()) context.code = code;
    if (includeError && error.trim()) context.error = error;
    if (includeSchema && schema.trim()) context.schema = schema;
    onContextChange(context);
  };

  const handleRouteToggle = (checked: boolean) => {
    setIncludeRoute(checked);
    setTimeout(updateContext, 0);
  };

  const handleCodeToggle = (checked: boolean) => {
    setIncludeCode(checked);
    setTimeout(updateContext, 0);
  };

  const handleErrorToggle = (checked: boolean) => {
    setIncludeError(checked);
    setTimeout(updateContext, 0);
  };

  const handleSchemaToggle = (checked: boolean) => {
    setIncludeSchema(checked);
    setTimeout(updateContext, 0);
  };

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Route Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="include-route" 
            checked={includeRoute}
            onCheckedChange={handleRouteToggle}
          />
          <Label htmlFor="include-route" className="flex items-center gap-2 text-sm cursor-pointer">
            <Route className="h-4 w-4 text-muted-foreground" />
            Current Route
            {includeRoute && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {location.pathname}
              </span>
            )}
          </Label>
        </div>

        {/* Code Toggle */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="include-code" 
              checked={includeCode}
              onCheckedChange={handleCodeToggle}
            />
            <Label htmlFor="include-code" className="flex items-center gap-2 text-sm cursor-pointer">
              <Code className="h-4 w-4 text-muted-foreground" />
              Code Snippet
            </Label>
          </div>
          {includeCode && (
            <Textarea
              placeholder="Paste your code here..."
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setTimeout(updateContext, 0);
              }}
              className="font-mono text-xs min-h-[100px]"
            />
          )}
        </div>

        {/* Error Toggle */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="include-error" 
              checked={includeError}
              onCheckedChange={handleErrorToggle}
            />
            <Label htmlFor="include-error" className="flex items-center gap-2 text-sm cursor-pointer">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Error Message
            </Label>
          </div>
          {includeError && (
            <Textarea
              placeholder="Paste error message or console log..."
              value={error}
              onChange={(e) => {
                setError(e.target.value);
                setTimeout(updateContext, 0);
              }}
              className="font-mono text-xs min-h-[80px] border-destructive/50"
            />
          )}
        </div>

        {/* Schema Toggle */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="include-schema" 
              checked={includeSchema}
              onCheckedChange={handleSchemaToggle}
            />
            <Label htmlFor="include-schema" className="flex items-center gap-2 text-sm cursor-pointer">
              <Database className="h-4 w-4 text-muted-foreground" />
              DB Schema Info
            </Label>
          </div>
          {includeSchema && (
            <Textarea
              placeholder="Paste table schema or column info..."
              value={schema}
              onChange={(e) => {
                setSchema(e.target.value);
                setTimeout(updateContext, 0);
              }}
              className="font-mono text-xs min-h-[80px]"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
