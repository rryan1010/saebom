export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_usage: {
        Row: {
          calls: number;
          day: string;
        };
        ComputedFields: never;
        Insert: {
          calls?: number;
          day: string;
        };
        Update: {
          calls?: number;
          day?: string;
        };
        Relationships: [];
      };
      audit_events: {
        Row: {
          action: string;
          actor: string | null;
          created_at: string;
          details: NonNullable<Json>;
          id: number;
          subject: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          subject?: string | null;
        };
        Update: {
          action?: string;
          actor?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          subject?: string | null;
        };
        Relationships: [];
      };
      coach_suggestions: {
        Row: {
          changes: NonNullable<Json>;
          checker_log: NonNullable<Json>;
          created_at: string;
          id: number;
          status: string;
          user_id: string;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          changes: NonNullable<Json>;
          checker_log?: NonNullable<Json>;
          created_at?: string;
          id?: never;
          status?: string;
          user_id: string;
          week_start: string;
        };
        Update: {
          changes?: NonNullable<Json>;
          checker_log?: NonNullable<Json>;
          created_at?: string;
          id?: never;
          status?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      consents: {
        Row: {
          created_at: string;
          granted: boolean;
          id: number;
          kind: string;
          policy_version: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          granted: boolean;
          id?: never;
          kind: string;
          policy_version: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted?: boolean;
          id?: never;
          kind?: string;
          policy_version?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          allowed_swaps: string[];
          cues: string[];
          equipment: string[];
          increment_lb: number;
          is_main_lift: boolean;
          min_load_lb: number;
          movement_pattern: string;
          muscle_great: string;
          muscle_light: string | null;
          name: string;
          regions_great: string[];
          regions_light: string[];
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          allowed_swaps?: string[];
          cues: string[];
          equipment: string[];
          increment_lb: number;
          is_main_lift?: boolean;
          min_load_lb: number;
          movement_pattern: string;
          muscle_great: string;
          muscle_light?: string | null;
          name: string;
          regions_great?: string[];
          regions_light?: string[];
          slug: string;
        };
        Update: {
          allowed_swaps?: string[];
          cues?: string[];
          equipment?: string[];
          increment_lb?: number;
          is_main_lift?: boolean;
          min_load_lb?: number;
          movement_pattern?: string;
          muscle_great?: string;
          muscle_light?: string | null;
          name?: string;
          regions_great?: string[];
          regions_light?: string[];
          slug?: string;
        };
        Relationships: [];
      };
      invites: {
        Row: {
          created_at: string;
          email: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
        };
        Update: {
          created_at?: string;
          email?: string;
        };
        Relationships: [];
      };
      lighter_weeks: {
        Row: {
          source: string;
          user_id: string;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          source: string;
          user_id: string;
          week_start: string;
        };
        Update: {
          source?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      next_targets: {
        Row: {
          below_range_streak: number;
          exercise_slug: string;
          rep_max: number;
          rep_min: number;
          rir: number;
          target_weight_lb: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          below_range_streak?: number;
          exercise_slug: string;
          rep_max: number;
          rep_min: number;
          rir: number;
          target_weight_lb?: number | null;
          user_id: string;
        };
        Update: {
          below_range_streak?: number;
          exercise_slug?: string;
          rep_max?: number;
          rep_min?: number;
          rir?: number;
          target_weight_lb?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'next_targets_exercise_slug_fkey';
            columns: ['exercise_slug'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['slug'];
          },
        ];
      };
      plan_items: {
        Row: {
          day_label: string;
          exercise_slug: string;
          id: number;
          is_light: boolean;
          plan_id: number;
          position: number;
          rep_max: number;
          rep_min: number;
          rir: number;
          sets: number;
          start_weight_lb: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          day_label: string;
          exercise_slug: string;
          id?: never;
          is_light?: boolean;
          plan_id: number;
          position: number;
          rep_max: number;
          rep_min: number;
          rir: number;
          sets: number;
          start_weight_lb?: number | null;
          user_id: string;
        };
        Update: {
          day_label?: string;
          exercise_slug?: string;
          id?: never;
          is_light?: boolean;
          plan_id?: number;
          position?: number;
          rep_max?: number;
          rep_min?: number;
          rir?: number;
          sets?: number;
          start_weight_lb?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_items_exercise_slug_fkey';
            columns: ['exercise_slug'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'plan_items_plan_id_user_id_fkey';
            columns: ['plan_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      plans: {
        Row: {
          created_at: string;
          id: number;
          source: string;
          status: string;
          user_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: never;
          source: string;
          status: string;
          user_id: string;
          version: number;
        };
        Update: {
          created_at?: string;
          id?: never;
          source?: string;
          status?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          adult_confirmed_at: string | null;
          avoid_areas: string[];
          created_at: string;
          days_per_week: number | null;
          equipment: string | null;
          experience: string | null;
          goal_intensity: string | null;
          id: string;
          light_ack_at: string | null;
          light_areas: string[];
          readiness_ack_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          adult_confirmed_at?: string | null;
          avoid_areas?: string[];
          created_at?: string;
          days_per_week?: number | null;
          equipment?: string | null;
          experience?: string | null;
          goal_intensity?: string | null;
          id: string;
          light_ack_at?: string | null;
          light_areas?: string[];
          readiness_ack_at?: string | null;
        };
        Update: {
          adult_confirmed_at?: string | null;
          avoid_areas?: string[];
          created_at?: string;
          days_per_week?: number | null;
          equipment?: string | null;
          experience?: string | null;
          goal_intensity?: string | null;
          id?: string;
          light_ack_at?: string | null;
          light_areas?: string[];
          readiness_ack_at?: string | null;
        };
        Relationships: [];
      };
      rep_records: {
        Row: {
          achieved_at: string;
          best_reps: number;
          exercise_slug: string;
          user_id: string;
          weight_lb: number;
        };
        ComputedFields: never;
        Insert: {
          achieved_at: string;
          best_reps: number;
          exercise_slug: string;
          user_id: string;
          weight_lb: number;
        };
        Update: {
          achieved_at?: string;
          best_reps?: number;
          exercise_slug?: string;
          user_id?: string;
          weight_lb?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'rep_records_exercise_slug_fkey';
            columns: ['exercise_slug'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['slug'];
          },
        ];
      };
      set_logs: {
        Row: {
          effort: number | null;
          exercise_slug: string;
          id: number;
          reps: number;
          session_id: number;
          set_index: number;
          user_id: string;
          weight_lb: number;
        };
        ComputedFields: never;
        Insert: {
          effort?: number | null;
          exercise_slug: string;
          id?: never;
          reps: number;
          session_id: number;
          set_index: number;
          user_id: string;
          weight_lb: number;
        };
        Update: {
          effort?: number | null;
          exercise_slug?: string;
          id?: never;
          reps?: number;
          session_id?: number;
          set_index?: number;
          user_id?: string;
          weight_lb?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'set_logs_exercise_slug_fkey';
            columns: ['exercise_slug'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'set_logs_session_id_user_id_fkey';
            columns: ['session_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workout_sessions';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      workout_sessions: {
        Row: {
          client_id: string;
          day_label: string;
          duration_s: number;
          ended_at: string;
          id: number;
          plan_id: number;
          started_at: string;
          user_id: string;
          utc_offset_min: number;
          went_lighter: boolean;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          day_label: string;
          duration_s: number;
          ended_at: string;
          id?: never;
          plan_id: number;
          started_at: string;
          user_id: string;
          utc_offset_min: number;
          went_lighter?: boolean;
        };
        Update: {
          client_id?: string;
          day_label?: string;
          duration_s?: number;
          ended_at?: string;
          id?: never;
          plan_id?: number;
          started_at?: string;
          user_id?: string;
          utc_offset_min?: number;
          went_lighter?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_sessions_plan_id_user_id_fkey';
            columns: ['plan_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
    };
    Views: {
      e1rm_by_week: {
        Row: {
          e1rm_lb: number | null;
          exercise_slug: string;
          user_id: string;
          week_start: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'set_logs_exercise_slug_fkey';
            columns: ['exercise_slug'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['slug'];
          },
        ];
      };
    };
    Functions: {
      record_session: {
        Args: {
          p_client_id: string;
          p_day_label: string;
          p_ended_at: string;
          p_plan_id: number;
          p_sets: Json;
          p_started_at: string;
          p_user_id: string;
          p_utc_offset_min: number;
          p_went_lighter: boolean;
        };
        Returns: Record<string, unknown>;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
