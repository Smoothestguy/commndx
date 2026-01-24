import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useGetOrCreateConversation } from "@/integrations/supabase/hooks/useConversations";
import { Loader2, User, Users, Building2, ClipboardList } from "lucide-react";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}

interface Recipient {
  id: string;
  name: string;
  type: "user" | "personnel" | "customer" | "applicant";
  subtitle?: string;
  phone?: string;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: NewConversationDialogProps) {
  const [recipientType, setRecipientType] = useState<"user" | "personnel" | "customer" | "applicant">("personnel");
  const [search, setSearch] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);

  const getOrCreateConversation = useGetOrCreateConversation();

  useEffect(() => {
    if (open) {
      fetchRecipients();
    }
  }, [open, recipientType]);

  const fetchRecipients = async () => {
    setIsLoading(true);
    try {
      let data: Recipient[] = [];

      if (recipientType === "user") {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .order("first_name");

        data = (profiles || []).map((p) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`.trim() || "Unknown User",
          type: "user" as const,
          subtitle: p.email,
        }));
      } else if (recipientType === "personnel") {
        const { data: personnel } = await supabase
          .from("personnel")
          .select("id, first_name, last_name, email, phone")
          .eq("status", "active")
          .order("first_name");

        data = (personnel || []).map((p) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`.trim(),
          type: "personnel" as const,
          subtitle: p.email || undefined,
          phone: p.phone || undefined,
        }));
      } else if (recipientType === "customer") {
        const { data: customers } = await supabase
          .from("customers")
          .select("id, name, email, company, phone")
          .is("deleted_at", null)
          .order("name");

        data = (customers || []).map((c) => ({
          id: c.id,
          name: c.name,
          type: "customer" as const,
          subtitle: c.company || c.email,
          phone: c.phone || undefined,
        }));
      } else if (recipientType === "applicant") {
        const { data: applicants } = await supabase
          .from("applicants")
          .select("id, first_name, last_name, email, phone")
          .not("phone", "is", null)
          .order("first_name");

        data = (applicants || []).map((a) => ({
          id: a.id,
          name: `${a.first_name} ${a.last_name}`.trim(),
          type: "applicant" as const,
          subtitle: a.email || undefined,
          phone: a.phone || undefined,
        }));
      }

      setRecipients(data);
    } catch (error) {
      console.error("Error fetching recipients:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecipients = recipients.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.subtitle?.toLowerCase().includes(search.toLowerCase()) ||
      r.phone?.includes(search.replace(/\D/g, ""))
  );

  const handleStartConversation = async () => {
    if (!selectedRecipient) return;

    try {
      const conversation = await getOrCreateConversation.mutateAsync({
        participantType: selectedRecipient.type,
        participantId: selectedRecipient.id,
      });

      onConversationCreated(conversation.id);
      onOpenChange(false);
      setSelectedRecipient(null);
      setSearch("");
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "personnel":
        return <Users className="h-4 w-4" />;
      case "customer":
        return <Building2 className="h-4 w-4" />;
      case "applicant":
        return <ClipboardList className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Recipient type selector */}
          <Select
            value={recipientType}
            onValueChange={(value) => {
              setRecipientType(value as typeof recipientType);
              setSelectedRecipient(null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select recipient type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personnel">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Personnel
                </div>
              </SelectItem>
              <SelectItem value="customer">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Customer
                </div>
              </SelectItem>
              <SelectItem value="applicant">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Applicant
                </div>
              </SelectItem>
              <SelectItem value="user">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  User
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Search */}
          <SearchInput
            placeholder={`Search ${recipientType}s...`}
            value={search}
            onChange={setSearch}
          />

          {/* Recipients list */}
          <ScrollArea className="h-[250px] border rounded-md">
            {isLoading ? (
              <div className="p-2 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-2 p-2">
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredRecipients.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No {recipientType}s found
              </div>
            ) : (
              <div className="p-1">
                {filteredRecipients.map((recipient) => (
                  <button
                    key={recipient.id}
                    onClick={() => setSelectedRecipient(recipient)}
                    className={`w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors ${
                      selectedRecipient?.id === recipient.id ? "bg-muted" : ""
                    }`}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(recipient.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0 overflow-hidden">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium truncate flex-1 min-w-0">{recipient.name}</span>
                        <span className="text-muted-foreground flex-shrink-0">
                          {getTypeIcon(recipient.type)}
                        </span>
                      </div>
                      {(recipient.subtitle || recipient.phone) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {recipient.subtitle}
                          {recipient.subtitle && recipient.phone && " • "}
                          {recipient.phone}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Start conversation button */}
          <Button
            onClick={handleStartConversation}
            disabled={!selectedRecipient || getOrCreateConversation.isPending}
            className="w-full"
          >
            {getOrCreateConversation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : selectedRecipient ? (
              `Start conversation with ${selectedRecipient.name}`
            ) : (
              "Select a recipient"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
