import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, User } from "lucide-react";
import type { EmergencyContact } from "@/integrations/supabase/hooks/usePersonnelRegistrations";

interface EmergencyContactFormProps {
  contacts: EmergencyContact[];
  onChange: (contacts: EmergencyContact[]) => void;
}

const emptyContact: EmergencyContact = {
  name: "",
  relationship: "",
  phone: "",
  email: "",
  is_primary: false,
};

export const EmergencyContactForm = ({
  contacts,
  onChange,
}: EmergencyContactFormProps) => {
  const addContact = () => {
    const newContact = {
      ...emptyContact,
      is_primary: contacts.length === 0,
    };
    onChange([...contacts, newContact]);
  };

  const removeContact = (index: number) => {
    const updated = contacts.filter((_, i) => i !== index);
    // Ensure at least one is primary if contacts remain
    if (updated.length > 0 && !updated.some((c) => c.is_primary)) {
      updated[0].is_primary = true;
    }
    onChange(updated);
  };

  const updateContact = (
    index: number,
    field: keyof EmergencyContact,
    value: string | boolean
  ) => {
    const updated = contacts.map((contact, i) => {
      if (i === index) {
        if (field === "is_primary" && value === true) {
          return { ...contact, is_primary: true };
        }
        return { ...contact, [field]: value };
      }
      // Unset other primaries when setting a new one
      if (field === "is_primary" && value === true) {
        return { ...contact, is_primary: false };
      }
      return contact;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {contacts.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <User className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground mb-4">
            Add at least one emergency contact
          </p>
          <Button type="button" onClick={addContact} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Emergency Contact
          </Button>
        </div>
      )}

      {contacts.map((contact, index) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Emergency Contact {index + 1}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeContact(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`contact-name-${index}`}>Full Name *</Label>
                <Input
                  id={`contact-name-${index}`}
                  value={contact.name}
                  onChange={(e) => updateContact(index, "name", e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`contact-relationship-${index}`}>
                  Relationship *
                </Label>
                <Input
                  id={`contact-relationship-${index}`}
                  value={contact.relationship}
                  onChange={(e) =>
                    updateContact(index, "relationship", e.target.value)
                  }
                  placeholder="Spouse, Parent, etc."
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`contact-phone-${index}`}>Phone *</Label>
                <Input
                  id={`contact-phone-${index}`}
                  type="tel"
                  value={contact.phone}
                  onChange={(e) =>
                    updateContact(index, "phone", e.target.value)
                  }
                  placeholder="(555) 123-4567"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`contact-email-${index}`}>Email</Label>
                <Input
                  id={`contact-email-${index}`}
                  type="email"
                  value={contact.email || ""}
                  onChange={(e) =>
                    updateContact(index, "email", e.target.value)
                  }
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id={`contact-primary-${index}`}
                checked={contact.is_primary}
                onCheckedChange={(checked) =>
                  updateContact(index, "is_primary", !!checked)
                }
              />
              <Label
                htmlFor={`contact-primary-${index}`}
                className="text-sm font-normal cursor-pointer"
              >
                Primary emergency contact
              </Label>
            </div>
          </CardContent>
        </Card>
      ))}

      {contacts.length > 0 && (
        <Button type="button" onClick={addContact} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Another Contact
        </Button>
      )}
    </div>
  );
};
