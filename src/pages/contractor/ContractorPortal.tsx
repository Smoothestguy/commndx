import React, { useState } from "react";
import { FileText, Receipt } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContractorSubmissionForm } from "@/components/contractor/ContractorSubmissionForm";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Language, getTranslation } from "@/components/contractor/translations";

export default function ContractorPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"bill" | "expense">("bill");
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);

  const t = (key: Parameters<typeof getTranslation>[1]) => 
    getTranslation(selectedLanguage || "en", key);

  const handleSuccess = () => {
    navigate("/contractor/success", { state: { type: activeTab } });
  };

  // Language Selection Screen
  if (!selectedLanguage) {
    return (
      <>
        <SEO
          title="Contractor Submission Portal"
          description="Submit your bills and expenses"
        />
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
          <div className="container max-w-md mx-auto py-8 px-4">
            <Card className="shadow-lg">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl font-bold">
                  Select Your Language
                </CardTitle>
                <CardDescription className="text-lg">
                  Seleccione Su Idioma
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5"
                    onClick={() => setSelectedLanguage("en")}
                  >
                    <span className="text-3xl">🇺🇸</span>
                    <span className="font-medium">English</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5"
                    onClick={() => setSelectedLanguage("es")}
                  >
                    <span className="text-3xl">🇪🇸</span>
                    <span className="font-medium">Español</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title={t("portalTitle")}
        description={t("portalSubtitle")}
      />
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="container max-w-2xl mx-auto py-8 px-4">
          {/* Language Switcher */}
          <div className="flex justify-end mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedLanguage(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              {selectedLanguage === "en" ? "🇺🇸 English" : "🇪🇸 Español"}
            </Button>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
              {t("portalTitle")}
            </h1>
            <p className="text-muted-foreground">
              {t("portalSubtitle")}
            </p>
          </div>

          {/* Main Card */}
          <Card className="shadow-lg">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "bill" | "expense")}
            >
              <CardHeader className="pb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="bill" className="gap-2">
                    <FileText className="h-4 w-4" />
                    {t("submitBill")}
                  </TabsTrigger>
                  <TabsTrigger value="expense" className="gap-2">
                    <Receipt className="h-4 w-4" />
                    {t("submitExpense")}
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>
                <TabsContent value="bill" className="mt-0">
                  <div className="mb-6">
                    <CardTitle className="text-lg">{t("billSubmission")}</CardTitle>
                    <CardDescription>
                      {t("billDescription")}
                    </CardDescription>
                  </div>
                  <ContractorSubmissionForm
                    formType="bill"
                    onSuccess={handleSuccess}
                    language={selectedLanguage}
                  />
                </TabsContent>

                <TabsContent value="expense" className="mt-0">
                  <div className="mb-6">
                    <CardTitle className="text-lg">{t("expenseSubmission")}</CardTitle>
                    <CardDescription>
                      {t("expenseDescription")}
                    </CardDescription>
                  </div>
                  <ContractorSubmissionForm
                    formType="expense"
                    onSuccess={handleSuccess}
                    language={selectedLanguage}
                  />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-8">
            {t("needHelp")}
          </p>
        </div>
      </div>
    </>
  );
}
