// Gerado a partir do banco (Supabase) — regenerar após cada migração.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type AppRole = "admin" | "colaborador";
type MemberStatus = "ativo" | "desativado";
type AccessLevel = "ver" | "editar";
type ClientStatus = "ativo" | "pausado" | "inativo" | "arquivado";
type TaskType = "post" | "demanda";
type TaskPriority = "alta" | "media" | "baixa";
type CardImage = "miniatura" | "capa" | "sem";
type AttachmentKind = "arquivo" | "link";
type EventVisibility = "agencia" | "privado";

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      boards: {
        Row: {
          id: string;
          agency_id: string;
          name: string;
          card_image: CardImage;
          position: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["boards"]["Row"]> & Pick<Database["public"]["Tables"]["boards"]["Row"], "agency_id" | "name">;
        Update: Partial<Database["public"]["Tables"]["boards"]["Row"]>;
        Relationships: [];
      };
      board_columns: {
        Row: {
          id: string;
          agency_id: string;
          board_id: string;
          name: string;
          color: string;
          position: number;
          is_done: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["board_columns"]["Row"]> & Pick<Database["public"]["Tables"]["board_columns"]["Row"], "agency_id" | "board_id" | "name">;
        Update: Partial<Database["public"]["Tables"]["board_columns"]["Row"]>;
        Relationships: [];
      };
      labels: {
        Row: {
          id: string;
          agency_id: string;
          name: string;
          color: string;
        };
        Insert: Partial<Database["public"]["Tables"]["labels"]["Row"]> & Pick<Database["public"]["Tables"]["labels"]["Row"], "agency_id" | "name">;
        Update: Partial<Database["public"]["Tables"]["labels"]["Row"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          agency_id: string;
          board_id: string;
          column_id: string;
          client_id: string | null;
          label_id: string | null;
          type: TaskType;
          title: string;
          description: string;
          caption: string;
          priority: TaskPriority | null;
          start_date: string | null;
          due_date: string | null;
          publish_at: string | null;
          position: number;
          completed_at: string | null;
          archived_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tasks"]["Row"]> & Pick<Database["public"]["Tables"]["tasks"]["Row"], "agency_id" | "board_id" | "column_id" | "title">;
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
        Relationships: [];
      };
      task_assignees: {
        Row: {
          task_id: string;
          user_id: string;
          agency_id: string;
        };
        Insert: Partial<Database["public"]["Tables"]["task_assignees"]["Row"]> & Pick<Database["public"]["Tables"]["task_assignees"]["Row"], "task_id" | "user_id" | "agency_id">;
        Update: Partial<Database["public"]["Tables"]["task_assignees"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_attachments: {
        Row: {
          id: string;
          agency_id: string;
          task_id: string;
          kind: AttachmentKind;
          name: string;
          url: string | null;
          path: string | null;
          size_bytes: number | null;
          mime_type: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["task_attachments"]["Row"]> & Pick<Database["public"]["Tables"]["task_attachments"]["Row"], "agency_id" | "task_id" | "kind" | "name">;
        Update: Partial<Database["public"]["Tables"]["task_attachments"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          id: string;
          agency_id: string;
          owner_id: string;
          client_id: string | null;
          title: string;
          description: string;
          location: string | null;
          starts_at: string;
          ends_at: string;
          all_day: boolean;
          visibility: EventVisibility;
          done_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["events"]["Row"]> & Pick<Database["public"]["Tables"]["events"]["Row"], "agency_id" | "owner_id" | "title" | "starts_at" | "ends_at">;
        Update: Partial<Database["public"]["Tables"]["events"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "events_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_attendees: {
        Row: {
          event_id: string;
          user_id: string;
          agency_id: string;
        };
        Insert: Partial<Database["public"]["Tables"]["event_attendees"]["Row"]> & Pick<Database["public"]["Tables"]["event_attendees"]["Row"], "event_id" | "user_id" | "agency_id">;
        Update: Partial<Database["public"]["Tables"]["event_attendees"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_attendees_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_rules: {
        Row: {
          id: string;
          agency_id: string;
          user_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
        };
        Insert: Partial<Database["public"]["Tables"]["availability_rules"]["Row"]> & Pick<Database["public"]["Tables"]["availability_rules"]["Row"], "agency_id" | "user_id" | "weekday" | "start_time" | "end_time">;
        Update: Partial<Database["public"]["Tables"]["availability_rules"]["Row"]>;
        Relationships: [];
      };
      checklist_items: {
        Row: {
          id: string;
          agency_id: string;
          user_id: string;
          title: string;
          due_date: string | null;
          done_at: string | null;
          position: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["checklist_items"]["Row"]> & Pick<Database["public"]["Tables"]["checklist_items"]["Row"], "agency_id" | "user_id" | "title">;
        Update: Partial<Database["public"]["Tables"]["checklist_items"]["Row"]>;
        Relationships: [];
      };
      clients: {
        Row: {
          address: string | null;
          agency_id: string;
          auto_reminders: boolean;
          billing_day: number | null;
          client_since: string | null;
          contact_name: string | null;
          cover_color: string | null;
          created_at: string;
          created_by: string | null;
          document: string | null;
          email: string | null;
          id: string;
          logo_dark_path: string | null;
          logo_light_path: string | null;
          monthly_fee: number | null;
          name: string;
          notes: string | null;
          phone: string | null;
          segment_icon: string | null;
          status: ClientStatus;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["clients"]["Row"], "agency_id" | "name">> & {
          agency_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Row"]>;
        Relationships: [];
      };
      client_notes: {
        Row: {
          agency_id: string;
          author_id: string | null;
          body: string;
          client_id: string;
          created_at: string;
          id: string;
          shared_with_client: boolean;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          author_id?: string | null;
          body: string;
          client_id: string;
          id?: string;
          shared_with_client?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["client_notes"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "client_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_files: {
        Row: {
          agency_id: string;
          client_id: string;
          created_at: string;
          id: string;
          mime_type: string | null;
          name: string;
          path: string;
          shared_with_client: boolean;
          size_bytes: number;
          uploaded_by: string | null;
        };
        Insert: {
          agency_id: string;
          client_id: string;
          id?: string;
          mime_type?: string | null;
          name: string;
          path: string;
          shared_with_client?: boolean;
          size_bytes: number;
          uploaded_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["client_files"]["Row"]>;
        Relationships: [];
      };
      client_strategy: {
        Row: {
          agency_id: string;
          client_id: string;
          competitors: string;
          persona: string;
          positioning: string;
          profile_audit: string;
          share_token_hash: string | null;
          updated_at: string;
          updated_by: string | null;
          visual_identity: string;
        };
        Insert: Partial<Database["public"]["Tables"]["client_strategy"]["Row"]> & { agency_id: string; client_id: string };
        Update: Partial<Database["public"]["Tables"]["client_strategy"]["Row"]>;
        Relationships: [];
      };
      client_portal: {
        Row: { agency_id: string; client_id: string; enabled: boolean; sections: string[]; slug: string; updated_at: string };
        Insert: { agency_id: string; client_id: string; enabled?: boolean; sections?: string[]; slug: string };
        Update: Partial<Database["public"]["Tables"]["client_portal"]["Row"]>;
        Relationships: [];
      };
      client_users: {
        Row: { agency_id: string; client_id: string; created_at: string; status: MemberStatus; user_id: string };
        Insert: { agency_id: string; client_id: string; status?: MemberStatus; user_id: string };
        Update: Partial<Database["public"]["Tables"]["client_users"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "client_users_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_invitations: {
        Row: {
          accepted_at: string | null;
          agency_id: string;
          client_id: string;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          revoked_at: string | null;
          token_hash: string;
        };
        Insert: Partial<Database["public"]["Tables"]["client_invitations"]["Row"]> & {
          agency_id: string;
          client_id: string;
          email: string;
          token_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_invitations"]["Row"]>;
        Relationships: [];
      };
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
      create_board: { Args: { a: string; board_name: string }; Returns: string };
      portal_tasks_in_progress: {
        Args: { c: string };
        Returns: {
          id: string;
          title: string;
          type: TaskType;
          column_name: string;
          column_color: string;
          due_date: string | null;
          publish_at: string | null;
        }[];
      };
      create_client_invitation: { Args: { c: string; invite_email: string }; Returns: string };
      client_invitation_preview: {
        Args: { token: string };
        Returns: { client_name: string; agency_name: string; email: string; slug: string | null; valid: boolean }[];
      };
      accept_client_invitation: { Args: { token: string }; Returns: string };
      share_client_strategy: { Args: { c: string }; Returns: string };
      unshare_client_strategy: { Args: { c: string }; Returns: undefined };
      shared_client_strategy: {
        Args: { token: string };
        Returns: {
          client_name: string;
          agency_name: string;
          persona: string;
          profile_audit: string;
          competitors: string;
          positioning: string;
          visual_identity: string;
          updated_at: string;
        }[];
      };
      my_client_portals: {
        Args: never;
        Returns: { client_id: string; client_name: string; slug: string; agency_name: string }[];
      };
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
    Enums: { access_level: AccessLevel; app_role: AppRole; member_status: MemberStatus; client_status: ClientStatus };
    CompositeTypes: { [_ in never]: never };
  };
};

export type AppRoleT = AppRole;
export type AccessLevelT = AccessLevel;
export type MemberStatusT = MemberStatus;
export type ClientStatusT = ClientStatus;
export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type TaskTypeT = TaskType;
export type TaskPriorityT = TaskPriority;
export type CardImageT = CardImage;
export type EventVisibilityT = EventVisibility;
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type BoardRow = Database["public"]["Tables"]["boards"]["Row"];
export type ColumnRow = Database["public"]["Tables"]["board_columns"]["Row"];
export type LabelRow = Database["public"]["Tables"]["labels"]["Row"];
export type EventRow = Database["public"]["Tables"]["events"]["Row"];
