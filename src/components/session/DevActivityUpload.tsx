import { useState, useCallback, useEffect } from "react";
import { Upload, ImageIcon, Loader2, AlertCircle, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAnalyzeScreenshot } from "@/hooks/useDevActivities";

interface DevActivityUploadProps {
  onAnalysisComplete: (activities: any[]) => void;
  onManualEntry: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export function DevActivityUpload({ onAnalysisComplete, onManualEntry }: DevActivityUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { analyzeScreenshot, isAnalyzing } = useAnalyzeScreenshot();

  const handleFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, or WEBP image");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleFile(file);
        }
        return;
      }
    }
  }, [handleFile]);

  // Listen for paste events when no preview is shown
  useEffect(() => {
    if (preview) return;

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [preview, handlePaste]);

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    try {
      // Convert file reading to a Promise to properly catch errors
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(selectedFile);
      });

      // Extract base64 data (remove data:image/xxx;base64, prefix)
      const base64 = dataUrl.split(",")[1];
      
      const result = await analyzeScreenshot(base64, selectedFile.type);
      
      if (result.activities.length === 0) {
        toast.info(result.message || "No activities found. Try a clearer image or add manually.");
        return;
      }

      onAnalysisComplete(result.activities);
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error(error instanceof Error ? error.message : "Analysis failed. Please try again.");
    }
  };

  const clearPreview = () => {
    setPreview(null);
    setSelectedFile(null);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {!preview ? (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-muted">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-medium">Upload a screenshot</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Drag & drop, click to browse, or paste
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <kbd className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted border text-xs font-mono">
                      <Keyboard className="h-3 w-3" />
                      ⌘V
                    </kbd>
                    <span className="text-xs text-muted-foreground">or</span>
                    <kbd className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted border text-xs font-mono">
                      Ctrl+V
                    </kbd>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    PNG, JPG, WEBP up to 5MB
                  </p>
                </div>
                <input
                  type="file"
                  id="screenshot-upload"
                  className="hidden"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={handleInputChange}
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("screenshot-upload")?.click()}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Choose File
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border">
                <img
                  src={preview}
                  alt="Screenshot preview"
                  className="w-full max-h-[400px] object-contain bg-muted"
                />
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium">Analyzing with AI...</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="flex-1"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    "Analyze with AI"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={clearPreview}
                  disabled={isAnalyzing}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            variant="ghost"
            className="w-full"
            onClick={onManualEntry}
          >
            Add activity manually
          </Button>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-muted-foreground">
              <p className="font-medium">Tips for best results:</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                <li>• Upload screenshots of git logs, commit histories, or terminal output</li>
                <li>• Include project boards, time tracking apps, or dev notes</li>
                <li>• Make sure text is legible in the screenshot</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
