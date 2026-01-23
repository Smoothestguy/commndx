import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageHistory } from "@/components/messaging/MessageHistory";
import { SendSMSDialog } from "@/components/messaging/SendSMSDialog";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { usePersonnel } from "@/integrations/supabase/hooks/usePersonnel";
import { useGetOrCreateConversation } from "@/integrations/supabase/hooks/useConversations";
import { Message } from "@/integrations/supabase/hooks/useMessages";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { MessageSquare, Send, Users, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function SMSBlastsTab() {
  const [, setSearchParams] = useSearchParams();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedRecipientType, setSelectedRecipientType] = useState<'customer' | 'personnel'>('customer');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [recipientOpen, setRecipientOpen] = useState(false);
  
  const { data: customers } = useCustomers();
  const { data: personnel } = usePersonnel();
  const getOrCreateConversation = useGetOrCreateConversation();

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

  const handleMessageClick = async (message: Message) => {
    try {
      const conversation = await getOrCreateConversation.mutateAsync({
        participantType: message.recipient_type as "customer" | "personnel",
        participantId: message.recipient_id,
      });
      
      // Navigate to inbox with this conversation selected
      setSearchParams({ tab: "inbox", conversation: conversation.id });
    } catch (error) {
      console.error("Failed to open conversation:", error);
      toast.error("Failed to open conversation");
    }
  };

  const recipientList = selectedRecipientType === 'customer'
    ? customers?.filter(c => c.phone).map(c => ({ id: c.id, name: c.name, phone: c.phone }))
    : personnel?.filter(p => p.phone).map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, phone: p.phone }));

  return (
    <div className="space-y-6">
      {/* New Message Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send New SMS
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
              <Popover open={recipientOpen} onOpenChange={setRecipientOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={recipientOpen}
                    className="w-full justify-between"
                  >
                    {selectedRecipientId
                      ? recipientList?.find((r) => r.id === selectedRecipientId)?.name
                      : "Search for a recipient..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name or phone..." />
                    <CommandList>
                      <CommandEmpty>No recipient found.</CommandEmpty>
                      <CommandGroup>
                        {recipientList?.map((recipient) => (
                          <CommandItem
                            key={recipient.id}
                            value={`${recipient.name} ${recipient.phone}`}
                            onSelect={() => {
                              setSelectedRecipientId(recipient.id);
                              setRecipientOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedRecipientId === recipient.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{recipient.name}</span>
                              <span className="text-xs text-muted-foreground">{recipient.phone}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
          <MessageHistory onMessageClick={handleMessageClick} />
        </CardContent>
      </Card>

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
    </div>
  );
}
