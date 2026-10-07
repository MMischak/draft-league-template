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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      draft_picks: {
        Row: {
          id: string
          league_id: string
          manager_id: string
          overall_pick: number
          picked_at: string
          player_id: string
        }
        Insert: {
          id?: string
          league_id: string
          manager_id: string
          overall_pick: number
          picked_at?: string
          player_id: string
        }
        Update: {
          id?: string
          league_id?: string
          manager_id?: string
          overall_pick?: number
          picked_at?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_picks_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          league_id: string
          manager_id: string
          suggestion_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          league_id: string
          manager_id: string
          suggestion_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          league_id?: string
          manager_id?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_comments_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_comments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_comments_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "feature_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_suggestions: {
        Row: {
          author_id: string
          completed_at: string | null
          created_at: string
          description: string
          id: string
          league_id: string
          title: string
        }
        Insert: {
          author_id: string
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          league_id: string
          title: string
        }
        Update: {
          author_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          league_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_suggestions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_suggestions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_votes: {
        Row: {
          created_at: string
          league_id: string
          manager_id: string
          suggestion_id: string
        }
        Insert: {
          created_at?: string
          league_id: string
          manager_id: string
          suggestion_id: string
        }
        Update: {
          created_at?: string
          league_id?: string
          manager_id?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_votes_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_votes_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "feature_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_provider_mappings: {
        Row: {
          external_id: number
          fixture_id: string
          league_id: string
          matched_at: string
          provider: string
        }
        Insert: {
          external_id: number
          fixture_id: string
          league_id: string
          matched_at?: string
          provider: string
        }
        Update: {
          external_id?: number
          fixture_id?: string
          league_id?: string
          matched_at?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_provider_mappings_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_provider_mappings_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      fixtures: {
        Row: {
          away_club_code: string
          away_score: number | null
          finished: boolean
          gameweek_id: string
          home_club_code: string
          home_score: number | null
          id: string
          kickoff_at: string
          league_id: string
          provider_id: number
          started: boolean
        }
        Insert: {
          away_club_code: string
          away_score?: number | null
          finished?: boolean
          gameweek_id: string
          home_club_code: string
          home_score?: number | null
          id?: string
          kickoff_at: string
          league_id: string
          provider_id: number
          started?: boolean
        }
        Update: {
          away_club_code?: string
          away_score?: number | null
          finished?: boolean
          gameweek_id?: string
          home_club_code?: string
          home_score?: number | null
          id?: string
          kickoff_at?: string
          league_id?: string
          provider_id?: number
          started?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_gameweek_id_fkey"
            columns: ["gameweek_id"]
            isOneToOne: false
            referencedRelation: "gameweeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      gameweeks: {
        Row: {
          finalize_at: string | null
          first_kickoff_at: string | null
          id: string
          league_id: string
          lineup_lock_at: string | null
          number: number
          status: string
        }
        Insert: {
          finalize_at?: string | null
          first_kickoff_at?: string | null
          id?: string
          league_id: string
          lineup_lock_at?: string | null
          number: number
          status?: string
        }
        Update: {
          finalize_at?: string | null
          first_kickoff_at?: string | null
          id?: string
          league_id?: string
          lineup_lock_at?: string | null
          number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gameweeks_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          id: string
          name: string
          season_label: string
          transfer_closes_at: string | null
          transfer_opens_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          season_label: string
          transfer_closes_at?: string | null
          transfer_opens_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          season_label?: string
          transfer_closes_at?: string | null
          transfer_opens_at?: string | null
        }
        Relationships: []
      }
      lineup_players: {
        Row: {
          is_starter: boolean
          lineup_id: string
          player_id: string
        }
        Insert: {
          is_starter: boolean
          lineup_id: string
          player_id: string
        }
        Update: {
          is_starter?: boolean
          lineup_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineup_players_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      lineups: {
        Row: {
          gameweek_id: string
          id: string
          league_id: string
          manager_id: string
          saved_at: string
        }
        Insert: {
          gameweek_id: string
          id?: string
          league_id: string
          manager_id: string
          saved_at?: string
        }
        Update: {
          gameweek_id?: string
          id?: string
          league_id?: string
          manager_id?: string
          saved_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineups_gameweek_id_fkey"
            columns: ["gameweek_id"]
            isOneToOne: false
            referencedRelation: "gameweeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_gameweek_scores: {
        Row: {
          gameweek_id: string
          is_final: boolean
          league_id: string
          manager_id: string
          score: number
        }
        Insert: {
          gameweek_id: string
          is_final?: boolean
          league_id: string
          manager_id: string
          score?: number
        }
        Update: {
          gameweek_id?: string
          is_final?: boolean
          league_id?: string
          manager_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "manager_gameweek_scores_gameweek_id_fkey"
            columns: ["gameweek_id"]
            isOneToOne: false
            referencedRelation: "gameweeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_gameweek_scores_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_gameweek_scores_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      managers: {
        Row: {
          display_name: string
          draft_position: number
          id: string
          is_commissioner: boolean
          league_id: string
          transfer_usage: number
        }
        Insert: {
          display_name: string
          draft_position: number
          id: string
          is_commissioner?: boolean
          league_id: string
          transfer_usage?: number
        }
        Update: {
          display_name?: string
          draft_position?: number
          id?: string
          is_commissioner?: boolean
          league_id?: string
          transfer_usage?: number
        }
        Relationships: [
          {
            foreignKeyName: "managers_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      player_match_ratings: {
        Row: {
          gameweek_id: string
          id: string
          league_id: string
          observed_at: string
          player_id: string
          provider: string
          provider_match_id: number
          rating: number | null
        }
        Insert: {
          gameweek_id: string
          id?: string
          league_id: string
          observed_at?: string
          player_id: string
          provider?: string
          provider_match_id: number
          rating?: number | null
        }
        Update: {
          gameweek_id?: string
          id?: string
          league_id?: string
          observed_at?: string
          player_id?: string
          provider?: string
          provider_match_id?: number
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_match_ratings_gameweek_id_fkey"
            columns: ["gameweek_id"]
            isOneToOne: false
            referencedRelation: "gameweeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_match_ratings_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_match_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_provider_mappings: {
        Row: {
          external_id: number
          external_name: string | null
          league_id: string
          matched_at: string
          player_id: string
          provider: string
        }
        Insert: {
          external_id: number
          external_name?: string | null
          league_id: string
          matched_at?: string
          player_id: string
          provider: string
        }
        Update: {
          external_id?: number
          external_name?: string | null
          league_id?: string
          matched_at?: string
          player_id?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_provider_mappings_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_provider_mappings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          availability_status: string
          club_code: string
          display_name: string
          id: string
          injury_note: string | null
          injury_updated_at: string | null
          is_injured: boolean
          league_id: string
          owner_id: string | null
          position: string
          provider_id: number | null
        }
        Insert: {
          availability_status?: string
          club_code: string
          display_name: string
          id?: string
          injury_note?: string | null
          injury_updated_at?: string | null
          is_injured?: boolean
          league_id: string
          owner_id?: string | null
          position: string
          provider_id?: number | null
        }
        Update: {
          availability_status?: string
          club_code?: string
          display_name?: string
          id?: string
          injury_note?: string | null
          injury_updated_at?: string | null
          is_injured?: boolean
          league_id?: string
          owner_id?: string | null
          position?: string
          provider_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_import_runs: {
        Row: {
          error_summary: string | null
          finished_at: string | null
          fixture_count: number
          gameweek_id: string
          id: string
          imported_count: number
          league_id: string
          missing_mapping_count: number
          provider: string
          started_at: string
          started_by: string
          status: string
        }
        Insert: {
          error_summary?: string | null
          finished_at?: string | null
          fixture_count?: number
          gameweek_id: string
          id?: string
          imported_count?: number
          league_id: string
          missing_mapping_count?: number
          provider: string
          started_at?: string
          started_by: string
          status: string
        }
        Update: {
          error_summary?: string | null
          finished_at?: string | null
          fixture_count?: number
          gameweek_id?: string
          id?: string
          imported_count?: number
          league_id?: string
          missing_mapping_count?: number
          provider?: string
          started_at?: string
          started_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_import_runs_gameweek_id_fkey"
            columns: ["gameweek_id"]
            isOneToOne: false
            referencedRelation: "gameweeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_import_runs_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_import_runs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          created_at: string
          id: string
          league_id: string
          offered_player_id: string
          proposer_id: string
          recipient_id: string
          requested_player_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          offered_player_id: string
          proposer_id: string
          recipient_id: string
          requested_player_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          offered_player_id?: string
          proposer_id?: string
          recipient_id?: string
          requested_player_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_offered_player_id_fkey"
            columns: ["offered_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_proposer_id_fkey"
            columns: ["proposer_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_requested_player_id_fkey"
            columns: ["requested_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_availability_import: {
        Args: { p_availability: Json; p_league_id: string }
        Returns: number
      }
      apply_rating_import: {
        Args: {
          p_error_summary: string | null
          p_fixture_count: number
          p_fixture_mappings: Json
          p_imported_count: number
          p_missing_mapping_count: number
          p_player_mappings: Json
          p_ratings: Json
          p_run_id: string
          p_status: string
        }
        Returns: number
      }
      current_league_id: { Args: never; Returns: string }
      get_season_statistics: { Args: never; Returns: Json }
      make_draft_pick: {
        Args: { p_player_id: string }
        Returns: {
          id: string
          league_id: string
          manager_id: string
          overall_pick: number
          picked_at: string
          player_id: string
        }
        SetofOptions: {
          from: "*"
          to: "draft_picks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_lineup: {
        Args: { p_gameweek_id: string; p_player_ids: string[] }
        Returns: {
          gameweek_id: string
          id: string
          league_id: string
          manager_id: string
          saved_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lineups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_draft_order: {
        Args: { p_manager_ids: string[] }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
