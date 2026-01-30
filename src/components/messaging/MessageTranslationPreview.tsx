import { X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_LANGUAGES, LanguageCode } from "@/hooks/useMessageTranslation";

interface MessageTranslationPreviewProps {
  originalText: string;
  translatedText: string;
  targetLanguage: LanguageCode;
  isTranslating?: boolean;
  onSendTranslated: () => void;
  onCancel: () => void;
  onEditTranslation?: (text: string) => void;
}

export function MessageTranslationPreview({
  originalText,
  translatedText,
  targetLanguage,
  isTranslating = false,
  onSendTranslated,
  onCancel,
  onEditTranslation,
}: MessageTranslationPreviewProps) {
  const targetLang = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage);

  return (
    <div className="border rounded-lg p-3 mb-2 bg-muted/30 space-y-2">
      {/* Original message preview */}
      <div className="text-xs text-muted-foreground">
        Original:
      </div>
      <div className="text-sm text-muted-foreground bg-background/50 rounded p-2 line-clamp-2">
        {originalText}
      </div>

      {/* Translation label */}
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <span>Translating to:</span>
        <span className="font-medium">
          {targetLang?.flag} {targetLang?.name}
        </span>
      </div>

      {/* Translated text */}
      {isTranslating ? (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">Translating...</span>
        </div>
      ) : onEditTranslation ? (
        <Textarea
          value={translatedText}
          onChange={(e) => onEditTranslation(e.target.value)}
          className="min-h-[60px] text-sm resize-none"
          placeholder="Translation will appear here..."
        />
      ) : (
        <div className="text-sm bg-background rounded p-2 border">
          {translatedText}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isTranslating}
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSendTranslated}
          disabled={isTranslating || !translatedText.trim()}
        >
          <Check className="h-4 w-4 mr-1" />
          Send Translated
        </Button>
      </div>
    </div>
  );
}
