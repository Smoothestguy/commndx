import React, { useState } from "react";
import { FileText, Receipt } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractorSubmissionForm } from "@/components/contractor/ContractorSubmissionForm";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";

export default function ContractorPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"bill" | "expense">("bill");

  const handleSuccess = () => {
    navigate("/contractor/success", { state: { type: activeTab } });
  };

  return (
    <>
      <SEO
        title="Contractor Submission Portal"
        description="Submit your bills and expenses"
      />
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="container max-w-2xl mx-auto py-8 px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
              Contractor Submission Portal
            </h1>
            <p className="text-muted-foreground">
              Submit your bills and expense receipts
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
                    Submit Bill
                  </TabsTrigger>
                  <TabsTrigger value="expense" className="gap-2">
                    <Receipt className="h-4 w-4" />
                    Submit Expense
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>
                <TabsContent value="bill" className="mt-0">
                  <div className="mb-6">
                    <CardTitle className="text-lg">Bill Submission</CardTitle>
                    <CardDescription>
                      Submit invoices and bills for completed work
                    </CardDescription>
                  </div>
                  <ContractorSubmissionForm
                    formType="bill"
                    onSuccess={handleSuccess}
                  />
                </TabsContent>

                <TabsContent value="expense" className="mt-0">
                  <div className="mb-6">
                    <CardTitle className="text-lg">Expense Submission</CardTitle>
                    <CardDescription>
                      Submit receipts for project-related expenses
                    </CardDescription>
                  </div>
                  <ContractorSubmissionForm
                    formType="expense"
                    onSuccess={handleSuccess}
                  />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-8">
            Need help? Contact your project manager.
          </p>
        </div>
      </div>
    </>
  );
}
