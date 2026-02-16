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
      admin_notifications: {
        Row: {
          count: number | null
          created_at: string | null
          escalated_at: string | null
          escalation_count: number | null
          group_key: string | null
          id: string
          is_read: boolean
          link_url: string | null
          message: string
          metadata: Json | null
          notification_type: string
          priority: string | null
          related_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          escalated_at?: string | null
          escalation_count?: number | null
          group_key?: string | null
          id?: string
          is_read?: boolean
          link_url?: string | null
          message: string
          metadata?: Json | null
          notification_type?: string
          priority?: string | null
          related_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          count?: number | null
          created_at?: string | null
          escalated_at?: string | null
          escalation_count?: number | null
          group_key?: string | null
          id?: string
          is_read?: boolean
          link_url?: string | null
          message?: string
          metadata?: Json | null
          notification_type?: string
          priority?: string | null
          related_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_dev_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_dev_messages: {
        Row: {
          content: string
          context: Json | null
          conversation_id: string
          created_at: string | null
          id: string
          response_data: Json | null
          role: string
        }
        Insert: {
          content: string
          context?: Json | null
          conversation_id: string
          created_at?: string | null
          id?: string
          response_data?: Json | null
          role: string
        }
        Update: {
          content?: string
          context?: Json | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          response_data?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_dev_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_dev_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      applicants: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string
          first_name: string
          geocode_source: string | null
          geocoded_at: string | null
          home_lat: number | null
          home_lng: number | null
          home_zip: string | null
          id: string
          is_geocodable: boolean | null
          last_name: string
          phone: string | null
          photo_url: string | null
          state: string | null
          status: Database["public"]["Enums"]["applicant_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email: string
          first_name: string
          geocode_source?: string | null
          geocoded_at?: string | null
          home_lat?: number | null
          home_lng?: number | null
          home_zip?: string | null
          id?: string
          is_geocodable?: boolean | null
          last_name: string
          phone?: string | null
          photo_url?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["applicant_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string
          first_name?: string
          geocode_source?: string | null
          geocoded_at?: string | null
          home_lat?: number | null
          home_lng?: number | null
          home_zip?: string | null
          id?: string
          is_geocodable?: boolean | null
          last_name?: string
          phone?: string | null
          photo_url?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["applicant_status"]
          updated_at?: string
        }
        Relationships: []
      }
      application_form_templates: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          is_draft: boolean | null
          layout: Json | null
          name: string
          published_at: string | null
          published_version: number | null
          settings: Json | null
          success_message: string | null
          theme: Json | null
          updated_at: string
          version: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          is_draft?: boolean | null
          layout?: Json | null
          name: string
          published_at?: string | null
          published_version?: number | null
          settings?: Json | null
          success_message?: string | null
          theme?: Json | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          is_draft?: boolean | null
          layout?: Json | null
          name?: string
          published_at?: string | null
          published_version?: number | null
          settings?: Json | null
          success_message?: string | null
          theme?: Json | null
          updated_at?: string
          version?: number | null
        }
        Relationships: []
      }
      application_notes: {
        Row: {
          application_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_revisions: {
        Row: {
          application_id: string
          changed_by: string | null
          changed_fields: Json | null
          created_at: string | null
          id: string
          previous_answers: Json | null
          previous_applicant_data: Json | null
          revision_number: number
        }
        Insert: {
          application_id: string
          changed_by?: string | null
          changed_fields?: Json | null
          created_at?: string | null
          id?: string
          previous_answers?: Json | null
          previous_applicant_data?: Json | null
          revision_number?: number
        }
        Update: {
          application_id?: string
          changed_by?: string | null
          changed_fields?: Json | null
          created_at?: string | null
          id?: string
          previous_answers?: Json | null
          previous_applicant_data?: Json | null
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "application_revisions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          admin_message: string | null
          answers: Json | null
          applicant_id: string
          client_submitted_at: string | null
          contacted_at: string | null
          contacted_by: string | null
          created_at: string
          edit_token: string | null
          edit_token_expires_at: string | null
          form_version: number | null
          geo_accuracy: number | null
          geo_captured_at: string | null
          geo_error: string | null
          geo_lat: number | null
          geo_lng: number | null
          geo_source: string | null
          id: string
          job_posting_id: string
          missing_fields: Json | null
          notes: string | null
          sms_confirmation_sent_at: string | null
          sms_consent: boolean | null
          sms_consent_at: string | null
          sms_consent_ip: string | null
          sms_consent_method: string | null
          sms_consent_phone: string | null
          sms_consent_text_version: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          submitted_by_user_id: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_message?: string | null
          answers?: Json | null
          applicant_id: string
          client_submitted_at?: string | null
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string
          edit_token?: string | null
          edit_token_expires_at?: string | null
          form_version?: number | null
          geo_accuracy?: number | null
          geo_captured_at?: string | null
          geo_error?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          geo_source?: string | null
          id?: string
          job_posting_id: string
          missing_fields?: Json | null
          notes?: string | null
          sms_confirmation_sent_at?: string | null
          sms_consent?: boolean | null
          sms_consent_at?: string | null
          sms_consent_ip?: string | null
          sms_consent_method?: string | null
          sms_consent_phone?: string | null
          sms_consent_text_version?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_message?: string | null
          answers?: Json | null
          applicant_id?: string
          client_submitted_at?: string | null
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string
          edit_token?: string | null
          edit_token_expires_at?: string | null
          form_version?: number | null
          geo_accuracy?: number | null
          geo_captured_at?: string | null
          geo_error?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          geo_source?: string | null
          id?: string
          job_posting_id?: string
          missing_fields?: Json | null
          notes?: string | null
          sms_confirmation_sent_at?: string | null
          sms_consent?: boolean | null
          sms_consent_at?: string | null
          sms_consent_ip?: string | null
          sms_consent_method?: string | null
          sms_consent_phone?: string | null
          sms_consent_text_version?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
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
      asset_assignments: {
        Row: {
          asset_id: string
          assigned_by: string | null
          assigned_to_personnel_id: string | null
          created_at: string | null
          end_at: string | null
          id: string
          notes: string | null
          project_id: string
          start_at: string
          status: string
          unassigned_at: string | null
          unassigned_by: string | null
          unassigned_notes: string | null
          unassigned_reason: string | null
          updated_at: string | null
        }
        Insert: {
          asset_id: string
          assigned_by?: string | null
          assigned_to_personnel_id?: string | null
          created_at?: string | null
          end_at?: string | null
          id?: string
          notes?: string | null
          project_id: string
          start_at?: string
          status?: string
          unassigned_at?: string | null
          unassigned_by?: string | null
          unassigned_notes?: string | null
          unassigned_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_id?: string
          assigned_by?: string | null
          assigned_to_personnel_id?: string | null
          created_at?: string | null
          end_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          start_at?: string
          status?: string
          unassigned_at?: string | null
          unassigned_by?: string | null
          unassigned_notes?: string | null
          unassigned_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_assigned_to_personnel_id_fkey"
            columns: ["assigned_to_personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          access_instructions: string | null
          address: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          gate_code: string | null
          id: string
          instructions: string | null
          label: string
          metadata: Json | null
          operating_hours: string | null
          serial_number: string | null
          status: string
          type: string
          updated_at: string | null
        }
        Insert: {
          access_instructions?: string | null
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          gate_code?: string | null
          id?: string
          instructions?: string | null
          label: string
          metadata?: Json | null
          operating_hours?: string | null
          serial_number?: string | null
          status?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          access_instructions?: string | null
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          gate_code?: string | null
          id?: string
          instructions?: string | null
          label?: string
          metadata?: Json | null
          operating_hours?: string | null
          serial_number?: string | null
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
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
      audit_logs: {
        Row: {
          action_type: string
          changes_after: Json | null
          changes_before: Json | null
          created_at: string
          error_message: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string | null
          resource_number: string | null
          resource_type: string
          success: boolean
          user_agent: string | null
          user_email: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          changes_after?: Json | null
          changes_before?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_number?: string | null
          resource_type: string
          success?: boolean
          user_agent?: string | null
          user_email: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          changes_after?: Json | null
          changes_before?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_number?: string | null
          resource_type?: string
          success?: boolean
          user_agent?: string | null
          user_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          original_scope_description: string | null
          product_id: string | null
          quantity: number
          sort_order: number | null
          total: number
          unit_price: number
          vendor_cost: number
        }
        Insert: {
          change_order_id: string
          created_at?: string
          description: string
          id?: string
          is_taxable?: boolean | null
          markup?: number
          original_scope_description?: string | null
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          total?: number
          unit_price?: number
          vendor_cost?: number
        }
        Update: {
          change_order_id?: string
          created_at?: string
          description?: string
          id?: string
          is_taxable?: boolean | null
          markup?: number
          original_scope_description?: string | null
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          total?: number
          unit_price?: number
          vendor_cost?: number
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
          change_type: Database["public"]["Enums"]["change_type"]
          created_at: string
          created_by: string | null
          customer_id: string
          customer_name: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          invoiced_amount: number
          job_order_id: string | null
          number: string
          project_id: string
          purchase_order_id: string | null
          reason: string
          remaining_amount: number
          scope_reference: string | null
          source_estimate_id: string | null
          source_job_order_id: string | null
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
          change_type?: Database["public"]["Enums"]["change_type"]
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_name: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          invoiced_amount?: number
          job_order_id?: string | null
          number: string
          project_id: string
          purchase_order_id?: string | null
          reason: string
          remaining_amount?: number
          scope_reference?: string | null
          source_estimate_id?: string | null
          source_job_order_id?: string | null
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
          change_type?: Database["public"]["Enums"]["change_type"]
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_name?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          invoiced_amount?: number
          job_order_id?: string | null
          number?: string
          project_id?: string
          purchase_order_id?: string | null
          reason?: string
          remaining_amount?: number
          scope_reference?: string | null
          source_estimate_id?: string | null
          source_job_order_id?: string | null
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
            foreignKeyName: "change_orders_source_estimate_id_fkey"
            columns: ["source_estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_source_job_order_id_fkey"
            columns: ["source_job_order_id"]
            isOneToOne: false
            referencedRelation: "job_orders"
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
      clock_alerts: {
        Row: {
          alert_date: string
          alert_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          personnel_id: string | null
          project_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          sent_at: string | null
          time_entry_id: string | null
        }
        Insert: {
          alert_date: string
          alert_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          personnel_id?: string | null
          project_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sent_at?: string | null
          time_entry_id?: string | null
        }
        Update: {
          alert_date?: string
          alert_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          personnel_id?: string | null
          project_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sent_at?: string | null
          time_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clock_alerts_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_alerts_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
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
          locked_period_date: string | null
          locked_period_enabled: boolean | null
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
          locked_period_date?: string | null
          locked_period_enabled?: boolean | null
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
          locked_period_date?: string | null
          locked_period_enabled?: boolean | null
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
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          delivered_at: string | null
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          message_type: string | null
          read_at: string | null
          retry_count: number | null
          sender_id: string
          sender_type: string
          status: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          message_type?: string | null
          read_at?: string | null
          retry_count?: number | null
          sender_id: string
          sender_type: string
          status?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          message_type?: string | null
          read_at?: string | null
          retry_count?: number | null
          sender_id?: string
          sender_type?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          last_read_at: string | null
          participant_id: string
          participant_type: string
          unread_count: number | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          last_read_at?: string | null
          participant_id: string
          participant_type: string
          unread_count?: number | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          last_read_at?: string | null
          participant_id?: string
          participant_type?: string
          unread_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          participant_1_id: string
          participant_1_type: string
          participant_2_id: string
          participant_2_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          participant_1_id: string
          participant_1_type: string
          participant_2_id: string
          participant_2_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          participant_1_id?: string
          participant_1_type?: string
          participant_2_id?: string
          participant_2_type?: string
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
          deleted_at: string | null
          deleted_by: string | null
          email: string
          id: string
          jobsite_address: string | null
          merge_reason: string | null
          merged_at: string | null
          merged_by: string | null
          merged_into_id: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          id?: string
          jobsite_address?: string | null
          merge_reason?: string | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into_id?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          id?: string
          jobsite_address?: string | null
          merge_reason?: string | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          tax_exempt?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_configurations: {
        Row: {
          created_at: string
          id: string
          layout: Json
          theme: Json
          updated_at: string
          user_id: string
          widgets: Json
        }
        Insert: {
          created_at?: string
          id?: string
          layout?: Json
          theme?: Json
          updated_at?: string
          user_id: string
          widgets?: Json
        }
        Update: {
          created_at?: string
          id?: string
          layout?: Json
          theme?: Json
          updated_at?: string
          user_id?: string
          widgets?: Json
        }
        Relationships: []
      }
      dev_activities: {
        Row: {
          activity_date: string
          activity_time: string | null
          activity_type: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          extraction_confidence: string | null
          id: string
          project_name: string | null
          session_id: string | null
          source_screenshot_url: string | null
          tags: string[] | null
          technologies: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_date?: string
          activity_time?: string | null
          activity_type: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          extraction_confidence?: string | null
          id?: string
          project_name?: string | null
          session_id?: string | null
          source_screenshot_url?: string | null
          tags?: string[] | null
          technologies?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_date?: string
          activity_time?: string | null
          activity_type?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          extraction_confidence?: string | null
          id?: string
          project_name?: string | null
          session_id?: string | null
          source_screenshot_url?: string | null
          tags?: string[] | null
          technologies?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_activities_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_work_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      entity_merge_audit: {
        Row: {
          created_at: string | null
          entity_type: string
          field_overrides: Json | null
          id: string
          is_reversed: boolean | null
          merged_at: string | null
          merged_by: string | null
          merged_by_email: string | null
          merged_entity_snapshot: Json
          notes: string | null
          quickbooks_resolution: Json | null
          related_records_updated: Json | null
          reversed_at: string | null
          reversed_by: string | null
          source_entity_id: string
          source_entity_snapshot: Json
          target_entity_id: string
          target_entity_snapshot: Json
        }
        Insert: {
          created_at?: string | null
          entity_type: string
          field_overrides?: Json | null
          id?: string
          is_reversed?: boolean | null
          merged_at?: string | null
          merged_by?: string | null
          merged_by_email?: string | null
          merged_entity_snapshot: Json
          notes?: string | null
          quickbooks_resolution?: Json | null
          related_records_updated?: Json | null
          reversed_at?: string | null
          reversed_by?: string | null
          source_entity_id: string
          source_entity_snapshot: Json
          target_entity_id: string
          target_entity_snapshot: Json
        }
        Update: {
          created_at?: string | null
          entity_type?: string
          field_overrides?: Json | null
          id?: string
          is_reversed?: boolean | null
          merged_at?: string | null
          merged_by?: string | null
          merged_by_email?: string | null
          merged_entity_snapshot?: Json
          notes?: string | null
          quickbooks_resolution?: Json | null
          related_records_updated?: Json | null
          reversed_at?: string | null
          reversed_by?: string | null
          source_entity_id?: string
          source_entity_snapshot?: Json
          target_entity_id?: string
          target_entity_snapshot?: Json
        }
        Relationships: []
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
          product_name: string | null
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
          product_name?: string | null
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
          product_name?: string | null
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
      estimate_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          estimate_id: string
          id: string
          snapshot: Json
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          estimate_id: string
          id?: string
          snapshot: Json
          version_number: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          estimate_id?: string
          id?: string
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_versions_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
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
          deleted_at: string | null
          deleted_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
      geocode_logs: {
        Row: {
          address_input: string | null
          created_at: string | null
          error_message: string | null
          id: string
          lat: number | null
          lng: number | null
          record_id: string
          record_type: string
          success: boolean
        }
        Insert: {
          address_input?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          record_id: string
          record_type: string
          success: boolean
        }
        Update: {
          address_input?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          record_id?: string
          record_type?: string
          success?: boolean
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
      integration_settings: {
        Row: {
          created_at: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
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
          display_order: number | null
          id: string
          invoice_id: string
          jo_line_item_id: string | null
          markup: number
          product_id: string | null
          product_name: string | null
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          display_order?: number | null
          id?: string
          invoice_id: string
          jo_line_item_id?: string | null
          markup?: number
          product_id?: string | null
          product_name?: string | null
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number | null
          id?: string
          invoice_id?: string
          jo_line_item_id?: string | null
          markup?: number
          product_id?: string | null
          product_name?: string | null
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
          {
            foreignKeyName: "invoice_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payment_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          payment_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          payment_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          payment_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payment_attachments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "invoice_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          quickbooks_payment_id: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          quickbooks_payment_id?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          quickbooks_payment_id?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
          customer_po: string | null
          deleted_at: string | null
          deleted_by: string | null
          due_date: string
          estimate_id: string | null
          id: string
          job_order_id: string | null
          job_order_number: string | null
          notes: string | null
          number: string
          paid_amount: number
          paid_date: string | null
          project_id: string | null
          project_name: string | null
          remaining_amount: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          tm_ticket_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          change_order_id?: string | null
          created_at?: string
          customer_id: string
          customer_name: string
          customer_po?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date: string
          estimate_id?: string | null
          id?: string
          job_order_id?: string | null
          job_order_number?: string | null
          notes?: string | null
          number: string
          paid_amount?: number
          paid_date?: string | null
          project_id?: string | null
          project_name?: string | null
          remaining_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          tm_ticket_id?: string | null
          total: number
          updated_at?: string
        }
        Update: {
          change_order_id?: string | null
          created_at?: string
          customer_id?: string
          customer_name?: string
          customer_po?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string
          estimate_id?: string | null
          id?: string
          job_order_id?: string | null
          job_order_number?: string | null
          notes?: string | null
          number?: string
          paid_amount?: number
          paid_date?: string | null
          project_id?: string | null
          project_name?: string | null
          remaining_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          tm_ticket_id?: string | null
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
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tm_ticket_id_fkey"
            columns: ["tm_ticket_id"]
            isOneToOne: false
            referencedRelation: "tm_tickets"
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
          is_taxable: boolean | null
          job_order_id: string
          markup: number
          product_id: string | null
          product_name: string | null
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoiced_quantity?: number | null
          is_taxable?: boolean | null
          job_order_id: string
          markup: number
          product_id?: string | null
          product_name?: string | null
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoiced_quantity?: number | null
          is_taxable?: boolean | null
          job_order_id?: string
          markup?: number
          product_id?: string | null
          product_name?: string | null
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
          {
            foreignKeyName: "job_order_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          deleted_at: string | null
          deleted_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
      job_postings: {
        Row: {
          created_at: string
          form_template_id: string | null
          id: string
          is_open: boolean
          public_token: string
          task_order_id: string
        }
        Insert: {
          created_at?: string
          form_template_id?: string | null
          id?: string
          is_open?: boolean
          public_token?: string
          task_order_id: string
        }
        Update: {
          created_at?: string
          form_template_id?: string | null
          id?: string
          is_open?: boolean
          public_token?: string
          task_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_form_template_id_fkey"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "application_form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_task_order_id_fkey"
            columns: ["task_order_id"]
            isOneToOne: false
            referencedRelation: "project_task_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      locked_period_violations: {
        Row: {
          action: string
          attempted_date: string
          blocked: boolean | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          locked_period_date: string
          user_id: string | null
        }
        Insert: {
          action: string
          attempted_date: string
          blocked?: boolean | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          locked_period_date: string
          user_id?: string | null
        }
        Update: {
          action?: string
          attempted_date?: string
          blocked?: boolean | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          locked_period_date?: string
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          direction: string | null
          error_message: string | null
          external_id: string | null
          has_response: boolean | null
          id: string
          message_type: string
          parent_message_id: string | null
          payload: Json | null
          recipient_id: string
          recipient_name: string
          recipient_phone: string
          recipient_type: string
          response_content: string | null
          response_received_at: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          direction?: string | null
          error_message?: string | null
          external_id?: string | null
          has_response?: boolean | null
          id?: string
          message_type?: string
          parent_message_id?: string | null
          payload?: Json | null
          recipient_id: string
          recipient_name: string
          recipient_phone: string
          recipient_type: string
          response_content?: string | null
          response_received_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          direction?: string | null
          error_message?: string | null
          external_id?: string | null
          has_response?: boolean | null
          id?: string
          message_type?: string
          parent_message_id?: string | null
          payload?: Json | null
          recipient_id?: string
          recipient_name?: string
          recipient_phone?: string
          recipient_type?: string
          response_content?: string | null
          response_received_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
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
          co_submitted_for_approval: boolean | null
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
          personnel_registration_pending: boolean | null
          po_approved: boolean | null
          po_rejected: boolean | null
          po_sent: boolean | null
          po_status_changed: boolean | null
          po_submitted_for_approval: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          co_submitted_for_approval?: boolean | null
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
          personnel_registration_pending?: boolean | null
          po_approved?: boolean | null
          po_rejected?: boolean | null
          po_sent?: boolean | null
          po_status_changed?: boolean | null
          po_submitted_for_approval?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          co_submitted_for_approval?: boolean | null
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
          personnel_registration_pending?: boolean | null
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
          applicant_id: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          bank_name: string | null
          bank_routing_number: string | null
          bill_rate: number | null
          citizenship_status: string | null
          city: string | null
          created_at: string | null
          date_of_birth: string | null
          deleted_at: string | null
          deleted_by: string | null
          direct_deposit_signature: string | null
          direct_deposit_signed_at: string | null
          email: string
          everify_case_number: string | null
          everify_expiry: string | null
          everify_status: Database["public"]["Enums"]["everify_status"] | null
          everify_verified_at: string | null
          first_name: string
          geocode_source: string | null
          geocoded_at: string | null
          home_lat: number | null
          home_lng: number | null
          hourly_rate: number | null
          i9_completed_at: string | null
          ica_signature: string | null
          ica_signed_at: string | null
          id: string
          id_document_url: string | null
          immigration_status: string | null
          is_geocodable: boolean | null
          last_name: string
          linked_vendor_id: string | null
          merge_reason: string | null
          merged_at: string | null
          merged_by: string | null
          merged_into_id: string | null
          notes: string | null
          onboarding_completed_at: string | null
          onboarding_status: string | null
          pay_rate: number | null
          personnel_number: string
          phone: string | null
          photo_url: string | null
          portal_required: boolean | null
          rating: number | null
          ssn_full: string | null
          ssn_last_four: string | null
          state: string | null
          status: Database["public"]["Enums"]["personnel_status"] | null
          tax_business_name: string | null
          tax_classification: string | null
          tax_ein: string | null
          updated_at: string | null
          user_id: string | null
          vendor_id: string | null
          w9_certification: boolean | null
          w9_signature: string | null
          w9_signed_at: string | null
          work_auth_expiry: string | null
          work_authorization_status: string | null
          work_authorization_type:
            | Database["public"]["Enums"]["work_auth_type"]
            | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          applicant_id?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          bill_rate?: number | null
          citizenship_status?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          direct_deposit_signature?: string | null
          direct_deposit_signed_at?: string | null
          email: string
          everify_case_number?: string | null
          everify_expiry?: string | null
          everify_status?: Database["public"]["Enums"]["everify_status"] | null
          everify_verified_at?: string | null
          first_name: string
          geocode_source?: string | null
          geocoded_at?: string | null
          home_lat?: number | null
          home_lng?: number | null
          hourly_rate?: number | null
          i9_completed_at?: string | null
          ica_signature?: string | null
          ica_signed_at?: string | null
          id?: string
          id_document_url?: string | null
          immigration_status?: string | null
          is_geocodable?: boolean | null
          last_name: string
          linked_vendor_id?: string | null
          merge_reason?: string | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into_id?: string | null
          notes?: string | null
          onboarding_completed_at?: string | null
          onboarding_status?: string | null
          pay_rate?: number | null
          personnel_number: string
          phone?: string | null
          photo_url?: string | null
          portal_required?: boolean | null
          rating?: number | null
          ssn_full?: string | null
          ssn_last_four?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["personnel_status"] | null
          tax_business_name?: string | null
          tax_classification?: string | null
          tax_ein?: string | null
          updated_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
          w9_certification?: boolean | null
          w9_signature?: string | null
          w9_signed_at?: string | null
          work_auth_expiry?: string | null
          work_authorization_status?: string | null
          work_authorization_type?:
            | Database["public"]["Enums"]["work_auth_type"]
            | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          applicant_id?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          bill_rate?: number | null
          citizenship_status?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          direct_deposit_signature?: string | null
          direct_deposit_signed_at?: string | null
          email?: string
          everify_case_number?: string | null
          everify_expiry?: string | null
          everify_status?: Database["public"]["Enums"]["everify_status"] | null
          everify_verified_at?: string | null
          first_name?: string
          geocode_source?: string | null
          geocoded_at?: string | null
          home_lat?: number | null
          home_lng?: number | null
          hourly_rate?: number | null
          i9_completed_at?: string | null
          ica_signature?: string | null
          ica_signed_at?: string | null
          id?: string
          id_document_url?: string | null
          immigration_status?: string | null
          is_geocodable?: boolean | null
          last_name?: string
          linked_vendor_id?: string | null
          merge_reason?: string | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into_id?: string | null
          notes?: string | null
          onboarding_completed_at?: string | null
          onboarding_status?: string | null
          pay_rate?: number | null
          personnel_number?: string
          phone?: string | null
          photo_url?: string | null
          portal_required?: boolean | null
          rating?: number | null
          ssn_full?: string | null
          ssn_last_four?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["personnel_status"] | null
          tax_business_name?: string | null
          tax_classification?: string | null
          tax_ein?: string | null
          updated_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
          w9_certification?: boolean | null
          w9_signature?: string | null
          w9_signed_at?: string | null
          work_auth_expiry?: string | null
          work_authorization_status?: string | null
          work_authorization_type?:
            | Database["public"]["Enums"]["work_auth_type"]
            | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_linked_vendor_id_fkey"
            columns: ["linked_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
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
      personnel_documents: {
        Row: {
          ai_verification_confidence: string | null
          ai_verification_result: Json | null
          ai_verified: boolean | null
          ai_verified_at: string | null
          created_at: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          personnel_id: string
          uploaded_at: string | null
        }
        Insert: {
          ai_verification_confidence?: string | null
          ai_verification_result?: Json | null
          ai_verified?: boolean | null
          ai_verified_at?: string | null
          created_at?: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          personnel_id: string
          uploaded_at?: string | null
        }
        Update: {
          ai_verification_confidence?: string | null
          ai_verification_result?: Json | null
          ai_verified?: boolean | null
          ai_verified_at?: string | null
          created_at?: string | null
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          personnel_id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_documents_personnel_id_fkey"
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
      personnel_onboarding_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          personnel_id: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          personnel_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          personnel_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_onboarding_tokens_personnel_id_fkey"
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
          hourly_rate: number | null
          id: string
          notes: string | null
          number: string
          overtime_hours: number | null
          pay_period_end: string | null
          pay_period_start: string | null
          payment_date: string
          payment_type: Database["public"]["Enums"]["personnel_payment_type"]
          personnel_id: string
          personnel_name: string
          regular_hours: number | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          gross_amount: number
          hourly_rate?: number | null
          id?: string
          notes?: string | null
          number: string
          overtime_hours?: number | null
          pay_period_end?: string | null
          pay_period_start?: string | null
          payment_date: string
          payment_type?: Database["public"]["Enums"]["personnel_payment_type"]
          personnel_id: string
          personnel_name: string
          regular_hours?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          gross_amount?: number
          hourly_rate?: number | null
          id?: string
          notes?: string | null
          number?: string
          overtime_hours?: number | null
          pay_period_end?: string | null
          pay_period_start?: string | null
          payment_date?: string
          payment_type?: Database["public"]["Enums"]["personnel_payment_type"]
          personnel_id?: string
          personnel_name?: string
          regular_hours?: number | null
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
          bill_rate: number | null
          created_at: string | null
          id: string
          last_time_entry_at: string | null
          pay_rate: number | null
          personnel_id: string
          project_id: string
          rate_bracket_id: string | null
          status: string
          unassigned_at: string | null
          unassigned_by: string | null
          unassigned_notes: string | null
          unassigned_reason: string | null
          updated_at: string | null
          work_classification: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          bill_rate?: number | null
          created_at?: string | null
          id?: string
          last_time_entry_at?: string | null
          pay_rate?: number | null
          personnel_id: string
          project_id: string
          rate_bracket_id?: string | null
          status?: string
          unassigned_at?: string | null
          unassigned_by?: string | null
          unassigned_notes?: string | null
          unassigned_reason?: string | null
          updated_at?: string | null
          work_classification?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          bill_rate?: number | null
          created_at?: string | null
          id?: string
          last_time_entry_at?: string | null
          pay_rate?: number | null
          personnel_id?: string
          project_id?: string
          rate_bracket_id?: string | null
          status?: string
          unassigned_at?: string | null
          unassigned_by?: string | null
          unassigned_notes?: string | null
          unassigned_reason?: string | null
          updated_at?: string | null
          work_classification?: string | null
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
          {
            foreignKeyName: "personnel_project_assignments_rate_bracket_id_fkey"
            columns: ["rate_bracket_id"]
            isOneToOne: false
            referencedRelation: "project_rate_brackets"
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
          personnel_id: string | null
          phone: string | null
          rejection_reason: string | null
          reverse_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
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
          personnel_id?: string | null
          phone?: string | null
          rejection_reason?: string | null
          reverse_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
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
          personnel_id?: string | null
          phone?: string | null
          rejection_reason?: string | null
          reverse_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
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
        Relationships: [
          {
            foreignKeyName: "personnel_registrations_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_schedules: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          personnel_id: string
          project_id: string
          scheduled_date: string
          scheduled_end_time: string | null
          scheduled_start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          personnel_id: string
          project_id: string
          scheduled_date: string
          scheduled_end_time?: string | null
          scheduled_start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          personnel_id?: string
          project_id?: string
          scheduled_date?: string
          scheduled_end_time?: string | null
          scheduled_start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_schedules_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_w9_forms: {
        Row: {
          account_numbers: string | null
          address: string
          business_name: string | null
          certified_correct_tin: boolean | null
          certified_fatca_exempt: boolean | null
          certified_not_subject_backup_withholding: boolean | null
          certified_us_person: boolean | null
          city: string
          created_at: string | null
          document_url: string | null
          edit_allowed: boolean | null
          edit_allowed_until: string | null
          ein: string | null
          exempt_payee_code: string | null
          fatca_exemption_code: string | null
          federal_tax_classification: string
          has_foreign_partners: boolean | null
          id: string
          llc_tax_classification: string | null
          name_on_return: string
          other_classification: string | null
          personnel_id: string
          rejection_reason: string | null
          signature_data: string | null
          signature_date: string
          state: string
          status: string
          tin_type: string
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
          zip: string
        }
        Insert: {
          account_numbers?: string | null
          address: string
          business_name?: string | null
          certified_correct_tin?: boolean | null
          certified_fatca_exempt?: boolean | null
          certified_not_subject_backup_withholding?: boolean | null
          certified_us_person?: boolean | null
          city: string
          created_at?: string | null
          document_url?: string | null
          edit_allowed?: boolean | null
          edit_allowed_until?: string | null
          ein?: string | null
          exempt_payee_code?: string | null
          fatca_exemption_code?: string | null
          federal_tax_classification: string
          has_foreign_partners?: boolean | null
          id?: string
          llc_tax_classification?: string | null
          name_on_return: string
          other_classification?: string | null
          personnel_id: string
          rejection_reason?: string | null
          signature_data?: string | null
          signature_date: string
          state: string
          status?: string
          tin_type?: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          zip: string
        }
        Update: {
          account_numbers?: string | null
          address?: string
          business_name?: string | null
          certified_correct_tin?: boolean | null
          certified_fatca_exempt?: boolean | null
          certified_not_subject_backup_withholding?: boolean | null
          certified_us_person?: boolean | null
          city?: string
          created_at?: string | null
          document_url?: string | null
          edit_allowed?: boolean | null
          edit_allowed_until?: string | null
          ein?: string | null
          exempt_payee_code?: string | null
          fatca_exemption_code?: string | null
          federal_tax_classification?: string
          has_foreign_partners?: boolean | null
          id?: string
          llc_tax_classification?: string | null
          name_on_return?: string
          other_classification?: string | null
          personnel_id?: string
          rejection_reason?: string | null
          signature_data?: string | null
          signature_date?: string
          state?: string
          status?: string
          tin_type?: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_w9_forms_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: true
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      po_addendum_attachments: {
        Row: {
          addendum_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          addendum_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          addendum_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_addendum_attachments_addendum_id_fkey"
            columns: ["addendum_id"]
            isOneToOne: false
            referencedRelation: "po_addendums"
            referencedColumns: ["id"]
          },
        ]
      }
      po_addendum_line_items: {
        Row: {
          billed_quantity: number
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
          billed_quantity?: number
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
          billed_quantity?: number
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
          change_order_id: string | null
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
          change_order_id?: string | null
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
          change_order_id?: string | null
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
            foreignKeyName: "po_addendums_change_order_id_fkey"
            columns: ["change_order_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
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
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          is_taxable: boolean | null
          item_type: Database["public"]["Enums"]["item_type"]
          markup: number
          name: string
          price: number
          qb_product_mapping_id: string | null
          sku: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          cost: number
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_taxable?: boolean | null
          item_type?: Database["public"]["Enums"]["item_type"]
          markup: number
          name: string
          price: number
          qb_product_mapping_id?: string | null
          sku?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          category?: string
          cost?: number
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_taxable?: boolean | null
          item_type?: Database["public"]["Enums"]["item_type"]
          markup?: number
          name?: string
          price?: number
          qb_product_mapping_id?: string | null
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_qb_product_mapping_id_fkey"
            columns: ["qb_product_mapping_id"]
            isOneToOne: false
            referencedRelation: "qb_product_service_mappings"
            referencedColumns: ["id"]
          },
        ]
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
      project_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          project_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          project_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          project_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_labor_expenses: {
        Row: {
          billable: boolean | null
          created_at: string | null
          customer_id: string
          hourly_rate: number
          id: string
          invoice_id: string | null
          invoice_line_item_id: string | null
          overtime_hours: number
          overtime_rate: number
          personnel_id: string
          personnel_name: string
          personnel_payment_id: string | null
          project_id: string
          regular_hours: number
          status: string
          total_amount: number
          updated_at: string | null
          vendor_bill_id: string | null
          week_closeout_id: string | null
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          billable?: boolean | null
          created_at?: string | null
          customer_id: string
          hourly_rate?: number
          id?: string
          invoice_id?: string | null
          invoice_line_item_id?: string | null
          overtime_hours?: number
          overtime_rate?: number
          personnel_id: string
          personnel_name: string
          personnel_payment_id?: string | null
          project_id: string
          regular_hours?: number
          status?: string
          total_amount?: number
          updated_at?: string | null
          vendor_bill_id?: string | null
          week_closeout_id?: string | null
          week_end_date: string
          week_start_date: string
        }
        Update: {
          billable?: boolean | null
          created_at?: string | null
          customer_id?: string
          hourly_rate?: number
          id?: string
          invoice_id?: string | null
          invoice_line_item_id?: string | null
          overtime_hours?: number
          overtime_rate?: number
          personnel_id?: string
          personnel_name?: string
          personnel_payment_id?: string | null
          project_id?: string
          regular_hours?: number
          status?: string
          total_amount?: number
          updated_at?: string | null
          vendor_bill_id?: string | null
          week_closeout_id?: string | null
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_labor_expenses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_labor_expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_labor_expenses_invoice_line_item_id_fkey"
            columns: ["invoice_line_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_labor_expenses_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_labor_expenses_personnel_payment_id_fkey"
            columns: ["personnel_payment_id"]
            isOneToOne: false
            referencedRelation: "personnel_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_labor_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_labor_expenses_vendor_bill_id_fkey"
            columns: ["vendor_bill_id"]
            isOneToOne: false
            referencedRelation: "vendor_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_labor_expenses_week_closeout_id_fkey"
            columns: ["week_closeout_id"]
            isOneToOne: false
            referencedRelation: "time_week_closeouts"
            referencedColumns: ["id"]
          },
        ]
      }
      project_personnel_rate_history: {
        Row: {
          assignment_id: string | null
          change_reason: string | null
          changed_by: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          pay_rate: number
          personnel_id: string
          project_id: string
        }
        Insert: {
          assignment_id?: string | null
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          pay_rate: number
          personnel_id: string
          project_id: string
        }
        Update: {
          assignment_id?: string | null
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          pay_rate?: number
          personnel_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_personnel_rate_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "personnel_project_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_personnel_rate_history_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_personnel_rate_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_rate_brackets: {
        Row: {
          bill_rate: number
          created_at: string
          id: string
          is_active: boolean
          is_billable: boolean
          name: string
          overtime_multiplier: number
          project_id: string
          updated_at: string
        }
        Insert: {
          bill_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_billable?: boolean
          name: string
          overtime_multiplier?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          bill_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_billable?: boolean
          name?: string
          overtime_multiplier?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_rate_brackets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_rooms: {
        Row: {
          assigned_contractor_id: string | null
          assigned_vendor_id: string | null
          ceiling_height: number | null
          created_at: string
          floor_number: number | null
          id: string
          notes: string | null
          project_id: string
          shower_size: string | null
          status: Database["public"]["Enums"]["room_status"]
          unit_number: string
          updated_at: string
        }
        Insert: {
          assigned_contractor_id?: string | null
          assigned_vendor_id?: string | null
          ceiling_height?: number | null
          created_at?: string
          floor_number?: number | null
          id?: string
          notes?: string | null
          project_id: string
          shower_size?: string | null
          status?: Database["public"]["Enums"]["room_status"]
          unit_number: string
          updated_at?: string
        }
        Update: {
          assigned_contractor_id?: string | null
          assigned_vendor_id?: string | null
          ceiling_height?: number | null
          created_at?: string
          floor_number?: number | null
          id?: string
          notes?: string | null
          project_id?: string
          shower_size?: string | null
          status?: Database["public"]["Enums"]["room_status"]
          unit_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_rooms_assigned_contractor_id_fkey"
            columns: ["assigned_contractor_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_rooms_assigned_vendor_id_fkey"
            columns: ["assigned_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_orders: {
        Row: {
          created_at: string
          headcount_needed: number
          id: string
          job_description: string | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          project_id: string
          start_at: string | null
          status: Database["public"]["Enums"]["task_order_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          headcount_needed?: number
          id?: string
          job_description?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          project_id: string
          start_at?: string | null
          status?: Database["public"]["Enums"]["task_order_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          headcount_needed?: number
          id?: string
          job_description?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          project_id?: string
          start_at?: string | null
          status?: Database["public"]["Enums"]["task_order_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_units: {
        Row: {
          created_at: string
          created_by: string | null
          floor: string | null
          id: string
          notes: string | null
          project_id: string
          unit_name: string | null
          unit_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          floor?: string | null
          id?: string
          notes?: string | null
          project_id: string
          unit_name?: string | null
          unit_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          floor?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          unit_name?: string | null
          unit_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_units_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          customer_id: string
          customer_po: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          end_date: string | null
          geofence_radius_miles: number | null
          id: string
          mandatory_payroll: boolean | null
          name: string
          poc_email: string | null
          poc_name: string | null
          poc_phone: string | null
          require_clock_location: boolean | null
          site_geocoded_at: string | null
          site_lat: number | null
          site_lng: number | null
          stage: Database["public"]["Enums"]["project_stage"]
          start_date: string
          state: string | null
          status: Database["public"]["Enums"]["project_status"]
          time_clock_enabled: boolean | null
          total_cost: number
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          customer_id: string
          customer_po?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          end_date?: string | null
          geofence_radius_miles?: number | null
          id?: string
          mandatory_payroll?: boolean | null
          name: string
          poc_email?: string | null
          poc_name?: string | null
          poc_phone?: string | null
          require_clock_location?: boolean | null
          site_geocoded_at?: string | null
          site_lat?: number | null
          site_lng?: number | null
          stage?: Database["public"]["Enums"]["project_stage"]
          start_date: string
          state?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          time_clock_enabled?: boolean | null
          total_cost?: number
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string
          customer_po?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          end_date?: string | null
          geofence_radius_miles?: number | null
          id?: string
          mandatory_payroll?: boolean | null
          name?: string
          poc_email?: string | null
          poc_name?: string | null
          poc_phone?: string | null
          require_clock_location?: boolean | null
          site_geocoded_at?: string | null
          site_lat?: number | null
          site_lng?: number | null
          stage?: Database["public"]["Enums"]["project_stage"]
          start_date?: string
          state?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          time_clock_enabled?: boolean | null
          total_cost?: number
          updated_at?: string
          zip?: string | null
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
          deleted_at: string | null
          deleted_by: string | null
          due_date: string
          id: string
          is_closed: boolean | null
          job_order_id: string
          job_order_number: string
          notes: string | null
          number: string
          project_id: string
          project_name: string
          reopened_at: string | null
          reopened_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          due_date: string
          id?: string
          is_closed?: boolean | null
          job_order_id: string
          job_order_number: string
          notes?: string | null
          number: string
          project_id: string
          project_name: string
          reopened_at?: string | null
          reopened_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string
          id?: string
          is_closed?: boolean | null
          job_order_id?: string
          job_order_number?: string
          notes?: string | null
          number?: string
          project_id?: string
          project_name?: string
          reopened_at?: string | null
          reopened_by?: string | null
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
      push_tokens: {
        Row: {
          created_at: string | null
          device_name: string | null
          id: string
          last_used_at: string | null
          platform: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          platform?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          platform?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      qb_product_service_mappings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          quickbooks_item_id: string | null
          quickbooks_item_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          quickbooks_item_id?: string | null
          quickbooks_item_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          quickbooks_item_id?: string | null
          quickbooks_item_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quickbooks_account_mappings: {
        Row: {
          created_at: string | null
          expense_category_id: string
          id: string
          last_synced_at: string | null
          quickbooks_account_id: string
          quickbooks_account_name: string | null
          quickbooks_account_subtype: string | null
          quickbooks_account_type: string | null
          sync_status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expense_category_id: string
          id?: string
          last_synced_at?: string | null
          quickbooks_account_id: string
          quickbooks_account_name?: string | null
          quickbooks_account_subtype?: string | null
          quickbooks_account_type?: string | null
          sync_status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expense_category_id?: string
          id?: string
          last_synced_at?: string | null
          quickbooks_account_id?: string
          quickbooks_account_name?: string | null
          quickbooks_account_subtype?: string | null
          quickbooks_account_type?: string | null
          sync_status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_account_mappings_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
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
      quickbooks_journal_entries: {
        Row: {
          created_at: string | null
          currency_code: string | null
          doc_number: string | null
          fetched_at: string | null
          id: string
          is_adjustment: boolean | null
          line_items: Json | null
          private_note: string | null
          quickbooks_id: string
          raw_data: Json | null
          total_amount: number | null
          txn_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency_code?: string | null
          doc_number?: string | null
          fetched_at?: string | null
          id?: string
          is_adjustment?: boolean | null
          line_items?: Json | null
          private_note?: string | null
          quickbooks_id: string
          raw_data?: Json | null
          total_amount?: number | null
          txn_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency_code?: string | null
          doc_number?: string | null
          fetched_at?: string | null
          id?: string
          is_adjustment?: boolean | null
          line_items?: Json | null
          private_note?: string | null
          quickbooks_id?: string
          raw_data?: Json | null
          total_amount?: number | null
          txn_date?: string
          updated_at?: string | null
        }
        Relationships: []
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
          category_id: string | null
          created_at: string | null
          description: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_id: string | null
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
          category_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_id?: string | null
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
          category_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_id?: string | null
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
            foreignKeyName: "reimbursements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "personnel_payments"
            referencedColumns: ["id"]
          },
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
      room_scope_items: {
        Row: {
          allocated_quantity: number
          completed_quantity: number
          created_at: string
          id: string
          job_order_line_item_id: string
          room_id: string
          scope_code: string | null
          scope_description: string | null
          status: Database["public"]["Enums"]["room_scope_status"]
          unit: string | null
          updated_at: string
        }
        Insert: {
          allocated_quantity: number
          completed_quantity?: number
          created_at?: string
          id?: string
          job_order_line_item_id: string
          room_id: string
          scope_code?: string | null
          scope_description?: string | null
          status?: Database["public"]["Enums"]["room_scope_status"]
          unit?: string | null
          updated_at?: string
        }
        Update: {
          allocated_quantity?: number
          completed_quantity?: number
          created_at?: string
          id?: string
          job_order_line_item_id?: string
          room_id?: string
          scope_code?: string | null
          scope_description?: string | null
          status?: Database["public"]["Enums"]["room_scope_status"]
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_scope_items_job_order_line_item_id_fkey"
            columns: ["job_order_line_item_id"]
            isOneToOne: false
            referencedRelation: "job_order_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_scope_items_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "project_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      session_activity_log: {
        Row: {
          action_name: string | null
          activity_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          route: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          action_name?: string | null
          activity_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          route?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          action_name?: string | null
          activity_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          route?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_activity_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_work_sessions"
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
          auto_clock_out_reason: string | null
          auto_clocked_out: boolean | null
          billable: boolean | null
          clock_blocked_until: string | null
          clock_in_accuracy: number | null
          clock_in_at: string | null
          clock_in_lat: number | null
          clock_in_lng: number | null
          clock_out_accuracy: number | null
          clock_out_at: string | null
          clock_out_lat: number | null
          clock_out_lng: number | null
          created_at: string
          description: string | null
          entry_date: string
          entry_source: string | null
          hourly_rate: number | null
          hours: number
          id: string
          invoice_id: string | null
          invoiced_at: string | null
          is_holiday: boolean | null
          is_locked: boolean | null
          is_on_lunch: boolean | null
          job_order_id: string | null
          last_location_check_at: string | null
          last_location_lat: number | null
          last_location_lng: number | null
          lunch_duration_minutes: number | null
          lunch_end_at: string | null
          lunch_start_at: string | null
          overtime_hours: number | null
          personnel_id: string | null
          project_id: string
          regular_hours: number | null
          status: string | null
          updated_at: string
          user_id: string
          vendor_bill_id: string | null
          week_closeout_id: string | null
        }
        Insert: {
          auto_clock_out_reason?: string | null
          auto_clocked_out?: boolean | null
          billable?: boolean | null
          clock_blocked_until?: string | null
          clock_in_accuracy?: number | null
          clock_in_at?: string | null
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_out_accuracy?: number | null
          clock_out_at?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          created_at?: string
          description?: string | null
          entry_date: string
          entry_source?: string | null
          hourly_rate?: number | null
          hours: number
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          is_holiday?: boolean | null
          is_locked?: boolean | null
          is_on_lunch?: boolean | null
          job_order_id?: string | null
          last_location_check_at?: string | null
          last_location_lat?: number | null
          last_location_lng?: number | null
          lunch_duration_minutes?: number | null
          lunch_end_at?: string | null
          lunch_start_at?: string | null
          overtime_hours?: number | null
          personnel_id?: string | null
          project_id: string
          regular_hours?: number | null
          status?: string | null
          updated_at?: string
          user_id: string
          vendor_bill_id?: string | null
          week_closeout_id?: string | null
        }
        Update: {
          auto_clock_out_reason?: string | null
          auto_clocked_out?: boolean | null
          billable?: boolean | null
          clock_blocked_until?: string | null
          clock_in_accuracy?: number | null
          clock_in_at?: string | null
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_out_accuracy?: number | null
          clock_out_at?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          created_at?: string
          description?: string | null
          entry_date?: string
          entry_source?: string | null
          hourly_rate?: number | null
          hours?: number
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          is_holiday?: boolean | null
          is_locked?: boolean | null
          is_on_lunch?: boolean | null
          job_order_id?: string | null
          last_location_check_at?: string | null
          last_location_lat?: number | null
          last_location_lng?: number | null
          lunch_duration_minutes?: number | null
          lunch_end_at?: string | null
          lunch_start_at?: string | null
          overtime_hours?: number | null
          personnel_id?: string | null
          project_id?: string
          regular_hours?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string
          vendor_bill_id?: string | null
          week_closeout_id?: string | null
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
          {
            foreignKeyName: "time_entries_vendor_bill_id_fkey"
            columns: ["vendor_bill_id"]
            isOneToOne: false
            referencedRelation: "vendor_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_week_closeout_id_fkey"
            columns: ["week_closeout_id"]
            isOneToOne: false
            referencedRelation: "time_week_closeouts"
            referencedColumns: ["id"]
          },
        ]
      }
      time_week_closeouts: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          notes: string | null
          project_id: string | null
          reopened_at: string | null
          reopened_by: string | null
          status: string
          updated_at: string | null
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string | null
          week_end_date: string
          week_start_date: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string | null
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_week_closeouts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_week_closeouts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_ticket_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          is_taxable: boolean | null
          markup: number
          product_id: string | null
          quantity: number
          sort_order: number | null
          tm_ticket_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_taxable?: boolean | null
          markup?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          tm_ticket_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_taxable?: boolean | null
          markup?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          tm_ticket_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "tm_ticket_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_ticket_line_items_tm_ticket_id_fkey"
            columns: ["tm_ticket_id"]
            isOneToOne: false
            referencedRelation: "tm_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_tickets: {
        Row: {
          approval_token: string | null
          change_type: Database["public"]["Enums"]["change_type"]
          created_at: string
          created_by: string | null
          created_in_field: boolean | null
          customer_id: string
          customer_rep_email: string | null
          customer_rep_name: string | null
          customer_rep_title: string | null
          description: string | null
          id: string
          notes: string | null
          project_id: string
          purchase_order_id: string | null
          signature_data: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["tm_ticket_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          ticket_number: string
          total: number
          updated_at: string
          vendor_id: string | null
          work_date: string
        }
        Insert: {
          approval_token?: string | null
          change_type?: Database["public"]["Enums"]["change_type"]
          created_at?: string
          created_by?: string | null
          created_in_field?: boolean | null
          customer_id: string
          customer_rep_email?: string | null
          customer_rep_name?: string | null
          customer_rep_title?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          project_id: string
          purchase_order_id?: string | null
          signature_data?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["tm_ticket_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          ticket_number: string
          total?: number
          updated_at?: string
          vendor_id?: string | null
          work_date?: string
        }
        Update: {
          approval_token?: string | null
          change_type?: Database["public"]["Enums"]["change_type"]
          created_at?: string
          created_by?: string | null
          created_in_field?: boolean | null
          customer_id?: string
          customer_rep_email?: string | null
          customer_rep_name?: string | null
          customer_rep_title?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          purchase_order_id?: string | null
          signature_data?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["tm_ticket_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          ticket_number?: string
          total?: number
          updated_at?: string
          vendor_id?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_tickets_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_tickets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      typing_indicators: {
        Row: {
          conversation_id: string
          id: string
          started_at: string | null
          user_id: string
          user_name: string
          user_type: string
        }
        Insert: {
          conversation_id: string
          id?: string
          started_at?: string | null
          user_id: string
          user_name: string
          user_type: string
        }
        Update: {
          conversation_id?: string
          id?: string
          started_at?: string | null
          user_id?: string
          user_name?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_scope_items: {
        Row: {
          assigned_vendor_id: string | null
          created_at: string
          id: string
          jo_line_item_id: string
          notes: string | null
          quantity: number
          status: Database["public"]["Enums"]["unit_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          assigned_vendor_id?: string | null
          created_at?: string
          id?: string
          jo_line_item_id: string
          notes?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["unit_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          assigned_vendor_id?: string | null
          created_at?: string
          id?: string
          jo_line_item_id?: string
          notes?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["unit_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_scope_items_assigned_vendor_id_fkey"
            columns: ["assigned_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_scope_items_jo_line_item_id_fkey"
            columns: ["jo_line_item_id"]
            isOneToOne: false
            referencedRelation: "job_order_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_scope_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "project_units"
            referencedColumns: ["id"]
          },
        ]
      }
      user_display_preferences: {
        Row: {
          created_at: string
          id: string
          show_session_earnings: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          show_session_earnings?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          show_session_earnings?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_sensitive_permissions: {
        Row: {
          can_view_billing_rates: boolean | null
          can_view_cost_rates: boolean | null
          can_view_margins: boolean | null
          can_view_personnel_pay_rates: boolean | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_view_billing_rates?: boolean | null
          can_view_cost_rates?: boolean | null
          can_view_margins?: boolean | null
          can_view_personnel_pay_rates?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_view_billing_rates?: boolean | null
          can_view_cost_rates?: boolean | null
          can_view_margins?: boolean | null
          can_view_personnel_pay_rates?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_work_sessions: {
        Row: {
          clock_in_type: string | null
          created_at: string | null
          id: string
          idle_corrected_at: string | null
          idle_correction_version: number
          is_active: boolean | null
          session_end: string | null
          session_start: string
          total_active_seconds: number | null
          total_idle_seconds: number | null
          updated_at: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          clock_in_type?: string | null
          created_at?: string | null
          id?: string
          idle_corrected_at?: string | null
          idle_correction_version?: number
          is_active?: boolean | null
          session_end?: string | null
          session_start?: string
          total_active_seconds?: number | null
          total_idle_seconds?: number | null
          updated_at?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          clock_in_type?: string | null
          created_at?: string | null
          id?: string
          idle_corrected_at?: string | null
          idle_correction_version?: number
          is_active?: boolean | null
          session_end?: string | null
          session_start?: string
          total_active_seconds?: number | null
          total_idle_seconds?: number | null
          updated_at?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
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
          po_addendum_line_item_id: string | null
          po_line_item_id: string | null
          project_id: string | null
          qb_product_mapping_id: string | null
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
          po_addendum_line_item_id?: string | null
          po_line_item_id?: string | null
          project_id?: string | null
          qb_product_mapping_id?: string | null
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
          po_addendum_line_item_id?: string | null
          po_line_item_id?: string | null
          project_id?: string | null
          qb_product_mapping_id?: string | null
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
            foreignKeyName: "vendor_bill_line_items_po_addendum_line_item_id_fkey"
            columns: ["po_addendum_line_item_id"]
            isOneToOne: false
            referencedRelation: "po_addendum_line_items"
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
          {
            foreignKeyName: "vendor_bill_line_items_qb_product_mapping_id_fkey"
            columns: ["qb_product_mapping_id"]
            isOneToOne: false
            referencedRelation: "qb_product_service_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_bill_payment_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          payment_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          payment_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          payment_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bill_payment_attachments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "vendor_bill_payments"
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
          quickbooks_payment_id: string | null
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
          quickbooks_payment_id?: string | null
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
          quickbooks_payment_id?: string | null
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
          account: string | null
          bill_date: string
          class: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          due_date: string
          id: string
          location: string | null
          memo: string | null
          notes: string | null
          number: string
          paid_amount: number
          purchase_order_id: string | null
          purchase_order_number: string | null
          remaining_amount: number
          status: Database["public"]["Enums"]["vendor_bill_status"]
          submitted_at: string | null
          submitted_by_vendor: boolean | null
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
          vendor_id: string
          vendor_name: string
        }
        Insert: {
          account?: string | null
          bill_date: string
          class?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date: string
          id?: string
          location?: string | null
          memo?: string | null
          notes?: string | null
          number: string
          paid_amount?: number
          purchase_order_id?: string | null
          purchase_order_number?: string | null
          remaining_amount?: number
          status?: Database["public"]["Enums"]["vendor_bill_status"]
          submitted_at?: string | null
          submitted_by_vendor?: boolean | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          vendor_id: string
          vendor_name: string
        }
        Update: {
          account?: string | null
          bill_date?: string
          class?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string
          id?: string
          location?: string | null
          memo?: string | null
          notes?: string | null
          number?: string
          paid_amount?: number
          purchase_order_id?: string | null
          purchase_order_number?: string | null
          remaining_amount?: number
          status?: Database["public"]["Enums"]["vendor_bill_status"]
          submitted_at?: string | null
          submitted_by_vendor?: boolean | null
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
      vendor_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          status: string
          token: string
          vendor_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          status?: string
          token?: string
          vendor_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          status?: string
          token?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invitations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_onboarding_documents: {
        Row: {
          created_at: string | null
          document_type: string
          expiry_date: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          uploaded_at: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          document_type: string
          expiry_date?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_at?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          document_type?: string
          expiry_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_onboarding_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_onboarding_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used_at: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_onboarding_tokens_vendor_id_fkey"
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
          bank_account_number: string | null
          bank_account_type: string | null
          bank_name: string | null
          bank_routing_number: string | null
          billing_rate: number | null
          business_type: string | null
          citizenship_status: string | null
          city: string | null
          company: string | null
          contact_name: string | null
          contact_title: string | null
          created_at: string
          default_expense_category_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          id: string
          immigration_status: string | null
          insurance_expiry: string | null
          is_active: boolean | null
          itin: string | null
          license_number: string | null
          merge_reason: string | null
          merged_at: string | null
          merged_by: string | null
          merged_into_id: string | null
          name: string
          notes: string | null
          onboarding_completed_at: string | null
          onboarding_status: string | null
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
          user_id: string | null
          vendor_agreement_signature: string | null
          vendor_agreement_signed_at: string | null
          vendor_type: Database["public"]["Enums"]["vendor_type"]
          w9_on_file: boolean | null
          w9_signature: string | null
          w9_signed_at: string | null
          website: string | null
          years_in_business: number | null
          zip: string | null
        }
        Insert: {
          account_number?: string | null
          address?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          billing_rate?: number | null
          business_type?: string | null
          citizenship_status?: string | null
          city?: string | null
          company?: string | null
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string
          default_expense_category_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          id?: string
          immigration_status?: string | null
          insurance_expiry?: string | null
          is_active?: boolean | null
          itin?: string | null
          license_number?: string | null
          merge_reason?: string | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into_id?: string | null
          name: string
          notes?: string | null
          onboarding_completed_at?: string | null
          onboarding_status?: string | null
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
          user_id?: string | null
          vendor_agreement_signature?: string | null
          vendor_agreement_signed_at?: string | null
          vendor_type?: Database["public"]["Enums"]["vendor_type"]
          w9_on_file?: boolean | null
          w9_signature?: string | null
          w9_signed_at?: string | null
          website?: string | null
          years_in_business?: number | null
          zip?: string | null
        }
        Update: {
          account_number?: string | null
          address?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          billing_rate?: number | null
          business_type?: string | null
          citizenship_status?: string | null
          city?: string | null
          company?: string | null
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string
          default_expense_category_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          id?: string
          immigration_status?: string | null
          insurance_expiry?: string | null
          is_active?: boolean | null
          itin?: string | null
          license_number?: string | null
          merge_reason?: string | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into_id?: string | null
          name?: string
          notes?: string | null
          onboarding_completed_at?: string | null
          onboarding_status?: string | null
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
          user_id?: string | null
          vendor_agreement_signature?: string | null
          vendor_agreement_signed_at?: string | null
          vendor_type?: Database["public"]["Enums"]["vendor_type"]
          w9_on_file?: boolean | null
          w9_signature?: string | null
          w9_signed_at?: string | null
          website?: string | null
          years_in_business?: number | null
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
          {
            foreignKeyName: "vendors_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
      weekly_labor_invoice_sources: {
        Row: {
          created_at: string | null
          id: string
          project_labor_expense_id: string
          weekly_labor_invoice_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_labor_expense_id: string
          weekly_labor_invoice_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          project_labor_expense_id?: string
          weekly_labor_invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_labor_invoice_sources_project_labor_expense_id_fkey"
            columns: ["project_labor_expense_id"]
            isOneToOne: false
            referencedRelation: "project_labor_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_labor_invoice_sources_weekly_labor_invoice_id_fkey"
            columns: ["weekly_labor_invoice_id"]
            isOneToOne: false
            referencedRelation: "weekly_labor_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_labor_invoices: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          invoice_id: string
          project_id: string
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          invoice_id: string
          project_id: string
          week_end_date: string
          week_start_date: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          invoice_id?: string
          project_id?: string
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_labor_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_labor_invoices_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_labor_invoices_project_id_fkey"
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
      complete_personnel_onboarding: {
        Args: {
          p_address?: string
          p_bank_account_number?: string
          p_bank_account_type?: string
          p_bank_name?: string
          p_bank_routing_number?: string
          p_citizenship_status?: string
          p_city?: string
          p_date_of_birth?: string
          p_direct_deposit_signature?: string
          p_documents?: Json
          p_email: string
          p_emergency_contacts?: Json
          p_first_name: string
          p_ica_signature?: string
          p_immigration_status?: string
          p_last_name: string
          p_personnel_id: string
          p_phone?: string
          p_photo_url?: string
          p_ssn_full?: string
          p_state?: string
          p_tax_business_name?: string
          p_tax_classification?: string
          p_tax_ein?: string
          p_token: string
          p_w9_certification?: boolean
          p_w9_signature?: string
          p_zip?: string
        }
        Returns: Json
      }
      complete_vendor_onboarding: {
        Args: {
          p_address?: string
          p_bank_account_number?: string
          p_bank_account_type?: string
          p_bank_name?: string
          p_bank_routing_number?: string
          p_billing_rate?: number
          p_business_type?: string
          p_citizenship_status?: string
          p_city?: string
          p_company?: string
          p_contact_name?: string
          p_contact_title?: string
          p_email?: string
          p_immigration_status?: string
          p_itin?: string
          p_license_number?: string
          p_name: string
          p_payment_terms?: string
          p_phone?: string
          p_specialty?: string
          p_state?: string
          p_tax_id?: string
          p_token: string
          p_track_1099?: boolean
          p_vendor_agreement_signature?: string
          p_vendor_id: string
          p_w9_signature?: string
          p_website?: string
          p_years_in_business?: number
          p_zip?: string
        }
        Returns: Json
      }
      create_personnel_vendor: {
        Args: { p_personnel_id: string }
        Returns: string
      }
      expire_old_invitations: { Args: never; Returns: undefined }
      find_duplicate_customers: {
        Args: { p_customer_id: string }
        Returns: {
          duplicate_company: string
          duplicate_email: string
          duplicate_id: string
          duplicate_name: string
          duplicate_phone: string
          match_score: number
          match_type: string
        }[]
      }
      find_duplicate_personnel: {
        Args: { p_personnel_id: string }
        Returns: {
          duplicate_email: string
          duplicate_id: string
          duplicate_name: string
          duplicate_phone: string
          duplicate_ssn_last_four: string
          match_score: number
          match_type: string
        }[]
      }
      find_duplicate_vendors: {
        Args: { p_vendor_id: string }
        Returns: {
          duplicate_company: string
          duplicate_email: string
          duplicate_id: string
          duplicate_name: string
          duplicate_phone: string
          duplicate_tax_id: string
          match_score: number
          match_type: string
        }[]
      }
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
      generate_tm_ticket_number: {
        Args: { p_project_id: string }
        Returns: string
      }
      generate_vendor_bill_number: { Args: never; Returns: string }
      get_personnel_id_for_user: { Args: { _user_id: string }; Returns: string }
      get_vendor_id_for_user: { Args: { _user_id: string }; Returns: string }
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
      increment_unread_count: {
        Args: {
          p_conversation_id: string
          p_exclude_id: string
          p_exclude_type: string
        }
        Returns: undefined
      }
      is_personnel: { Args: { _user_id: string }; Returns: boolean }
      is_vendor: { Args: { _user_id: string }; Returns: boolean }
      reset_vendor_bill_sequence_for_new_year: {
        Args: never
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
      app_role:
        | "admin"
        | "manager"
        | "user"
        | "personnel"
        | "vendor"
        | "accounting"
      applicant_status: "new" | "approved" | "rejected" | "inactive"
      application_status:
        | "submitted"
        | "reviewing"
        | "approved"
        | "rejected"
        | "needs_info"
        | "updated"
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
      change_type: "additive" | "deductive"
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
      estimate_status: "draft" | "pending" | "approved" | "sent" | "closed"
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
      invoice_status: "draft" | "sent" | "partially_paid" | "paid" | "overdue"
      item_type: "product" | "service" | "labor"
      job_order_status: "active" | "in-progress" | "completed" | "on-hold"
      personnel_payment_type: "regular" | "bonus" | "reimbursement" | "advance"
      personnel_status: "active" | "inactive" | "do_not_hire"
      project_stage: "quote" | "task_order" | "active" | "complete" | "canceled"
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
      room_scope_status: "pending" | "in_progress" | "complete" | "verified"
      room_status: "not_started" | "in_progress" | "complete" | "verified"
      task_order_status: "draft" | "open" | "filled" | "closed"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
      tm_ticket_status:
        | "draft"
        | "pending_signature"
        | "signed"
        | "approved"
        | "invoiced"
        | "void"
      unit_status: "not_started" | "in_progress" | "complete" | "verified"
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
      app_role: [
        "admin",
        "manager",
        "user",
        "personnel",
        "vendor",
        "accounting",
      ],
      applicant_status: ["new", "approved", "rejected", "inactive"],
      application_status: [
        "submitted",
        "reviewing",
        "approved",
        "rejected",
        "needs_info",
        "updated",
      ],
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
      change_type: ["additive", "deductive"],
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
      estimate_status: ["draft", "pending", "approved", "sent", "closed"],
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
      invoice_status: ["draft", "sent", "partially_paid", "paid", "overdue"],
      item_type: ["product", "service", "labor"],
      job_order_status: ["active", "in-progress", "completed", "on-hold"],
      personnel_payment_type: ["regular", "bonus", "reimbursement", "advance"],
      personnel_status: ["active", "inactive", "do_not_hire"],
      project_stage: ["quote", "task_order", "active", "complete", "canceled"],
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
      room_scope_status: ["pending", "in_progress", "complete", "verified"],
      room_status: ["not_started", "in_progress", "complete", "verified"],
      task_order_status: ["draft", "open", "filled", "closed"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
      tm_ticket_status: [
        "draft",
        "pending_signature",
        "signed",
        "approved",
        "invoiced",
        "void",
      ],
      unit_status: ["not_started", "in_progress", "complete", "verified"],
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
