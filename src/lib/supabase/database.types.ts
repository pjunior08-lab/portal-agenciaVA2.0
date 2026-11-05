// Gerado a partir do banco (Supabase) — regenerar após cada migração.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type AppRole = "admin" | "colaborador";
type MemberStatus = "ativo" | "desativado";
type AccessLevel = "ver" | "editar";

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      agencies: {
        Row: {
          address: string | null;
          cnpj: string | null;
          created_at: string;
          email: string | null;
          id: string;
          legal_name: string | null;
          logo_path: string | null;
          name: string;
          phone: string | null;
          pix_key: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          cnpj?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          legal_name?: string | null;
          logo_path?: string | null;
          name: string;
          phone?: string | null;
          pix_key?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agencies"]["Insert"]>;
        Relationships: [];
      };
      agency_members: {
        Row: {
          agency_id: string;
          created_at: string;
          role: AppRole;
          status: MemberStatus;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          agency_id: string;
          created_at?: string;
          role?: AppRole;
          status?: MemberStatus;
          updated_at?: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["agency_members"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          agency_id: string | null;
          created_at: string;
          data: Json;
          entity: string | null;
          entity_id: string | null;
          id: number;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          agency_id?: string | null;
          created_at?: string;
          data?: Json;
          entity?: string | null;
          entity_id?: string | null;
          id?: never;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          agency_id: string;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          module_access: Json;
          revoked_at: string | null;
          role: AppRole;
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          agency_id: string;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          module_access?: Json;
          revoked_at?: string | null;
          role?: AppRole;
          token_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["invitations"]["Insert"]>;
        Relationships: [];
      };
      member_module_access: {
        Row: { agency_id: string; level: AccessLevel; module: string; user_id: string };
        Insert: { agency_id: string; level?: AccessLevel; module: string; user_id: string };
        Update: Partial<Database["public"]["Tables"]["member_module_access"]["Insert"]>;
        Relationships: [];
      };
      member_preferences: {
        Row: { finance_emails: boolean; sidebar: Json; updated_at: string; user_id: string };
        Insert: { finance_emails?: boolean; sidebar?: Json; updated_at?: string; user_id: string };
        Update: Partial<Database["public"]["Tables"]["member_preferences"]["Insert"]>;
        Relationships: [];
      };
      modules: {
        Row: { always_allowed: boolean; label: string; position: number; slug: string };
        Insert: { always_allowed?: boolean; label: string; position: number; slug: string };
        Update: Partial<Database["public"]["Tables"]["modules"]["Insert"]>;
        Relationships: [];
      };
      notification_reads: {
        Row: { notification_id: string; read_at: string; user_id: string };
        Insert: { notification_id: string; read_at?: string; user_id: string };
        Update: Partial<Database["public"]["Tables"]["notification_reads"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          agency_id: string;
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          recipient_id: string | null;
          title: string;
        };
        Insert: {
          agency_id: string;
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          recipient_id?: string | null;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          cpf: string | null;
          created_at: string;
          department: string | null;
          email: string;
          full_name: string;
          id: string;
          job_title: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          cpf?: string | null;
          created_at?: string;
          department?: string | null;
          email: string;
          full_name?: string;
          id: string;
          job_title?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      accept_invitation: { Args: { token: string }; Returns: string };
      agency_exists: { Args: never; Returns: boolean };
      bootstrap_agency: { Args: { agency_name: string }; Returns: string };
      create_invitation: {
        Args: { a: string; access?: Json; invite_email: string; invite_role: AppRole };
        Returns: string;
      };
      invitation_preview: {
        Args: { token: string };
        Returns: { agency_name: string; email: string; role: AppRole; valid: boolean }[];
      };
      log_access: { Args: { user_agent?: string }; Returns: undefined };
    };
    Enums: { access_level: AccessLevel; app_role: AppRole; member_status: MemberStatus };
    CompositeTypes: { [_ in never]: never };
  };
};

export type AppRoleT = AppRole;
export type AccessLevelT = AccessLevel;
export type MemberStatusT = MemberStatus;
