import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageHistory } from "@/components/messaging/MessageHistory";
import { SendSMSDialog } from "@/components/messaging/SendSMSDialog";
import { useMessageStats } from "@/integrations/supabase/hooks/useMessages";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { usePersonnel } from "@/integrations/supabase/hooks/usePersonnel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, CheckCircle, AlertCircle, Clock, Users } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function Messages() {
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedRecipientType, setSelectedRecipientType] = useState<'customer' | 'personnel'>('customer');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  
  const { data: stats } = useMessageStats();
  const { data: customers } = useCustomers();
  const { data: personnel } = usePersonnel();

  const selectedCustomer = customers?.find(c => c.id === selectedRecipientId);
  const selectedPersonnel = personnel?.find(p => p.id === selectedRecipientId);
  
  const selectedRecipient = selectedRecipientType === 'customer' ? selectedCustomer : selectedPersonnel;
  const recipientName = selectedRecipientType === 'customer' 
    ? selectedCustomer?.name || ''
    : selectedPersonnel ? `${selectedPersonnel.first_name} ${selectedPersonnel.last_name}` : '';
  const recipientPhone = selectedRecipientType === 'customer'
    ? selectedCustomer?.phone || ''
    : selectedPersonnel?.phone || '';

  const handleNewMessage = () => {
    if (selectedRecipient && recipientPhone) {
      setSendDialogOpen(true);
    }
  };

  const recipientList = selectedRecipientType === 'customer'
    ? customers?.filter(c => c.phone).map(c => ({ id: c.id, name: c.name, phone: c.phone }))
    : personnel?.filter(p => p.phone).map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, phone: p.phone }));

  return (
    <PageLayout title="Messages">
      <SEO 
        title="Messages | Command X"
        description="Send and manage SMS messages to customers and personnel"
      />

      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sent</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.sent || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats?.failed || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* New Message Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send New Message
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="space-y-2 flex-1">
                <Label>Recipient Type</Label>
                <Select 
                  value={selectedRecipientType} 
                  onValueChange={(value: 'customer' | 'personnel') => {
                    setSelectedRecipientType(value);
                    setSelectedRecipientId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="personnel">Personnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 flex-[2]">
                <Label>Select Recipient</Label>
                <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a recipient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {recipientList?.map((recipient) => (
                      <SelectItem key={recipient.id} value={recipient.id}>
                        {recipient.name} - {recipient.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleNewMessage}
                  disabled={!selectedRecipientId || !recipientPhone}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Compose SMS
                </Button>
              </div>
            </div>

            {!recipientList?.length && (
              <p className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                No {selectedRecipientType === 'customer' ? 'customers' : 'personnel'} with phone numbers found.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Message History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Message History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MessageHistory />
          </CardContent>
        </Card>
      </div>

      {selectedRecipientId && (
        <SendSMSDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          recipientType={selectedRecipientType}
          recipientId={selectedRecipientId}
          recipientName={recipientName}
          recipientPhone={recipientPhone}
        />
      )}
    </PageLayout>
  );
}
