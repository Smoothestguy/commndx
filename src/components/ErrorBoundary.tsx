import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface for debugging on user devices
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Caught render error:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const { fallbackTitle, fallbackMessage } = this.props;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="rounded-full bg-destructive/10 p-4 w-fit mx-auto">
              <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">
              {fallbackTitle ?? "Something went wrong"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {fallbackMessage ??
                "The page ran into an unexpected problem. Your progress has been saved — please try again."}
            </p>
            {this.state.error?.message && (
              <details className="text-left text-xs text-muted-foreground bg-muted/50 rounded p-3">
                <summary className="cursor-pointer font-medium">Error details</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <Button onClick={this.handleReload} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundary;
