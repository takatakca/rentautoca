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
      availability_blocks: {
        Row: {
          car_id: string
          created_at: string
          end_at: string
          id: string
          start_at: string
          type: string
        }
        Insert: {
          car_id: string
          created_at?: string
          end_at: string
          id?: string
          start_at: string
          type?: string
        }
        Update: {
          car_id?: string
          created_at?: string
          end_at?: string
          id?: string
          start_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_policies: {
        Row: {
          created_at: string
          id: string
          name: string
          rules: Json
          summary: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          rules?: Json
          summary: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          rules?: Json
          summary?: string
        }
        Relationships: []
      }
      car_extras: {
        Row: {
          car_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_qty: number
          name: string
          price_cents: number
          pricing_type: string
        }
        Insert: {
          car_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_qty?: number
          name: string
          price_cents?: number
          pricing_type?: string
        }
        Update: {
          car_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_qty?: number
          name?: string
          price_cents?: number
          pricing_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_extras_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      car_photos: {
        Row: {
          car_id: string
          created_at: string
          id: string
          sort_order: number
          url: string
        }
        Insert: {
          car_id: string
          created_at?: string
          id?: string
          sort_order?: number
          url: string
        }
        Update: {
          car_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_photos_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      car_policies: {
        Row: {
          cancellation_policy_id: string
          car_id: string
        }
        Insert: {
          cancellation_policy_id: string
          car_id: string
        }
        Update: {
          cancellation_policy_id?: string
          car_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_policies_cancellation_policy_id_fkey"
            columns: ["cancellation_policy_id"]
            isOneToOne: false
            referencedRelation: "cancellation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_policies_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      cars: {
        Row: {
          airport_pickup_enabled: boolean
          base_daily_price_cents: number
          body_type: string | null
          category: string
          consumption_l_per_100km: number | null
          created_at: string
          currency: string
          description: string | null
          doors: number
          extra_km_price_cents: number
          features: Json | null
          fuel_type: string
          host_id: string
          id: string
          included_km_per_day: number
          instant_book: boolean
          insurance_status: string
          insurance_url: string | null
          lat: number | null
          lng: number | null
          location_label: string | null
          make: string
          model: string
          monthly_enabled: boolean
          plate_number: string | null
          registration_url: string | null
          rules: Json | null
          seats: number
          status: string
          title: string
          tracking_consent_required: boolean
          transmission: string
          trim: string | null
          updated_at: string
          vin: string | null
          year: number
        }
        Insert: {
          airport_pickup_enabled?: boolean
          base_daily_price_cents?: number
          body_type?: string | null
          category?: string
          consumption_l_per_100km?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          doors?: number
          extra_km_price_cents?: number
          features?: Json | null
          fuel_type?: string
          host_id: string
          id?: string
          included_km_per_day?: number
          instant_book?: boolean
          insurance_status?: string
          insurance_url?: string | null
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          make?: string
          model?: string
          monthly_enabled?: boolean
          plate_number?: string | null
          registration_url?: string | null
          rules?: Json | null
          seats?: number
          status?: string
          title?: string
          tracking_consent_required?: boolean
          transmission?: string
          trim?: string | null
          updated_at?: string
          vin?: string | null
          year?: number
        }
        Update: {
          airport_pickup_enabled?: boolean
          base_daily_price_cents?: number
          body_type?: string | null
          category?: string
          consumption_l_per_100km?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          doors?: number
          extra_km_price_cents?: number
          features?: Json | null
          fuel_type?: string
          host_id?: string
          id?: string
          included_km_per_day?: number
          instant_book?: boolean
          insurance_status?: string
          insurance_url?: string | null
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          make?: string
          model?: string
          monthly_enabled?: boolean
          plate_number?: string | null
          registration_url?: string | null
          rules?: Json | null
          seats?: number
          status?: string
          title?: string
          tracking_consent_required?: boolean
          transmission?: string
          trim?: string | null
          updated_at?: string
          vin?: string | null
          year?: number
        }
        Relationships: []
      }
      favorites: {
        Row: {
          car_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          car_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          car_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      host_preferences: {
        Row: {
          advance_notice_hours: number | null
          buffer_hours: number | null
          created_at: string
          delivery_available: boolean | null
          delivery_fee_cents: number | null
          delivery_radius_km: number | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          max_trip_days: number | null
          min_trip_days: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          advance_notice_hours?: number | null
          buffer_hours?: number | null
          created_at?: string
          delivery_available?: boolean | null
          delivery_fee_cents?: number | null
          delivery_radius_km?: number | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          max_trip_days?: number | null
          min_trip_days?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          advance_notice_hours?: number | null
          buffer_hours?: number | null
          created_at?: string
          delivery_available?: boolean | null
          delivery_fee_cents?: number | null
          delivery_radius_km?: number | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          max_trip_days?: number | null
          min_trip_days?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      host_verifications: {
        Row: {
          created_at: string
          id: string
          id_back_url: string | null
          id_front_url: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
          selfie_url: string | null
          updated_at: string
          user_id: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          selfie_url?: string | null
          updated_at?: string
          user_id: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          selfie_url?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          id_verified: boolean
          is_all_star: boolean
          last_name: string | null
          phone: string | null
          phone_verified: boolean
          postal_code: string | null
          province: string | null
          rating_avg: number | null
          trips_count: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id: string
          id_verified?: boolean
          is_all_star?: boolean
          last_name?: string | null
          phone?: string | null
          phone_verified?: boolean
          postal_code?: string | null
          province?: string | null
          rating_avg?: number | null
          trips_count?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          id_verified?: boolean
          is_all_star?: boolean
          last_name?: string | null
          phone?: string | null
          phone_verified?: boolean
          postal_code?: string | null
          province?: string | null
          rating_avg?: number | null
          trips_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_province_fkey"
            columns: ["province"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["code"]
          },
        ]
      }
      protection_plans: {
        Row: {
          coverage_details: Json
          created_at: string
          deductible_cents: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_per_day_cents: number
          sort_order: number
          tier: string
        }
        Insert: {
          coverage_details?: Json
          created_at?: string
          deductible_cents?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_per_day_cents?: number
          sort_order?: number
          tier: string
        }
        Update: {
          coverage_details?: Json
          created_at?: string
          deductible_cents?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_per_day_cents?: number
          sort_order?: number
          tier?: string
        }
        Relationships: []
      }
      provinces: {
        Row: {
          code: string
          is_supported: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          is_supported?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_supported?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      reviews: {
        Row: {
          car_id: string
          comment: string | null
          created_at: string
          id: string
          rating_accuracy: number | null
          rating_cleanliness: number | null
          rating_communication: number | null
          rating_convenience: number | null
          rating_maintenance: number | null
          rating_overall: number
          reviewer_id: string
          trip_id: string | null
        }
        Insert: {
          car_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating_accuracy?: number | null
          rating_cleanliness?: number | null
          rating_communication?: number | null
          rating_convenience?: number | null
          rating_maintenance?: number | null
          rating_overall: number
          reviewer_id: string
          trip_id?: string | null
        }
        Update: {
          car_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating_accuracy?: number | null
          rating_cleanliness?: number | null
          rating_communication?: number | null
          rating_convenience?: number | null
          rating_maintenance?: number | null
          rating_overall?: number
          reviewer_id?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_accounts: {
        Row: {
          charges_enabled: boolean
          created_at: string
          id: string
          onboarded_at: string | null
          payouts_enabled: boolean
          stripe_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          id?: string
          onboarded_at?: string | null
          payouts_enabled?: boolean
          stripe_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          id?: string
          onboarded_at?: string | null
          payouts_enabled?: boolean
          stripe_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      trip_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          payload_json: Json
          trip_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload_json?: Json
          trip_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload_json?: Json
          trip_id?: string
        }
        Relationships: []
      }
      trip_incidents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          photo_urls: string[]
          reporter_user_id: string
          status: string
          trip_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          photo_urls?: string[]
          reporter_user_id: string
          status?: string
          trip_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          photo_urls?: string[]
          reporter_user_id?: string
          status?: string
          trip_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      trip_tracking_sessions: {
        Row: {
          car_id: string
          consent_accepted_at: string | null
          created_at: string
          ended_at: string | null
          guest_id: string
          host_id: string
          id: string
          started_at: string | null
          status: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          car_id: string
          consent_accepted_at?: string | null
          created_at?: string
          ended_at?: string | null
          guest_id: string
          host_id: string
          id?: string
          started_at?: string | null
          status?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          car_id?: string
          consent_accepted_at?: string | null
          created_at?: string
          ended_at?: string | null
          guest_id?: string
          host_id?: string
          id?: string
          started_at?: string | null
          status?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          car_id: string
          created_at: string
          currency: string
          end_at: string
          guest_id: string
          id: string
          pickup_location: string | null
          pricing_breakdown: Json | null
          return_location: string | null
          start_at: string
          status: string
          total_cents: number | null
          updated_at: string
        }
        Insert: {
          car_id: string
          created_at?: string
          currency?: string
          end_at: string
          guest_id: string
          id?: string
          pickup_location?: string | null
          pricing_breakdown?: Json | null
          return_location?: string | null
          start_at: string
          status?: string
          total_cents?: number | null
          updated_at?: string
        }
        Update: {
          car_id?: string
          created_at?: string
          currency?: string
          end_at?: string
          guest_id?: string
          id?: string
          pickup_location?: string | null
          pricing_breakdown?: Json | null
          return_location?: string | null
          start_at?: string
          status?: string
          total_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
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
        Relationships: []
      }
      vehicle_location_events: {
        Row: {
          accuracy_meters: number | null
          car_id: string
          created_at: string
          heading: number | null
          id: string
          lat: number
          lng: number
          recorded_at: string
          source: string
          speed_kmh: number | null
          trip_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          car_id: string
          created_at?: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          source?: string
          speed_kmh?: number | null
          trip_id: string
        }
        Update: {
          accuracy_meters?: number | null
          car_id?: string
          created_at?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          source?: string
          speed_kmh?: number | null
          trip_id?: string
        }
        Relationships: []
      }
      vehicle_tracking_devices: {
        Row: {
          car_id: string
          created_at: string
          device_identifier: string
          id: string
          installed_at: string
          last_seen_at: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          car_id: string
          created_at?: string
          device_identifier: string
          id?: string
          installed_at?: string
          last_seen_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Update: {
          car_id?: string
          created_at?: string
          device_identifier?: string
          id?: string
          installed_at?: string
          last_seen_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          first_name: string | null
          id: string | null
          is_all_star: boolean | null
          rating_avg: number | null
          trips_count: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string | null
          is_all_star?: boolean | null
          rating_avg?: number | null
          trips_count?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string | null
          is_all_star?: boolean | null
          rating_avg?: number | null
          trips_count?: number | null
        }
        Relationships: []
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
    }
    Enums: {
      app_role: "guest" | "host" | "admin"
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
      app_role: ["guest", "host", "admin"],
    },
  },
} as const
