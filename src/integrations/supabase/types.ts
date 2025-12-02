export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      badge_template_fields: {
        Row: {
          created_at: string | null
          field_name: string
          font_size: number | null
          id: string
          is_enabled: boolean | null
          position_x: number | null
          position_y: number | null
          template_id: string
        }
        Insert: {
          created_at?: string | null
          field_name: string
          font_size?: number | null
          id?: string
          is_enabled?: boolean | null
          position_x?: number | null
          position_y?: number | null
          template_id: string
        }
        Update: {
          created_at?: string | null
          field_name?: string
          font_size?: number | null
          id?: string
          is_enabled?: boolean | null
          position_x?: number | null
          position_y?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "badge_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "badge_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      badge_templates: {
        Row: {
          background_color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          orientation: string | null
          updated_at: string | null
        }
        Insert: {
          background_color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          orientation?: string | null
          updated_at?: string | null
        }
        Update: {
          background_color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          orientation?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          city: string | null
          company_name: string
          created_at: string | null
          default_tax_rate: number | null
          email: string | null
          estimate_footer: string | null
          id: string
          invoice_footer: string | null
          legal_name: string | null
          logo_url: string | null
          overtime_multiplier: number | null
          overtime_threshold: number | null
          phone: string | null
          state: string | null
          tax_id: string | null
          updated_at: string | null
          website: string | null
          weekly_overtime_threshold: number | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name?: string
          created_at?: string | null
          default_tax_rate?: number | null
          email?: string | null
          estimate_footer?: string | null
          id?: string
          invoice_footer?: string | null
          legal_name?: string | null
          logo_url?: string | null
          overtime_multiplier?: number | null
          overtime_threshold?: number | null
          phone?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string | null
          website?: string | null
          weekly_overtime_threshold?: number | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string
          created_at?: string | null
          default_tax_rate?: number | null
          email?: string | null
          estimate_footer?: string | null
          id?: string
          invoice_footer?: string | null
          legal_name?: string | null
          logo_url?: string | null
          overtime_multiplier?: number | null
          overtime_threshold?: number | null
          phone?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string | null
          website?: string | null
          weekly_overtime_threshold?: number | null
          zip?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          customer_type: Database["public"]["Enums"]["customer_type"] | null
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          contact_name: string
          created_at: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          personnel_id: string
          phone: string
          relationship: string | null
          updated_at: string | null
        }
        Insert: {
          contact_name: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          personnel_id: string
          phone: string
          relationship?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_name?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          personnel_id?: string
          phone?: string
          relationship?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_line_items: {
        Row: {
          created_at: string
          description: string
          estimate_id: string
          id: string
          markup: number
          product_id: string | null
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          estimate_id: string
          id?: string
          markup: number
          product_id?: string | null
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          estimate_id?: string
          id?: string
          markup?: number
          product_id?: string | null
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          approval_token: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          customer_approved: boolean | null
          customer_id: string
          customer_name: string
          id: string
          notes: string | null
          number: string
          project_id: string | null
          project_name: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["estimate_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
          valid_until: string
        }
        Insert: {
          approval_token?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_approved?: boolean | null
          customer_id: string
          customer_name: string
          id?: string
          notes?: string | null
          number: string
          project_id?: string | null
          project_name?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at?: string
          valid_until: string
        }
        Update: {
          approval_token?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_approved?: boolean | null
          customer_id?: string
          customer_name?: string
          id?: string
          notes?: string | null
          number?: string
          project_id?: string | null
          project_name?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_activity_log: {
        Row: {
          action: string
          created_at: string
          id: string
          invitation_id: string
          metadata: Json | null
          performed_by: string | null
          performed_by_email: string | null
          target_email: string
          target_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          invitation_id: string
          metadata?: Json | null
          performed_by?: string | null
          performed_by_email?: string | null
          target_email: string
          target_role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          invitation_id?: string
          metadata?: Json | null
          performed_by?: string | null
          performed_by_email?: string | null
          target_email?: string
          target_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "invitation_activity_log_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          markup: number
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          markup?: number
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          markup?: number
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          customer_id: string
          customer_name: string
          due_date: string
          estimate_id: string | null
          id: string
          job_order_id: string | null
          job_order_number: string | null
          number: string
          paid_date: string | null
          project_name: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_name: string
          due_date: string
          estimate_id?: string | null
          id?: string
          job_order_id?: string | null
          job_order_number?: string | null
          number: string
          paid_date?: string | null
          project_name?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_name?: string
          due_date?: string
          estimate_id?: string | null
          id?: string
          job_order_id?: string | null
          job_order_number?: string | null
          number?: string
          paid_date?: string | null
          project_name?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_order_id_fkey"
            columns: ["job_order_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      job_order_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          job_order_id: string
          markup: number
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          job_order_id: string
          markup: number
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          job_order_id?: string
          markup?: number
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_order_line_items_job_order_id_fkey"
            columns: ["job_order_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      job_orders: {
        Row: {
          completion_date: string | null
          created_at: string
          customer_id: string
          customer_name: string
          estimate_id: string | null
          id: string
          invoiced_amount: number
          number: string
          project_id: string
          project_name: string
          remaining_amount: number
          start_date: string
          status: Database["public"]["Enums"]["job_order_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          completion_date?: string | null
          created_at?: string
          customer_id: string
          customer_name: string
          estimate_id?: string | null
          id?: string
          invoiced_amount?: number
          number: string
          project_id: string
          project_name: string
          remaining_amount: number
          start_date: string
          status?: Database["public"]["Enums"]["job_order_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at?: string
        }
        Update: {
          completion_date?: string | null
          created_at?: string
          customer_id?: string
          customer_name?: string
          estimate_id?: string | null
          id?: string
          invoiced_amount?: number
          number?: string
          project_id?: string
          project_name?: string
          remaining_amount?: number
          start_date?: string
          status?: Database["public"]["Enums"]["job_order_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_orders_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completion_percentage: number
          created_at: string
          description: string | null
          due_date: string
          id: string
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completion_percentage?: number
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completion_percentage?: number
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          event_accepted: boolean | null
          event_cancelled: boolean | null
          event_expired: boolean | null
          event_reminder_sent: boolean | null
          event_resent: boolean | null
          event_sent: boolean | null
          id: string
          notification_browser: boolean | null
          notification_sound: boolean | null
          notification_toast: boolean | null
          po_approved: boolean | null
          po_rejected: boolean | null
          po_sent: boolean | null
          po_status_changed: boolean | null
          po_submitted_for_approval: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_accepted?: boolean | null
          event_cancelled?: boolean | null
          event_expired?: boolean | null
          event_reminder_sent?: boolean | null
          event_resent?: boolean | null
          event_sent?: boolean | null
          id?: string
          notification_browser?: boolean | null
          notification_sound?: boolean | null
          notification_toast?: boolean | null
          po_approved?: boolean | null
          po_rejected?: boolean | null
          po_sent?: boolean | null
          po_status_changed?: boolean | null
          po_submitted_for_approval?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_accepted?: boolean | null
          event_cancelled?: boolean | null
          event_expired?: boolean | null
          event_reminder_sent?: boolean | null
          event_resent?: boolean | null
          event_sent?: boolean | null
          id?: string
          notification_browser?: boolean | null
          notification_sound?: boolean | null
          notification_toast?: boolean | null
          po_approved?: boolean | null
          po_rejected?: boolean | null
          po_sent?: boolean | null
          po_status_changed?: boolean | null
          po_submitted_for_approval?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string
          everify_case_number: string | null
          everify_expiry: string | null
          everify_status: Database["public"]["Enums"]["everify_status"] | null
          everify_verified_at: string | null
          first_name: string
          hourly_rate: number | null
          i9_completed_at: string | null
          id: string
          id_document_url: string | null
          last_name: string
          notes: string | null
          personnel_number: string
          phone: string | null
          photo_url: string | null
          rating: number | null
          ssn_last_four: string | null
          state: string | null
          status: Database["public"]["Enums"]["personnel_status"] | null
          updated_at: string | null
          work_auth_expiry: string | null
          work_authorization_status: string | null
          work_authorization_type:
            | Database["public"]["Enums"]["work_auth_type"]
            | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email: string
          everify_case_number?: string | null
          everify_expiry?: string | null
          everify_status?: Database["public"]["Enums"]["everify_status"] | null
          everify_verified_at?: string | null
          first_name: string
          hourly_rate?: number | null
          i9_completed_at?: string | null
          id?: string
          id_document_url?: string | null
          last_name: string
          notes?: string | null
          personnel_number: string
          phone?: string | null
          photo_url?: string | null
          rating?: number | null
          ssn_last_four?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["personnel_status"] | null
          updated_at?: string | null
          work_auth_expiry?: string | null
          work_authorization_status?: string | null
          work_authorization_type?:
            | Database["public"]["Enums"]["work_auth_type"]
            | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string
          everify_case_number?: string | null
          everify_expiry?: string | null
          everify_status?: Database["public"]["Enums"]["everify_status"] | null
          everify_verified_at?: string | null
          first_name?: string
          hourly_rate?: number | null
          i9_completed_at?: string | null
          id?: string
          id_document_url?: string | null
          last_name?: string
          notes?: string | null
          personnel_number?: string
          phone?: string | null
          photo_url?: string | null
          rating?: number | null
          ssn_last_four?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["personnel_status"] | null
          updated_at?: string | null
          work_auth_expiry?: string | null
          work_authorization_status?: string | null
          work_authorization_type?:
            | Database["public"]["Enums"]["work_auth_type"]
            | null
          zip?: string | null
        }
        Relationships: []
      }
      personnel_capabilities: {
        Row: {
          capability: string
          created_at: string | null
          id: string
          personnel_id: string
          years_experience: number | null
        }
        Insert: {
          capability: string
          created_at?: string | null
          id?: string
          personnel_id: string
          years_experience?: number | null
        }
        Update: {
          capability?: string
          created_at?: string | null
          id?: string
          personnel_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_capabilities_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_certifications: {
        Row: {
          certificate_number: string | null
          certification_name: string
          created_at: string | null
          document_url: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_organization: string | null
          personnel_id: string
          updated_at: string | null
        }
        Insert: {
          certificate_number?: string | null
          certification_name: string
          created_at?: string | null
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          personnel_id: string
          updated_at?: string | null
        }
        Update: {
          certificate_number?: string | null
          certification_name?: string
          created_at?: string | null
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          personnel_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_certifications_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_languages: {
        Row: {
          created_at: string | null
          id: string
          language: string
          personnel_id: string
          proficiency: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          language: string
          personnel_id: string
          proficiency?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          language?: string
          personnel_id?: string
          proficiency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_languages_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      po_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          markup: number
          purchase_order_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          markup?: number
          purchase_order_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          markup?: number
          purchase_order_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "po_line_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          cost: number
          created_at: string
          description: string | null
          id: string
          markup: number
          name: string
          price: number
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          cost: number
          created_at?: string
          description?: string | null
          id?: string
          markup: number
          name: string
          price: number
          unit: string
          updated_at?: string
        }
        Update: {
          category?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          markup?: number
          name?: string
          price?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          hourly_rate: number | null
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          hourly_rate?: number | null
          id: string
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          hourly_rate?: number | null
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          id: string
          last_time_entry_at: string | null
          project_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          last_time_entry_at?: string | null
          project_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          last_time_entry_at?: string | null
          project_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          customer_id: string
          end_date: string | null
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          end_date?: string | null
          id?: string
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          customer_id: string
          customer_name: string
          due_date: string
          id: string
          job_order_id: string
          job_order_number: string
          notes: string | null
          number: string
          project_id: string
          project_name: string
          status: Database["public"]["Enums"]["purchase_order_status"]
          submitted_by: string | null
          submitted_for_approval_at: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
          vendor_id: string
          vendor_name: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_id: string
          customer_name: string
          due_date: string
          id?: string
          job_order_id: string
          job_order_number: string
          notes?: string | null
          number: string
          project_id: string
          project_name: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          submitted_by?: string | null
          submitted_for_approval_at?: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at?: string
          vendor_id: string
          vendor_name: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_id?: string
          customer_name?: string
          due_date?: string
          id?: string
          job_order_id?: string
          job_order_number?: string
          notes?: string | null
          number?: string
          project_id?: string
          project_name?: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          submitted_by?: string | null
          submitted_for_approval_at?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          vendor_id?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_job_order_id_fkey"
            columns: ["job_order_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          billable: boolean | null
          created_at: string
          description: string | null
          entry_date: string
          hours: number
          id: string
          invoice_id: string | null
          invoiced_at: string | null
          job_order_id: string | null
          overtime_hours: number | null
          project_id: string
          regular_hours: number | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billable?: boolean | null
          created_at?: string
          description?: string | null
          entry_date: string
          hours: number
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          job_order_id?: string | null
          overtime_hours?: number | null
          project_id: string
          regular_hours?: number | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billable?: boolean | null
          created_at?: string
          description?: string | null
          entry_date?: string
          hours?: number
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          job_order_id?: string | null
          overtime_hours?: number | null
          project_id?: string
          regular_hours?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_job_order_id_fkey"
            columns: ["job_order_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_documents: {
        Row: {
          created_at: string | null
          document_name: string
          document_type: string
          document_url: string
          expiry_date: string | null
          id: string
          uploaded_at: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          document_name: string
          document_type: string
          document_url: string
          expiry_date?: string | null
          id?: string
          uploaded_at?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          document_name?: string
          document_type?: string
          document_url?: string
          expiry_date?: string | null
          id?: string
          uploaded_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          insurance_expiry: string | null
          license_number: string | null
          name: string
          phone: string | null
          rating: number | null
          specialty: string | null
          status: Database["public"]["Enums"]["vendor_status"]
          updated_at: string
          w9_on_file: boolean | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          insurance_expiry?: string | null
          license_number?: string | null
          name: string
          phone?: string | null
          rating?: number | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["vendor_status"]
          updated_at?: string
          w9_on_file?: boolean | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          insurance_expiry?: string | null
          license_number?: string | null
          name?: string
          phone?: string | null
          rating?: number | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["vendor_status"]
          updated_at?: string
          w9_on_file?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      expire_old_invitations: { Args: never; Returns: undefined }
      generate_estimate_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_job_order_number: { Args: never; Returns: string }
      generate_personnel_number: { Args: never; Returns: string }
      generate_purchase_order_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user"
      customer_type:
        | "residential"
        | "commercial"
        | "government"
        | "non_profit"
        | "other"
      estimate_status: "draft" | "pending" | "approved" | "sent"
      everify_status:
        | "pending"
        | "verified"
        | "rejected"
        | "expired"
        | "not_required"
      invoice_status: "draft" | "sent" | "paid" | "overdue"
      job_order_status: "active" | "in-progress" | "completed" | "on-hold"
      personnel_status: "active" | "inactive" | "do_not_hire"
      project_status: "active" | "completed" | "on-hold"
      purchase_order_status:
        | "draft"
        | "pending_approval"
        | "sent"
        | "acknowledged"
        | "in-progress"
        | "completed"
        | "cancelled"
      vendor_status: "active" | "inactive"
      work_auth_type:
        | "citizen"
        | "permanent_resident"
        | "work_visa"
        | "ead"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "user"],
      customer_type: [
        "residential",
        "commercial",
        "government",
        "non_profit",
        "other",
      ],
      estimate_status: ["draft", "pending", "approved", "sent"],
      everify_status: [
        "pending",
        "verified",
        "rejected",
        "expired",
        "not_required",
      ],
      invoice_status: ["draft", "sent", "paid", "overdue"],
      job_order_status: ["active", "in-progress", "completed", "on-hold"],
      personnel_status: ["active", "inactive", "do_not_hire"],
      project_status: ["active", "completed", "on-hold"],
      purchase_order_status: [
        "draft",
        "pending_approval",
        "sent",
        "acknowledged",
        "in-progress",
        "completed",
        "cancelled",
      ],
      vendor_status: ["active", "inactive"],
      work_auth_type: [
        "citizen",
        "permanent_resident",
        "work_visa",
        "ead",
        "other",
      ],
    },
  },
} as const
