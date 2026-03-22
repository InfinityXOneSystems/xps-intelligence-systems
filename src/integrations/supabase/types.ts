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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          body: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          scheduled_at: string | null
          subject: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          scheduled_at?: string | null
          subject?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          scheduled_at?: string | null
          subject?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          city: string | null
          company_name: string
          contact_name: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          email: string | null
          estimated_value: number | null
          id: string
          location: string | null
          location_id: string | null
          metadata: Json | null
          notes: string | null
          phone: string | null
          score: number | null
          source: string | null
          stage: string
          state: string | null
          updated_at: string | null
          vertical: string | null
          website: string | null
        }
        Insert: {
          assigned_to?: string | null
          city?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          location?: string | null
          location_id?: string | null
          metadata?: Json | null
          notes?: string | null
          phone?: string | null
          score?: number | null
          source?: string | null
          stage?: string
          state?: string | null
          updated_at?: string | null
          vertical?: string | null
          website?: string | null
        }
        Update: {
          assigned_to?: string | null
          city?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          location?: string | null
          location_id?: string | null
          metadata?: Json | null
          notes?: string | null
          phone?: string | null
          score?: number | null
          source?: string | null
          stage?: string
          state?: string | null
          updated_at?: string | null
          vertical?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          city: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          owner_id: string | null
          phone: string | null
          state: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          owner_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          division: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          job_title: string | null
          location_id: string | null
          metadata: Json | null
          onboarding_complete: boolean | null
          phone: string | null
          role: string
          specialty: string[] | null
          territory: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          division?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          job_title?: string | null
          location_id?: string | null
          metadata?: Json | null
          onboarding_complete?: boolean | null
          phone?: string | null
          role?: string
          specialty?: string[] | null
          territory?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          division?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          location_id?: string | null
          metadata?: Json | null
          onboarding_complete?: boolean | null
          phone?: string | null
          role?: string
          specialty?: string[] | null
          territory?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          created_at: string | null
          created_by: string | null
          decided_at: string | null
          expires_at: string | null
          id: string
          lead_id: string | null
          line_items: Json | null
          metadata: Json | null
          notes: string | null
          sent_at: string | null
          status: string
          title: string
          total_value: number | null
          updated_at: string | null
          viewed_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          decided_at?: string | null
          expires_at?: string | null
          id?: string
          lead_id?: string | null
          line_items?: Json | null
          metadata?: Json | null
          notes?: string | null
          sent_at?: string | null
          status?: string
          title: string
          total_value?: number | null
          updated_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          decided_at?: string | null
          expires_at?: string | null
          id?: string
          lead_id?: string | null
          line_items?: Json | null
          metadata?: Json | null
          notes?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          total_value?: number | null
          updated_at?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "manager"
        | "owner"
        | "sales_staff"
        | "employee"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "manager",
        "owner",
        "sales_staff",
        "employee",
      ],
    },
  },
} as const
