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
      activities: {
        Row: {
          activity_date: string
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at: string
          created_by: string
          customer_id: string
          description: string | null
          follow_up_date: string | null
          id: string
          priority: Database["public"]["Enums"]["activity_priority"] | null
          project_id: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          activity_date?: string
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          created_by: string
          customer_id: string
          description?: string | null
          follow_up_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["activity_priority"] | null
          project_id?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          activity_date?: string
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          created_by?: string
          customer_id?: string
          description?: string | null
          follow_up_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["activity_priority"] | null
          project_id?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          assigned_to: string | null
          created_at: string
          customer_id: string
          description: string | null
          end_time: string
          id: string
          location: string | null
          notes: string | null
          project_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at: string
        }
        Insert: {
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          assigned_to?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          end_time: string
          id?: string
          location?: string | null
          notes?: string | null
          project_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at?: string
        }
        Update: {
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          assigned_to?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          end_time?: string
          id?: string
          location?: string | null
          notes?: string | null
          project_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_removal_log: {
        Row: {
          assignment_id: string
          assignment_type: string
          created_at: string | null
          days_inactive: number | null
          id: string
          last_activity_at: string | null
          personnel_id: string | null
          project_id: string
          removed_at: string | null
          user_id: string | null
        }
        Insert: {
          assignment_id: string
          assignment_type: string
          created_at?: string | null
          days_inactive?: number | null
          id?: string
          last_activity_at?: string | null
          personnel_id?: string | null
          project_id: string
          removed_at?: string | null
          user_id?: string | null
        }
        Update: {
          assignment_id?: string
          assignment_type?: string
          created_at?: string | null
          days_inactive?: number | null
          id?: string
          last_activity_at?: string | null
          personnel_id?: string | null
          project_id?: string
          removed_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
          company_logo_url: string | null
          company_name: string | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          footer_color: string | null
          header_color: string | null
          id: string
          is_default: boolean | null
          label_color: string | null
          name: string
          name_color: string | null
          orientation: string | null
          personnel_number_color: string | null
          project_id: string | null
          show_capabilities: boolean | null
          show_certifications: boolean | null
          show_email: boolean | null
          show_everify_status: boolean | null
          show_languages: boolean | null
          show_personnel_number: boolean | null
          show_phone: boolean | null
          show_photo: boolean | null
          show_work_authorization: boolean | null
          template_name: string | null
          updated_at: string | null
          value_color: string | null
        }
        Insert: {
          background_color?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          footer_color?: string | null
          header_color?: string | null
          id?: string
          is_default?: boolean | null
          label_color?: string | null
          name: string
          name_color?: string | null
          orientation?: string | null
          personnel_number_color?: string | null
          project_id?: string | null
          show_capabilities?: boolean | null
          show_certifications?: boolean | null
          show_email?: boolean | null
          show_everify_status?: boolean | null
          show_languages?: boolean | null
          show_personnel_number?: boolean | null
          show_phone?: boolean | null
          show_photo?: boolean | null
          show_work_authorization?: boolean | null
          template_name?: string | null
          updated_at?: string | null
          value_color?: string | null
        }
        Update: {
          background_color?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          footer_color?: string | null
          header_color?: string | null
          id?: string
          is_default?: boolean | null
          label_color?: string | null
          name?: string
          name_color?: string | null
          orientation?: string | null
          personnel_number_color?: string | null
          project_id?: string | null
          show_capabilities?: boolean | null
          show_certifications?: boolean | null
          show_email?: boolean | null
          show_everify_status?: boolean | null
          show_languages?: boolean | null
          show_personnel_number?: boolean | null
          show_phone?: boolean | null
          show_photo?: boolean | null
          show_work_authorization?: boolean | null
          template_name?: string | null
          updated_at?: string | null
          value_color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "badge_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      change_order_line_items: {
        Row: {
          change_order_id: string
          created_at: string
          description: string
          id: string
          is_taxable: boolean | null
          markup: number
          product_id: string | null
          quantity: number
          sort_order: number | null
          total: number
          unit_price: number
        }
        Insert: {
          change_order_id: string
          created_at?: string
          description: string
          id?: string
          is_taxable?: boolean | null
          markup?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          total?: number
          unit_price?: number
        }
        Update: {
          change_order_id?: string
          created_at?: string
          description?: string
          id?: string
          is_taxable?: boolean | null
          markup?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "change_order_line_items_change_order_id_fkey"
            columns: ["change_order_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      change_order_vendor_bills: {
        Row: {
          change_order_id: string
          created_at: string
          id: string
          vendor_bill_id: string
        }
        Insert: {
          change_order_id: string
          created_at?: string
          id?: string
          vendor_bill_id: string
        }
        Update: {
          change_order_id?: string
          created_at?: string
          id?: string
          vendor_bill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_order_vendor_bills_change_order_id_fkey"
            columns: ["change_order_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_vendor_bills_vendor_bill_id_fkey"
            columns: ["vendor_bill_id"]
            isOneToOne: false
            referencedRelation: "vendor_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      change_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          customer_name: string
          description: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          job_order_id: string | null
          number: string
          project_id: string
          purchase_order_id: string | null
          reason: string
          status: Database["public"]["Enums"]["change_order_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_name: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          job_order_id?: string | null
          number: string
          project_id: string
          purchase_order_id?: string | null
          reason: string
          status?: Database["public"]["Enums"]["change_order_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_name?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          job_order_id?: string | null
          number?: string
          project_id?: string
          purchase_order_id?: string | null
          reason?: string
          status?: Database["public"]["Enums"]["change_order_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_job_order_id_fkey"
            columns: ["job_order_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
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
          holiday_multiplier: number | null
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
          holiday_multiplier?: number | null
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
          holiday_multiplier?: number | null
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
      contractor_form_configurations: {
        Row: {
          created_at: string | null
          fields: Json
          form_type: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fields?: Json
          form_type: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fields?: Json
          form_type?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contractor_submissions: {
        Row: {
          amount: number | null
          contractor_name: string
          created_at: string | null
          custom_fields: Json | null
          customer_name: string | null
          expense_description: string | null
          files: Json | null
          id: string
          job_name: string | null
          project_name: string | null
          submission_date: string
          submission_type: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          contractor_name: string
          created_at?: string | null
          custom_fields?: Json | null
          customer_name?: string | null
          expense_description?: string | null
          files?: Json | null
          id?: string
          job_name?: string | null
          project_name?: string | null
          submission_date?: string
          submission_type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          contractor_name?: string
          created_at?: string | null
          custom_fields?: Json | null
          customer_name?: string | null
          expense_description?: string | null
          files?: Json | null
          id?: string
          job_name?: string | null
          project_name?: string | null
          submission_date?: string
          submission_type?: string
          updated_at?: string | null
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
          jobsite_address: string | null
          name: string
          notes: string | null
          phone: string | null
          tax_exempt: boolean | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          email: string
          id?: string
          jobsite_address?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          tax_exempt?: boolean | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          email?: string
          id?: string
          jobsite_address?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          tax_exempt?: boolean | null
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
      estimate_attachments: {
        Row: {
          created_at: string | null
          estimate_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          estimate_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          estimate_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_attachments_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
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
          is_taxable: boolean | null
          markup: number
          pricing_type: string | null
          product_id: string | null
          quantity: number
          sort_order: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          estimate_id: string
          id?: string
          is_taxable?: boolean | null
          markup: number
          pricing_type?: string | null
          product_id?: string | null
          quantity: number
          sort_order?: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          estimate_id?: string
          id?: string
          is_taxable?: boolean | null
          markup?: number
          pricing_type?: string | null
          product_id?: string | null
          quantity?: number
          sort_order?: number
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
          created_by: string | null
          customer_approved: boolean | null
          customer_id: string
          customer_name: string
          default_pricing_type: string | null
          id: string
          jobsite_address: string | null
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
          created_by?: string | null
          customer_approved?: boolean | null
          customer_id: string
          customer_name: string
          default_pricing_type?: string | null
          id?: string
          jobsite_address?: string | null
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
          created_by?: string | null
          customer_approved?: boolean | null
          customer_id?: string
          customer_name?: string
          default_pricing_type?: string | null
          id?: string
          jobsite_address?: string | null
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
      expense_categories: {
        Row: {
          category_type: Database["public"]["Enums"]["expense_category_type"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category_type?: Database["public"]["Enums"]["expense_category_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category_type?: Database["public"]["Enums"]["expense_category_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurance_claims: {
        Row: {
          adjuster_email: string | null
          adjuster_name: string | null
          adjuster_phone: string | null
          adjuster_visit_date: string | null
          approved_amount: number | null
          claim_number: string | null
          created_at: string
          customer_id: string
          damage_description: string | null
          date_of_loss: string
          deductible: number | null
          documents: Json | null
          filed_date: string | null
          has_adjuster: boolean | null
          id: string
          insurance_company: string
          notes: string | null
          policy_number: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["claim_status"]
          updated_at: string
        }
        Insert: {
          adjuster_email?: string | null
          adjuster_name?: string | null
          adjuster_phone?: string | null
          adjuster_visit_date?: string | null
          approved_amount?: number | null
          claim_number?: string | null
          created_at?: string
          customer_id: string
          damage_description?: string | null
          date_of_loss: string
          deductible?: number | null
          documents?: Json | null
          filed_date?: string | null
          has_adjuster?: boolean | null
          id?: string
          insurance_company: string
          notes?: string | null
          policy_number?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
        }
        Update: {
          adjuster_email?: string | null
          adjuster_name?: string | null
          adjuster_phone?: string | null
          adjuster_visit_date?: string | null
          approved_amount?: number | null
          claim_number?: string | null
          created_at?: string
          customer_id?: string
          damage_description?: string | null
          date_of_loss?: string
          deductible?: number | null
          documents?: Json | null
          filed_date?: string | null
          has_adjuster?: boolean | null
          id?: string
          insurance_company?: string
          notes?: string | null
          policy_number?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_project_id_fkey"
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
          personnel_id: string | null
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
          personnel_id?: string | null
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
          personnel_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          invoice_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          invoice_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          invoice_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_attachments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          jo_line_item_id: string | null
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
          jo_line_item_id?: string | null
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
          jo_line_item_id?: string | null
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
          {
            foreignKeyName: "invoice_line_items_jo_line_item_id_fkey"
            columns: ["jo_line_item_id"]
            isOneToOne: false
            referencedRelation: "job_order_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          change_order_id: string | null
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
          change_order_id?: string | null
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
          change_order_id?: string | null
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
            foreignKeyName: "invoices_change_order_id_fkey"
            columns: ["change_order_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
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
          invoiced_quantity: number | null
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
          invoiced_quantity?: number | null
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
          invoiced_quantity?: number | null
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
      messages: {
        Row: {
          content: string
          created_at: string | null
          error_message: string | null
          external_id: string | null
          id: string
          message_type: string
          recipient_id: string
          recipient_name: string
          recipient_phone: string
          recipient_type: string
          sent_at: string | null
          sent_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          message_type?: string
          recipient_id: string
          recipient_name: string
          recipient_phone: string
          recipient_type: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          message_type?: string
          recipient_id?: string
          recipient_name?: string
          recipient_phone?: string
          recipient_type?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
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
          citizenship_status: string | null
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
          immigration_status: string | null
          last_name: string
          notes: string | null
          personnel_number: string
          phone: string | null
          photo_url: string | null
          rating: number | null
          ssn_full: string | null
          ssn_last_four: string | null
          state: string | null
          status: Database["public"]["Enums"]["personnel_status"] | null
          updated_at: string | null
          user_id: string | null
          vendor_id: string | null
          work_auth_expiry: string | null
          work_authorization_status: string | null
          work_authorization_type:
            | Database["public"]["Enums"]["work_auth_type"]
            | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          citizenship_status?: string | null
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
          immigration_status?: string | null
          last_name: string
          notes?: string | null
          personnel_number: string
          phone?: string | null
          photo_url?: string | null
          rating?: number | null
          ssn_full?: string | null
          ssn_last_four?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["personnel_status"] | null
          updated_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
          work_auth_expiry?: string | null
          work_authorization_status?: string | null
          work_authorization_type?:
            | Database["public"]["Enums"]["work_auth_type"]
            | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          citizenship_status?: string | null
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
          immigration_status?: string | null
          last_name?: string
          notes?: string | null
          personnel_number?: string
          phone?: string | null
          photo_url?: string | null
          rating?: number | null
          ssn_full?: string | null
          ssn_last_four?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["personnel_status"] | null
          updated_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
          work_auth_expiry?: string | null
          work_authorization_status?: string | null
          work_authorization_type?:
            | Database["public"]["Enums"]["work_auth_type"]
            | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
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
      personnel_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          personnel_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          personnel_id: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          personnel_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_invitations_personnel_id_fkey"
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
      personnel_notification_preferences: {
        Row: {
          assignment_notifications: boolean | null
          created_at: string | null
          email_notifications: boolean | null
          id: string
          job_alerts: boolean | null
          pay_notifications: boolean | null
          personnel_id: string
          sms_notifications: boolean | null
          updated_at: string | null
        }
        Insert: {
          assignment_notifications?: boolean | null
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          job_alerts?: boolean | null
          pay_notifications?: boolean | null
          personnel_id: string
          sms_notifications?: boolean | null
          updated_at?: string | null
        }
        Update: {
          assignment_notifications?: boolean | null
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          job_alerts?: boolean | null
          pay_notifications?: boolean | null
          personnel_id?: string
          sms_notifications?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_notification_preferences_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: true
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          notification_type: string
          personnel_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          notification_type?: string
          personnel_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          notification_type?: string
          personnel_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_notifications_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_id: string
          project_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_id: string
          project_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "personnel_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_payment_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_payments: {
        Row: {
          category_id: string | null
          created_at: string
          gross_amount: number
          id: string
          notes: string | null
          number: string
          payment_date: string
          payment_type: Database["public"]["Enums"]["personnel_payment_type"]
          personnel_id: string
          personnel_name: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          gross_amount: number
          id?: string
          notes?: string | null
          number: string
          payment_date: string
          payment_type?: Database["public"]["Enums"]["personnel_payment_type"]
          personnel_id: string
          personnel_name: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          gross_amount?: number
          id?: string
          notes?: string | null
          number?: string
          payment_date?: string
          payment_type?: Database["public"]["Enums"]["personnel_payment_type"]
          personnel_id?: string
          personnel_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_payments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_payments_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_project_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string | null
          id: string
          last_time_entry_at: string | null
          personnel_id: string
          project_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          last_time_entry_at?: string | null
          personnel_id: string
          project_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          last_time_entry_at?: string | null
          personnel_id?: string
          project_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_project_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_project_assignments_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_registration_invites: {
        Row: {
          completed_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          first_name: string | null
          id: string
          invited_by: string
          last_name: string | null
          status: string
          token: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by: string
          last_name?: string | null
          status?: string
          token?: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by?: string
          last_name?: string | null
          status?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      personnel_registrations: {
        Row: {
          address: string | null
          citizenship_status: string | null
          city: string | null
          created_at: string | null
          date_of_birth: string | null
          documents: Json | null
          email: string
          emergency_contacts: Json | null
          first_name: string
          id: string
          immigration_status: string | null
          last_name: string
          phone: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          ssn_full: string | null
          ssn_last_four: string | null
          state: string | null
          status: string
          updated_at: string | null
          work_auth_expiry: string | null
          work_authorization_type: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          citizenship_status?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          documents?: Json | null
          email: string
          emergency_contacts?: Json | null
          first_name: string
          id?: string
          immigration_status?: string | null
          last_name: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          ssn_full?: string | null
          ssn_last_four?: string | null
          state?: string | null
          status?: string
          updated_at?: string | null
          work_auth_expiry?: string | null
          work_authorization_type?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          citizenship_status?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          documents?: Json | null
          email?: string
          emergency_contacts?: Json | null
          first_name?: string
          id?: string
          immigration_status?: string | null
          last_name?: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          ssn_full?: string | null
          ssn_last_four?: string | null
          state?: string | null
          status?: string
          updated_at?: string | null
          work_auth_expiry?: string | null
          work_authorization_type?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      po_addendum_line_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          markup: number
          po_addendum_id: string
          product_id: string | null
          quantity: number
          sort_order: number | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          markup?: number
          po_addendum_id: string
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          markup?: number
          po_addendum_id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "po_addendum_line_items_po_addendum_id_fkey"
            columns: ["po_addendum_id"]
            isOneToOne: false
            referencedRelation: "po_addendums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_addendum_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      po_addendums: {
        Row: {
          amount: number
          approval_notes: string | null
          approval_signature: string | null
          approval_status: string | null
          approval_token: string | null
          approved_at: string | null
          approved_by_name: string | null
          created_at: string | null
          customer_rep_email: string | null
          customer_rep_name: string | null
          customer_rep_title: string | null
          description: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          number: string | null
          purchase_order_id: string
          sent_for_approval_at: string | null
          subtotal: number | null
          uploaded_by: string | null
        }
        Insert: {
          amount?: number
          approval_notes?: string | null
          approval_signature?: string | null
          approval_status?: string | null
          approval_token?: string | null
          approved_at?: string | null
          approved_by_name?: string | null
          created_at?: string | null
          customer_rep_email?: string | null
          customer_rep_name?: string | null
          customer_rep_title?: string | null
          description: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          number?: string | null
          purchase_order_id: string
          sent_for_approval_at?: string | null
          subtotal?: number | null
          uploaded_by?: string | null
        }
        Update: {
          amount?: number
          approval_notes?: string | null
          approval_signature?: string | null
          approval_status?: string | null
          approval_token?: string | null
          approved_at?: string | null
          approved_by_name?: string | null
          created_at?: string | null
          customer_rep_email?: string | null
          customer_rep_name?: string | null
          customer_rep_title?: string | null
          description?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          number?: string | null
          purchase_order_id?: string
          sent_for_approval_at?: string | null
          subtotal?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_addendums_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_line_items: {
        Row: {
          billed_quantity: number | null
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
          billed_quantity?: number | null
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
          billed_quantity?: number | null
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
      product_categories: {
        Row: {
          created_at: string | null
          id: string
          item_type: Database["public"]["Enums"]["item_type"]
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_units: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          cost: number
          created_at: string
          description: string | null
          id: string
          is_taxable: boolean | null
          item_type: Database["public"]["Enums"]["item_type"]
          markup: number
          name: string
          price: number
          sku: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          cost: number
          created_at?: string
          description?: string | null
          id?: string
          is_taxable?: boolean | null
          item_type?: Database["public"]["Enums"]["item_type"]
          markup: number
          name: string
          price: number
          sku?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          category?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          is_taxable?: boolean | null
          item_type?: Database["public"]["Enums"]["item_type"]
          markup?: number
          name?: string
          price?: number
          sku?: string | null
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
          total_cost: number
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
          total_cost?: number
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
          total_cost?: number
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
          billed_amount: number | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          customer_id: string
          customer_name: string
          due_date: string
          id: string
          is_closed: boolean | null
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
          total_addendum_amount: number
          updated_at: string
          vendor_id: string
          vendor_name: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          billed_amount?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          customer_id: string
          customer_name: string
          due_date: string
          id?: string
          is_closed?: boolean | null
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
          total_addendum_amount?: number
          updated_at?: string
          vendor_id: string
          vendor_name: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          billed_amount?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          customer_id?: string
          customer_name?: string
          due_date?: string
          id?: string
          is_closed?: boolean | null
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
          total_addendum_amount?: number
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
      quickbooks_bill_mappings: {
        Row: {
          bill_id: string
          created_at: string | null
          error_message: string | null
          id: string
          last_synced_at: string | null
          quickbooks_bill_id: string
          quickbooks_doc_number: string | null
          sync_status: string
          updated_at: string | null
        }
        Insert: {
          bill_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          quickbooks_bill_id: string
          quickbooks_doc_number?: string | null
          sync_status?: string
          updated_at?: string | null
        }
        Update: {
          bill_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          quickbooks_bill_id?: string
          quickbooks_doc_number?: string | null
          sync_status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_bill_mappings_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: true
            referencedRelation: "vendor_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_config: {
        Row: {
          access_token: string | null
          company_name: string | null
          created_at: string | null
          id: string
          is_connected: boolean | null
          last_sync_at: string | null
          realm_id: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          company_name?: string | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          last_sync_at?: string | null
          realm_id?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          company_name?: string | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          last_sync_at?: string | null
          realm_id?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quickbooks_customer_mappings: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          last_synced_at: string | null
          quickbooks_customer_id: string
          sync_status:
            | Database["public"]["Enums"]["quickbooks_sync_status"]
            | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          last_synced_at?: string | null
          quickbooks_customer_id: string
          sync_status?:
            | Database["public"]["Enums"]["quickbooks_sync_status"]
            | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          last_synced_at?: string | null
          quickbooks_customer_id?: string
          sync_status?:
            | Database["public"]["Enums"]["quickbooks_sync_status"]
            | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_customer_mappings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_estimate_mappings: {
        Row: {
          created_at: string
          estimate_id: string
          id: string
          last_synced_at: string | null
          quickbooks_estimate_id: string
          sync_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estimate_id: string
          id?: string
          last_synced_at?: string | null
          quickbooks_estimate_id: string
          sync_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estimate_id?: string
          id?: string
          last_synced_at?: string | null
          quickbooks_estimate_id?: string
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_estimate_mappings_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: true
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_invoice_mappings: {
        Row: {
          created_at: string | null
          id: string
          invoice_id: string
          quickbooks_doc_number: string | null
          quickbooks_invoice_id: string
          sync_status:
            | Database["public"]["Enums"]["quickbooks_sync_status"]
            | null
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_id: string
          quickbooks_doc_number?: string | null
          quickbooks_invoice_id: string
          sync_status?:
            | Database["public"]["Enums"]["quickbooks_sync_status"]
            | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_id?: string
          quickbooks_doc_number?: string | null
          quickbooks_invoice_id?: string
          sync_status?:
            | Database["public"]["Enums"]["quickbooks_sync_status"]
            | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_invoice_mappings_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_po_mappings: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string | null
          purchase_order_id: string
          quickbooks_po_id: string
          sync_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          purchase_order_id: string
          quickbooks_po_id: string
          sync_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          purchase_order_id?: string
          quickbooks_po_id?: string
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_po_mappings_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: true
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_product_mappings: {
        Row: {
          conflict_data: Json | null
          created_at: string | null
          id: string
          last_synced_at: string | null
          product_id: string
          quickbooks_item_id: string
          sync_direction: string | null
          sync_status:
            | Database["public"]["Enums"]["quickbooks_sync_status"]
            | null
          updated_at: string | null
        }
        Insert: {
          conflict_data?: Json | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          product_id: string
          quickbooks_item_id: string
          sync_direction?: string | null
          sync_status?:
            | Database["public"]["Enums"]["quickbooks_sync_status"]
            | null
          updated_at?: string | null
        }
        Update: {
          conflict_data?: Json | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          product_id?: string
          quickbooks_item_id?: string
          sync_direction?: string | null
          sync_status?:
            | Database["public"]["Enums"]["quickbooks_sync_status"]
            | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_sync_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          quickbooks_id: string | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          quickbooks_id?: string | null
          status: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          quickbooks_id?: string | null
          status?: string
        }
        Relationships: []
      }
      quickbooks_sync_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          error_message: string | null
          id: string
          records_synced: number | null
          status: string
          sync_type: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          records_synced?: number | null
          status: string
          sync_type: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          records_synced?: number | null
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      quickbooks_vendor_mappings: {
        Row: {
          conflict_data: Json | null
          created_at: string | null
          id: string
          last_synced_at: string | null
          quickbooks_vendor_id: string
          sync_direction: string | null
          sync_status: string
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          conflict_data?: Json | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          quickbooks_vendor_id: string
          sync_direction?: string | null
          sync_status?: string
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          conflict_data?: Json | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          quickbooks_vendor_id?: string
          sync_direction?: string | null
          sync_status?: string
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_vendor_mappings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursements: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          description: string
          id: string
          notes: string | null
          paid_at: string | null
          personnel_id: string
          project_id: string | null
          receipt_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string | null
          description: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          personnel_id: string
          project_id?: string | null
          receipt_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          personnel_id?: string
          project_id?: string | null
          receipt_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reimbursements_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      roof_inspections: {
        Row: {
          created_at: string | null
          customer_id: string
          findings: Json | null
          id: string
          inspection_date: string
          inspection_type: Database["public"]["Enums"]["inspection_type"]
          inspector_id: string | null
          notes: string | null
          overall_condition:
            | Database["public"]["Enums"]["roof_condition"]
            | null
          photos: Json | null
          project_id: string | null
          recommendations: string | null
          status: Database["public"]["Enums"]["inspection_status"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          findings?: Json | null
          id?: string
          inspection_date: string
          inspection_type?: Database["public"]["Enums"]["inspection_type"]
          inspector_id?: string | null
          notes?: string | null
          overall_condition?:
            | Database["public"]["Enums"]["roof_condition"]
            | null
          photos?: Json | null
          project_id?: string | null
          recommendations?: string | null
          status?: Database["public"]["Enums"]["inspection_status"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          findings?: Json | null
          id?: string
          inspection_date?: string
          inspection_type?: Database["public"]["Enums"]["inspection_type"]
          inspector_id?: string | null
          notes?: string | null
          overall_condition?:
            | Database["public"]["Enums"]["roof_condition"]
            | null
          photos?: Json | null
          project_id?: string | null
          recommendations?: string | null
          status?: Database["public"]["Enums"]["inspection_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roof_inspections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roof_inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roof_inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      roof_measurements: {
        Row: {
          areas: Json | null
          created_at: string | null
          customer_id: string
          eaves_length: number | null
          hips_length: number | null
          id: string
          measurement_date: string
          notes: string | null
          parapet_wall_length: number | null
          penetrations: Json | null
          pitch: string | null
          project_id: string | null
          rakes_length: number | null
          ridges_length: number | null
          roof_type: Database["public"]["Enums"]["roof_type"] | null
          step_flashing_length: number | null
          total_facets: number | null
          total_flat_area: number | null
          total_pitched_area: number | null
          total_roof_area: number | null
          total_squares: number | null
          transitions_length: number | null
          unspecified_length: number | null
          updated_at: string | null
          valleys_length: number | null
          wall_flashing_length: number | null
        }
        Insert: {
          areas?: Json | null
          created_at?: string | null
          customer_id: string
          eaves_length?: number | null
          hips_length?: number | null
          id?: string
          measurement_date?: string
          notes?: string | null
          parapet_wall_length?: number | null
          penetrations?: Json | null
          pitch?: string | null
          project_id?: string | null
          rakes_length?: number | null
          ridges_length?: number | null
          roof_type?: Database["public"]["Enums"]["roof_type"] | null
          step_flashing_length?: number | null
          total_facets?: number | null
          total_flat_area?: number | null
          total_pitched_area?: number | null
          total_roof_area?: number | null
          total_squares?: number | null
          transitions_length?: number | null
          unspecified_length?: number | null
          updated_at?: string | null
          valleys_length?: number | null
          wall_flashing_length?: number | null
        }
        Update: {
          areas?: Json | null
          created_at?: string | null
          customer_id?: string
          eaves_length?: number | null
          hips_length?: number | null
          id?: string
          measurement_date?: string
          notes?: string | null
          parapet_wall_length?: number | null
          penetrations?: Json | null
          pitch?: string | null
          project_id?: string | null
          rakes_length?: number | null
          ridges_length?: number | null
          roof_type?: Database["public"]["Enums"]["roof_type"] | null
          step_flashing_length?: number | null
          total_facets?: number | null
          total_flat_area?: number | null
          total_pitched_area?: number | null
          total_roof_area?: number | null
          total_squares?: number | null
          transitions_length?: number | null
          unspecified_length?: number | null
          updated_at?: string | null
          valleys_length?: number | null
          wall_flashing_length?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roof_measurements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roof_measurements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      roof_warranties: {
        Row: {
          coverage_details: string | null
          created_at: string | null
          customer_id: string
          documents: Json | null
          end_date: string
          id: string
          notifications_enabled: boolean | null
          project_id: string | null
          provider: string
          start_date: string
          status: Database["public"]["Enums"]["warranty_status"]
          updated_at: string | null
          warranty_number: string | null
          warranty_type: Database["public"]["Enums"]["warranty_type"]
        }
        Insert: {
          coverage_details?: string | null
          created_at?: string | null
          customer_id: string
          documents?: Json | null
          end_date: string
          id?: string
          notifications_enabled?: boolean | null
          project_id?: string | null
          provider: string
          start_date: string
          status?: Database["public"]["Enums"]["warranty_status"]
          updated_at?: string | null
          warranty_number?: string | null
          warranty_type?: Database["public"]["Enums"]["warranty_type"]
        }
        Update: {
          coverage_details?: string | null
          created_at?: string | null
          customer_id?: string
          documents?: Json | null
          end_date?: string
          id?: string
          notifications_enabled?: boolean | null
          project_id?: string | null
          provider?: string
          start_date?: string
          status?: Database["public"]["Enums"]["warranty_status"]
          updated_at?: string | null
          warranty_number?: string | null
          warranty_type?: Database["public"]["Enums"]["warranty_type"]
        }
        Relationships: [
          {
            foreignKeyName: "roof_warranties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roof_warranties_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          is_holiday: boolean | null
          job_order_id: string | null
          overtime_hours: number | null
          personnel_id: string | null
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
          is_holiday?: boolean | null
          job_order_id?: string | null
          overtime_hours?: number | null
          personnel_id?: string | null
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
          is_holiday?: boolean | null
          job_order_id?: string | null
          overtime_hours?: number | null
          personnel_id?: string | null
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
            foreignKeyName: "time_entries_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
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
      user_permissions: {
        Row: {
          can_add: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          module: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_add?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_add?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      vendor_bill_attachments: {
        Row: {
          bill_id: string
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          bill_id: string
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          bill_id?: string
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bill_attachments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "vendor_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_bill_line_items: {
        Row: {
          bill_id: string
          category_id: string | null
          created_at: string
          description: string
          id: string
          po_line_item_id: string | null
          project_id: string | null
          quantity: number
          total: number
          unit_cost: number
        }
        Insert: {
          bill_id: string
          category_id?: string | null
          created_at?: string
          description: string
          id?: string
          po_line_item_id?: string | null
          project_id?: string | null
          quantity?: number
          total?: number
          unit_cost?: number
        }
        Update: {
          bill_id?: string
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          po_line_item_id?: string | null
          project_id?: string | null
          quantity?: number
          total?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bill_line_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "vendor_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bill_line_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bill_line_items_po_line_item_id_fkey"
            columns: ["po_line_item_id"]
            isOneToOne: false
            referencedRelation: "po_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bill_line_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_bill_payments: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          reference_number: string | null
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date: string
          payment_method?: string
          reference_number?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bill_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "vendor_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_bills: {
        Row: {
          bill_date: string
          created_at: string
          due_date: string
          id: string
          notes: string | null
          number: string
          paid_amount: number
          purchase_order_id: string | null
          purchase_order_number: string | null
          remaining_amount: number
          status: Database["public"]["Enums"]["vendor_bill_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
          vendor_id: string
          vendor_name: string
        }
        Insert: {
          bill_date: string
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          number: string
          paid_amount?: number
          purchase_order_id?: string | null
          purchase_order_number?: string | null
          remaining_amount?: number
          status?: Database["public"]["Enums"]["vendor_bill_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          vendor_id: string
          vendor_name: string
        }
        Update: {
          bill_date?: string
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          number?: string
          paid_amount?: number
          purchase_order_id?: string | null
          purchase_order_number?: string | null
          remaining_amount?: number
          status?: Database["public"]["Enums"]["vendor_bill_status"]
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
            foreignKeyName: "vendor_bills_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
          account_number: string | null
          address: string | null
          billing_rate: number | null
          city: string | null
          company: string | null
          created_at: string
          default_expense_category_id: string | null
          email: string
          id: string
          insurance_expiry: string | null
          license_number: string | null
          name: string
          notes: string | null
          opening_balance: number | null
          payment_terms: string | null
          phone: string | null
          rating: number | null
          specialty: string | null
          state: string | null
          status: Database["public"]["Enums"]["vendor_status"]
          tax_id: string | null
          track_1099: boolean | null
          updated_at: string
          vendor_type: Database["public"]["Enums"]["vendor_type"]
          w9_on_file: boolean | null
          zip: string | null
        }
        Insert: {
          account_number?: string | null
          address?: string | null
          billing_rate?: number | null
          city?: string | null
          company?: string | null
          created_at?: string
          default_expense_category_id?: string | null
          email: string
          id?: string
          insurance_expiry?: string | null
          license_number?: string | null
          name: string
          notes?: string | null
          opening_balance?: number | null
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
          specialty?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["vendor_status"]
          tax_id?: string | null
          track_1099?: boolean | null
          updated_at?: string
          vendor_type?: Database["public"]["Enums"]["vendor_type"]
          w9_on_file?: boolean | null
          zip?: string | null
        }
        Update: {
          account_number?: string | null
          address?: string | null
          billing_rate?: number | null
          city?: string | null
          company?: string | null
          created_at?: string
          default_expense_category_id?: string | null
          email?: string
          id?: string
          insurance_expiry?: string | null
          license_number?: string | null
          name?: string
          notes?: string | null
          opening_balance?: number | null
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
          specialty?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["vendor_status"]
          tax_id?: string | null
          track_1099?: boolean | null
          updated_at?: string
          vendor_type?: Database["public"]["Enums"]["vendor_type"]
          w9_on_file?: boolean | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_default_expense_category_id_fkey"
            columns: ["default_expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_logs: {
        Row: {
          conditions: string | null
          created_at: string | null
          id: string
          location: string
          log_date: string
          notes: string | null
          precipitation: number | null
          project_id: string | null
          temperature_high: number | null
          temperature_low: number | null
          wind_speed: number | null
          work_suitable: boolean | null
        }
        Insert: {
          conditions?: string | null
          created_at?: string | null
          id?: string
          location: string
          log_date?: string
          notes?: string | null
          precipitation?: number | null
          project_id?: string | null
          temperature_high?: number | null
          temperature_low?: number | null
          wind_speed?: number | null
          work_suitable?: boolean | null
        }
        Update: {
          conditions?: string | null
          created_at?: string | null
          id?: string
          location?: string
          log_date?: string
          notes?: string | null
          precipitation?: number | null
          project_id?: string | null
          temperature_high?: number | null
          temperature_low?: number | null
          wind_speed?: number | null
          work_suitable?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { _invitation_id: string; _user_id: string }
        Returns: Json
      }
      expire_old_invitations: { Args: never; Returns: undefined }
      generate_change_order_number: {
        Args: { p_project_id: string }
        Returns: string
      }
      generate_estimate_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_job_order_number: { Args: never; Returns: string }
      generate_personnel_number: { Args: never; Returns: string }
      generate_personnel_payment_number: { Args: never; Returns: string }
      generate_po_addendum_number: {
        Args: { p_purchase_order_id: string }
        Returns: string
      }
      generate_purchase_order_number: { Args: never; Returns: string }
      generate_vendor_bill_number: { Args: never; Returns: string }
      get_personnel_id_for_user: { Args: { _user_id: string }; Returns: string }
      has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_personnel: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      activity_priority: "low" | "medium" | "high" | "urgent"
      activity_type:
        | "call"
        | "email"
        | "meeting"
        | "note"
        | "site_visit"
        | "follow_up"
      app_role: "admin" | "manager" | "user" | "personnel"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      appointment_type:
        | "inspection"
        | "estimate"
        | "installation"
        | "follow_up"
        | "consultation"
        | "warranty_service"
      change_order_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "invoiced"
      claim_status:
        | "filed"
        | "pending_adjuster"
        | "adjuster_scheduled"
        | "approved"
        | "denied"
        | "in_progress"
        | "completed"
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
      expense_category_type: "vendor" | "personnel" | "both"
      inspection_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      inspection_type:
        | "initial"
        | "progress"
        | "final"
        | "warranty"
        | "storm_damage"
      invoice_status: "draft" | "sent" | "paid" | "overdue"
      item_type: "product" | "service" | "labor"
      job_order_status: "active" | "in-progress" | "completed" | "on-hold"
      personnel_payment_type: "regular" | "bonus" | "reimbursement" | "advance"
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
        | "partially_billed"
        | "fully_billed"
        | "closed"
      quickbooks_sync_status: "synced" | "pending" | "conflict" | "error"
      roof_condition: "excellent" | "good" | "fair" | "poor" | "critical"
      roof_type:
        | "gable"
        | "hip"
        | "flat"
        | "mansard"
        | "gambrel"
        | "shed"
        | "combination"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
      vendor_bill_status: "draft" | "open" | "paid" | "partially_paid" | "void"
      vendor_status: "active" | "inactive"
      vendor_type: "contractor" | "personnel" | "supplier"
      warranty_status: "active" | "expired" | "claimed" | "voided"
      warranty_type: "manufacturer" | "workmanship" | "extended"
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
      activity_priority: ["low", "medium", "high", "urgent"],
      activity_type: [
        "call",
        "email",
        "meeting",
        "note",
        "site_visit",
        "follow_up",
      ],
      app_role: ["admin", "manager", "user", "personnel"],
      appointment_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      appointment_type: [
        "inspection",
        "estimate",
        "installation",
        "follow_up",
        "consultation",
        "warranty_service",
      ],
      change_order_status: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "invoiced",
      ],
      claim_status: [
        "filed",
        "pending_adjuster",
        "adjuster_scheduled",
        "approved",
        "denied",
        "in_progress",
        "completed",
      ],
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
      expense_category_type: ["vendor", "personnel", "both"],
      inspection_status: ["scheduled", "in_progress", "completed", "cancelled"],
      inspection_type: [
        "initial",
        "progress",
        "final",
        "warranty",
        "storm_damage",
      ],
      invoice_status: ["draft", "sent", "paid", "overdue"],
      item_type: ["product", "service", "labor"],
      job_order_status: ["active", "in-progress", "completed", "on-hold"],
      personnel_payment_type: ["regular", "bonus", "reimbursement", "advance"],
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
        "partially_billed",
        "fully_billed",
        "closed",
      ],
      quickbooks_sync_status: ["synced", "pending", "conflict", "error"],
      roof_condition: ["excellent", "good", "fair", "poor", "critical"],
      roof_type: [
        "gable",
        "hip",
        "flat",
        "mansard",
        "gambrel",
        "shed",
        "combination",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
      vendor_bill_status: ["draft", "open", "paid", "partially_paid", "void"],
      vendor_status: ["active", "inactive"],
      vendor_type: ["contractor", "personnel", "supplier"],
      warranty_status: ["active", "expired", "claimed", "voided"],
      warranty_type: ["manufacturer", "workmanship", "extended"],
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
