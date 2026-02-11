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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      checkout_log: {
        Row: {
          borrower_name: string
          checkout_condition_counts: Json | null
          checkout_date: string
          condition_on_return:
            | Database["public"]["Enums"]["equipment_condition"]
            | null
          created_at: string
          equipment_id: string
          expected_return: string | null
          id: string
          notes: string | null
          pin: string | null
          quantity: number
          quantity_returned: number
          return_date: string | null
          return_notes: string | null
          returned_by: string | null
          team_name: string | null
        }
        Insert: {
          borrower_name: string
          checkout_condition_counts?: Json | null
          checkout_date?: string
          condition_on_return?:
            | Database["public"]["Enums"]["equipment_condition"]
            | null
          created_at?: string
          equipment_id: string
          expected_return?: string | null
          id?: string
          notes?: string | null
          pin?: string | null
          quantity?: number
          quantity_returned?: number
          return_date?: string | null
          return_notes?: string | null
          returned_by?: string | null
          team_name?: string | null
        }
        Update: {
          borrower_name?: string
          checkout_condition_counts?: Json | null
          checkout_date?: string
          condition_on_return?:
            | Database["public"]["Enums"]["equipment_condition"]
            | null
          created_at?: string
          equipment_id?: string
          expected_return?: string | null
          id?: string
          notes?: string | null
          pin?: string | null
          quantity?: number
          quantity_returned?: number
          return_date?: string | null
          return_notes?: string | null
          returned_by?: string | null
          team_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_log_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          category: Database["public"]["Enums"]["equipment_category"]
          condition: Database["public"]["Enums"]["equipment_condition"]
          condition_counts: Json
          created_at: string
          id: string
          is_available: boolean
          is_retired: boolean
          name: string
          notes: string | null
          quantity_available: number
          total_quantity: number
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["equipment_category"]
          condition?: Database["public"]["Enums"]["equipment_condition"]
          condition_counts?: Json
          created_at?: string
          id?: string
          is_available?: boolean
          is_retired?: boolean
          name: string
          notes?: string | null
          quantity_available?: number
          total_quantity?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["equipment_category"]
          condition?: Database["public"]["Enums"]["equipment_condition"]
          condition_counts?: Json
          created_at?: string
          id?: string
          is_available?: boolean
          is_retired?: boolean
          name?: string
          notes?: string | null
          quantity_available?: number
          total_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
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
        Relationships: []
      }
    }
    Views: {
      checkout_log_public: {
        Row: {
          borrower_name: string | null
          checkout_condition_counts: Json | null
          checkout_date: string | null
          condition_on_return:
            | Database["public"]["Enums"]["equipment_condition"]
            | null
          created_at: string | null
          equipment_id: string | null
          expected_return: string | null
          id: string | null
          notes: string | null
          quantity: number | null
          quantity_returned: number | null
          return_date: string | null
          return_notes: string | null
          returned_by: string | null
          team_name: string | null
        }
        Insert: {
          borrower_name?: string | null
          checkout_condition_counts?: Json | null
          checkout_date?: string | null
          condition_on_return?:
            | Database["public"]["Enums"]["equipment_condition"]
            | null
          created_at?: string | null
          equipment_id?: string | null
          expected_return?: string | null
          id?: string | null
          notes?: string | null
          quantity?: number | null
          quantity_returned?: number | null
          return_date?: string | null
          return_notes?: string | null
          returned_by?: string | null
          team_name?: string | null
        }
        Update: {
          borrower_name?: string | null
          checkout_condition_counts?: Json | null
          checkout_date?: string | null
          condition_on_return?:
            | Database["public"]["Enums"]["equipment_condition"]
            | null
          created_at?: string | null
          equipment_id?: string | null
          expected_return?: string | null
          id?: string | null
          notes?: string | null
          quantity?: number | null
          quantity_returned?: number | null
          return_date?: string | null
          return_notes?: string | null
          returned_by?: string | null
          team_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_log_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "master_admin"
      equipment_category:
        | "audio"
        | "video"
        | "lighting"
        | "presentation"
        | "cables_accessories"
        | "other"
      equipment_condition: "excellent" | "good" | "fair" | "damaged" | "bad"
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
      app_role: ["admin", "master_admin"],
      equipment_category: [
        "audio",
        "video",
        "lighting",
        "presentation",
        "cables_accessories",
        "other",
      ],
      equipment_condition: ["excellent", "good", "fair", "damaged", "bad"],
    },
  },
} as const
