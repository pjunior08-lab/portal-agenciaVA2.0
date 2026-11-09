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
type ApprovalKind = "post" | "demanda";
type ApprovalMode = "rapida" | "detalhada";
type ApprovalStatus = "enviado" | "em_analise" | "aprovado" | "alteracoes" | "reprovado";
type ApprovalPart = "geral" | "tema" | "midias" | "legenda";
type ApprovalDecision = "aprovado" | "alteracoes" | "reprovado";
type PublishMode = "manual" | "automatica";
type SocialNetwork = "instagram" | "facebook" | "tiktok" | "youtube" | "linkedin";
type PublicationStatus = "agendado" | "publicado" | "cancelado";
type ProposalStatus = "rascunho" | "enviada" | "em_negociacao" | "aceita" | "recusada";
type ItemCadence = "unica" | "mensal" | "trimestral" | "semestral" | "anual";
type ContractStatus = "rascunho" | "aguardando" | "assinado" | "cancelado";
type SignerParty = "contratante" | "contratada";
type FinKind = "receita" | "despesa" | "transferencia";
type FinSubtype = "fixa" | "variavel" | "imposto" | "pessoa";
type FinAccountKind = "corrente" | "poupanca" | "caixa" | "investimento" | "outro";
type CrmStage = "novo_lead" | "contato_feito" | "orcamento" | "proposta" | "negociacao" | "fechado" | "perdido";
type CrmChannel = "whatsapp" | "ligacao" | "email" | "presencial" | "outro";
type CrmResult = "sem_resposta" | "respondeu" | "pediu_retorno" | "reuniao_marcada" | "sem_interesse";
type CrmFieldType = "texto" | "numero" | "data" | "opcoes";

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
      posts: {
        Row: {
          id: string;
          agency_id: string;
          client_id: string;
          task_id: string | null;
          kind: ApprovalKind;
          title: string;
          caption: string;
          mode: ApprovalMode;
          status: ApprovalStatus;
          theme_decision: ApprovalDecision | null;
          media_decision: ApprovalDecision | null;
          caption_decision: ApprovalDecision | null;
          publish_mode: PublishMode;
          networks: SocialNetwork[];
          scheduled_at: string | null;
          round: number;
          sent_at: string;
          decided_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["posts"]["Row"]> & Pick<Database["public"]["Tables"]["posts"]["Row"], "agency_id" | "client_id" | "title">;
        Update: Partial<Database["public"]["Tables"]["posts"]["Row"]>;
        Relationships: [
          { foreignKeyName: "posts_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "posts_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
          { foreignKeyName: "posts_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      post_media: {
        Row: {
          id: string;
          agency_id: string;
          post_id: string;
          path: string;
          name: string;
          size_bytes: number;
          mime_type: string | null;
          position: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["post_media"]["Row"]> & Pick<Database["public"]["Tables"]["post_media"]["Row"], "agency_id" | "post_id" | "path" | "name">;
        Update: Partial<Database["public"]["Tables"]["post_media"]["Row"]>;
        Relationships: [{ foreignKeyName: "post_media_post_id_fkey"; columns: ["post_id"]; isOneToOne: false; referencedRelation: "posts"; referencedColumns: ["id"] }];
      };
      approval_events: {
        Row: {
          id: string;
          agency_id: string;
          post_id: string;
          actor_id: string | null;
          actor_side: "equipe" | "cliente";
          event: "enviado" | "reenviado" | "em_analise" | "decisao";
          part: ApprovalPart | null;
          decision: ApprovalDecision | null;
          round: number;
          comment: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["approval_events"]["Row"]> & Pick<Database["public"]["Tables"]["approval_events"]["Row"], "agency_id" | "post_id" | "actor_side" | "event">;
        Update: Partial<Database["public"]["Tables"]["approval_events"]["Row"]>;
        Relationships: [
          { foreignKeyName: "approval_events_post_id_fkey"; columns: ["post_id"]; isOneToOne: false; referencedRelation: "posts"; referencedColumns: ["id"] },
          { foreignKeyName: "approval_events_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      caption_templates: {
        Row: {
          id: string;
          agency_id: string;
          client_id: string | null;
          title: string;
          body: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["caption_templates"]["Row"]> & Pick<Database["public"]["Tables"]["caption_templates"]["Row"], "agency_id" | "title" | "body">;
        Update: Partial<Database["public"]["Tables"]["caption_templates"]["Row"]>;
        Relationships: [{ foreignKeyName: "caption_templates_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }];
      };
      social_accounts: {
        Row: {
          id: string;
          agency_id: string;
          client_id: string;
          network: SocialNetwork;
          username: string;
          profile_url: string | null;
          token_ref: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["social_accounts"]["Row"]> & Pick<Database["public"]["Tables"]["social_accounts"]["Row"], "agency_id" | "client_id" | "network" | "username">;
        Update: Partial<Database["public"]["Tables"]["social_accounts"]["Row"]>;
        Relationships: [{ foreignKeyName: "social_accounts_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }];
      };
      social_publications: {
        Row: {
          id: string;
          agency_id: string;
          client_id: string;
          post_id: string | null;
          account_id: string | null;
          network: SocialNetwork;
          title: string;
          caption: string;
          scheduled_at: string;
          status: PublicationStatus;
          published_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["social_publications"]["Row"]> & Pick<Database["public"]["Tables"]["social_publications"]["Row"], "agency_id" | "client_id" | "network" | "title" | "scheduled_at">;
        Update: Partial<Database["public"]["Tables"]["social_publications"]["Row"]>;
        Relationships: [
          { foreignKeyName: "social_publications_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "social_publications_post_id_fkey"; columns: ["post_id"]; isOneToOne: false; referencedRelation: "posts"; referencedColumns: ["id"] },
          { foreignKeyName: "social_publications_account_id_fkey"; columns: ["account_id"]; isOneToOne: false; referencedRelation: "social_accounts"; referencedColumns: ["id"] },
        ];
      };
      proposal_templates: {
        Row: {
          id: string;
          agency_id: string;
          name: string;
          title: string;
          cover: string;
          items: Json;
          payment: Json;
          notes: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["proposal_templates"]["Row"]> & Pick<Database["public"]["Tables"]["proposal_templates"]["Row"], "agency_id" | "name">;
        Update: Partial<Database["public"]["Tables"]["proposal_templates"]["Row"]>;
        Relationships: [];
      };
      proposals: {
        Row: {
          id: string;
          agency_id: string;
          number: string;
          title: string;
          template_id: string | null;
          cover: string;
          status: ProposalStatus;
          valid_until: string | null;
          client_id: string | null;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          payment: Json;
          notes: string;
          share_token_hash: string | null;
          sent_at: string | null;
          decided_at: string | null;
          decision_name: string | null;
          decision_comment: string | null;
          decision_ip: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["proposals"]["Row"]> & Pick<Database["public"]["Tables"]["proposals"]["Row"], "agency_id" | "title">;
        Update: Partial<Database["public"]["Tables"]["proposals"]["Row"]>;
        Relationships: [
          { foreignKeyName: "proposals_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
        ];
      };
      proposal_items: {
        Row: {
          id: string;
          agency_id: string;
          proposal_id: string;
          position: number;
          service: string;
          quantity: number;
          unit_price: number;
          cadence: ItemCadence;
          scope_html: string;
        };
        Insert: Partial<Database["public"]["Tables"]["proposal_items"]["Row"]> & Pick<Database["public"]["Tables"]["proposal_items"]["Row"], "agency_id" | "proposal_id" | "service">;
        Update: Partial<Database["public"]["Tables"]["proposal_items"]["Row"]>;
        Relationships: [
          { foreignKeyName: "proposal_items_proposal_id_fkey"; columns: ["proposal_id"]; isOneToOne: false; referencedRelation: "proposals"; referencedColumns: ["id"] },
        ];
      };
      contract_templates: {
        Row: {
          id: string;
          agency_id: string;
          name: string;
          description: string;
          body_html: string;
          header_text: string;
          footer_text: string;
          watermark: string;
          is_default: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contract_templates"]["Row"]> & Pick<Database["public"]["Tables"]["contract_templates"]["Row"], "agency_id" | "name">;
        Update: Partial<Database["public"]["Tables"]["contract_templates"]["Row"]>;
        Relationships: [];
      };
      contracts: {
        Row: {
          id: string;
          agency_id: string;
          title: string;
          template_id: string | null;
          proposal_id: string | null;
          client_id: string;
          service_description: string;
          body_html: string;
          header_text: string;
          footer_text: string;
          watermark: string;
          value: number | null;
          starts_on: string | null;
          ends_on: string | null;
          renewal_on: string | null;
          status: ContractStatus;
          rendered_html: string | null;
          document_hash: string | null;
          share_token_hash: string | null;
          sent_at: string | null;
          signed_at: string | null;
          cancelled_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contracts"]["Row"]> & Pick<Database["public"]["Tables"]["contracts"]["Row"], "agency_id" | "title" | "client_id">;
        Update: Partial<Database["public"]["Tables"]["contracts"]["Row"]>;
        Relationships: [
          { foreignKeyName: "contracts_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "contracts_proposal_id_fkey"; columns: ["proposal_id"]; isOneToOne: false; referencedRelation: "proposals"; referencedColumns: ["id"] },
        ];
      };
      contract_signatures: {
        Row: {
          id: string;
          agency_id: string;
          contract_id: string;
          party: SignerParty;
          signer_name: string;
          signer_document: string;
          signer_email: string | null;
          user_id: string | null;
          ip: string | null;
          user_agent: string | null;
          document_hash: string;
          signed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contract_signatures"]["Row"]> & Pick<Database["public"]["Tables"]["contract_signatures"]["Row"], "agency_id" | "contract_id" | "party" | "signer_name" | "signer_document" | "document_hash">;
        Update: Partial<Database["public"]["Tables"]["contract_signatures"]["Row"]>;
        Relationships: [
          { foreignKeyName: "contract_signatures_contract_id_fkey"; columns: ["contract_id"]; isOneToOne: false; referencedRelation: "contracts"; referencedColumns: ["id"] },
        ];
      };
      fin_accounts: {
        Row: {
          id: string;
          agency_id: string;
          name: string;
          kind: FinAccountKind;
          initial_balance: number;
          color: string;
          archived_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fin_accounts"]["Row"]> & Pick<Database["public"]["Tables"]["fin_accounts"]["Row"], "agency_id" | "name">;
        Update: Partial<Database["public"]["Tables"]["fin_accounts"]["Row"]>;
        Relationships: [];
      };
      fin_categories: {
        Row: {
          id: string;
          agency_id: string;
          kind: FinKind;
          subtype: FinSubtype | null;
          name: string;
          monthly_goal: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fin_categories"]["Row"]> & Pick<Database["public"]["Tables"]["fin_categories"]["Row"], "agency_id" | "kind" | "name">;
        Update: Partial<Database["public"]["Tables"]["fin_categories"]["Row"]>;
        Relationships: [];
      };
      fin_transactions: {
        Row: {
          id: string;
          agency_id: string;
          kind: FinKind;
          subtype: FinSubtype | null;
          amount: number;
          description: string;
          account_id: string | null;
          to_account_id: string | null;
          category_id: string | null;
          client_id: string | null;
          contract_id: string | null;
          person: string | null;
          notes: string | null;
          due_date: string;
          paid: boolean;
          paid_at: string | null;
          recurrence_id: string | null;
          installment: number | null;
          installments: number | null;
          source: "manual" | "mensalidade";
          competence: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fin_transactions"]["Row"]> & Pick<Database["public"]["Tables"]["fin_transactions"]["Row"], "agency_id" | "kind" | "amount" | "description" | "due_date">;
        Update: Partial<Database["public"]["Tables"]["fin_transactions"]["Row"]>;
        Relationships: [
          { foreignKeyName: "fin_transactions_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "fin_categories"; referencedColumns: ["id"] },
          { foreignKeyName: "fin_transactions_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "fin_transactions_account_id_fkey"; columns: ["account_id"]; isOneToOne: false; referencedRelation: "fin_accounts"; referencedColumns: ["id"] },
        ];
      };
      crm_settings: {
        Row: {
          agency_id: string;
          segments: string[];
          tags: string[];
          cadence_days: number[];
          cadence_paused: boolean;
          stale_days: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["crm_settings"]["Row"]> & Pick<Database["public"]["Tables"]["crm_settings"]["Row"], "agency_id">;
        Update: Partial<Database["public"]["Tables"]["crm_settings"]["Row"]>;
        Relationships: [];
      };
      crm_custom_fields: {
        Row: {
          id: string;
          agency_id: string;
          key: string;
          label: string;
          type: CrmFieldType;
          options: string[];
          position: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["crm_custom_fields"]["Row"]> & Pick<Database["public"]["Tables"]["crm_custom_fields"]["Row"], "agency_id" | "key" | "label">;
        Update: Partial<Database["public"]["Tables"]["crm_custom_fields"]["Row"]>;
        Relationships: [];
      };
      crm_message_templates: {
        Row: {
          id: string;
          agency_id: string;
          name: string;
          channel: CrmChannel;
          body: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["crm_message_templates"]["Row"]> & Pick<Database["public"]["Tables"]["crm_message_templates"]["Row"], "agency_id" | "name" | "body">;
        Update: Partial<Database["public"]["Tables"]["crm_message_templates"]["Row"]>;
        Relationships: [];
      };
      crm_goals: {
        Row: {
          agency_id: string;
          month: string;
          new_clients: number;
        };
        Insert: Partial<Database["public"]["Tables"]["crm_goals"]["Row"]> & Pick<Database["public"]["Tables"]["crm_goals"]["Row"], "agency_id" | "month" | "new_clients">;
        Update: Partial<Database["public"]["Tables"]["crm_goals"]["Row"]>;
        Relationships: [];
      };
      crm_opportunities: {
        Row: {
          id: string;
          agency_id: string;
          name: string;
          company: string | null;
          document: string | null;
          email: string | null;
          phone: string | null;
          segment: string | null;
          origin: string | null;
          tags: string[];
          owner_id: string | null;
          stage: CrmStage;
          position: number;
          value: number | null;
          next_step: string | null;
          next_step_at: string | null;
          last_contact_at: string | null;
          attempts: number;
          lost_reason: string | null;
          closed_at: string | null;
          lost_at: string | null;
          stage_changed_at: string;
          custom: Json;
          notes: string | null;
          client_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["crm_opportunities"]["Row"]> & Pick<Database["public"]["Tables"]["crm_opportunities"]["Row"], "agency_id" | "name">;
        Update: Partial<Database["public"]["Tables"]["crm_opportunities"]["Row"]>;
        Relationships: [
          { foreignKeyName: "crm_opportunities_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      crm_stage_history: {
        Row: {
          id: string;
          agency_id: string;
          opportunity_id: string;
          from_stage: CrmStage | null;
          to_stage: CrmStage;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["crm_stage_history"]["Row"]> & Pick<Database["public"]["Tables"]["crm_stage_history"]["Row"], "agency_id" | "opportunity_id" | "to_stage">;
        Update: Partial<Database["public"]["Tables"]["crm_stage_history"]["Row"]>;
        Relationships: [
          { foreignKeyName: "crm_stage_history_opportunity_id_fkey"; columns: ["opportunity_id"]; isOneToOne: false; referencedRelation: "crm_opportunities"; referencedColumns: ["id"] },
        ];
      };
      crm_activities: {
        Row: {
          id: string;
          agency_id: string;
          opportunity_id: string;
          kind: "contato" | "nota";
          channel: CrmChannel | null;
          result: CrmResult | null;
          note: string | null;
          author_id: string | null;
          happened_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["crm_activities"]["Row"]> & Pick<Database["public"]["Tables"]["crm_activities"]["Row"], "agency_id" | "opportunity_id">;
        Update: Partial<Database["public"]["Tables"]["crm_activities"]["Row"]>;
        Relationships: [
          { foreignKeyName: "crm_activities_opportunity_id_fkey"; columns: ["opportunity_id"]; isOneToOne: false; referencedRelation: "crm_opportunities"; referencedColumns: ["id"] },
        ];
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
    Views: {
      fin_account_balances: {
        Row: { account_id: string; agency_id: string; balance: number };
        Relationships: [];
      };
    };
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
      client_open_post: { Args: { p: string }; Returns: undefined };
      share_proposal: { Args: { p: string }; Returns: string };
      generate_monthly_fees: { Args: { a: string; month: string }; Returns: number };
      portal_invoices: {
        Args: { c: string };
        Returns: { id: string; description: string; amount: number; due_date: string; paid: boolean; paid_at: string | null }[];
      };
      public_proposal: { Args: { token: string }; Returns: Json };
      public_proposal_decide: {
        Args: { token: string; decision: ProposalStatus; signer_name: string; comment?: string | null; ip?: string | null };
        Returns: ProposalStatus;
      };
      send_contract: { Args: { c: string; rendered: string }; Returns: string };
      sign_contract_as_agency: {
        Args: { c: string; signer_name: string; signer_document: string; ip?: string | null; user_agent?: string | null };
        Returns: ContractStatus;
      };
      public_contract: { Args: { token: string }; Returns: Json };
      public_contract_sign: {
        Args: {
          token: string;
          signer_name: string;
          signer_document: string;
          signer_email?: string | null;
          ip?: string | null;
          user_agent?: string | null;
        };
        Returns: ContractStatus;
      };
      client_decide_post: {
        Args: { p: string; part: ApprovalPart; decision: ApprovalDecision; comment?: string | null };
        Returns: ApprovalStatus;
      };
    };
    Enums: {
      access_level: AccessLevel;
      app_role: AppRole;
      member_status: MemberStatus;
      client_status: ClientStatus;
      approval_status: ApprovalStatus;
      approval_mode: ApprovalMode;
      approval_kind: ApprovalKind;
      approval_part: ApprovalPart;
      approval_decision: ApprovalDecision;
      publish_mode: PublishMode;
      social_network: SocialNetwork;
      publication_status: PublicationStatus;
      proposal_status: ProposalStatus;
      item_cadence: ItemCadence;
      contract_status: ContractStatus;
      signer_party: SignerParty;
      fin_kind: FinKind;
      fin_subtype: FinSubtype;
      fin_account_kind: FinAccountKind;
      crm_stage: CrmStage;
      crm_channel: CrmChannel;
      crm_result: CrmResult;
      crm_field_type: CrmFieldType;
    };
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
export type ApprovalStatusT = ApprovalStatus;
export type ApprovalModeT = ApprovalMode;
export type ApprovalKindT = ApprovalKind;
export type ApprovalPartT = ApprovalPart;
export type ApprovalDecisionT = ApprovalDecision;
export type PublishModeT = PublishMode;
export type SocialNetworkT = SocialNetwork;
export type PublicationStatusT = PublicationStatus;
export type PostRow = Database["public"]["Tables"]["posts"]["Row"];
export type PublicationRow = Database["public"]["Tables"]["social_publications"]["Row"];
export type SocialAccountRow = Database["public"]["Tables"]["social_accounts"]["Row"];
export type ProposalStatusT = ProposalStatus;
export type ItemCadenceT = ItemCadence;
export type ContractStatusT = ContractStatus;
export type SignerPartyT = SignerParty;

export type ProposalRow = Database["public"]["Tables"]["proposals"]["Row"];
export type ProposalItemRow = Database["public"]["Tables"]["proposal_items"]["Row"];
export type ContractRow = Database["public"]["Tables"]["contracts"]["Row"];
export type ContractTemplateRow = Database["public"]["Tables"]["contract_templates"]["Row"];
export type FinKindT = FinKind;
export type FinSubtypeT = FinSubtype;
export type FinAccountKindT = FinAccountKind;
export type FinTransactionRow = Database["public"]["Tables"]["fin_transactions"]["Row"];
export type FinAccountRow = Database["public"]["Tables"]["fin_accounts"]["Row"];
export type FinCategoryRow = Database["public"]["Tables"]["fin_categories"]["Row"];
export type CrmStageT = CrmStage;
export type CrmChannelT = CrmChannel;
export type CrmResultT = CrmResult;
export type CrmFieldTypeT = CrmFieldType;
export type OpportunityRow = Database["public"]["Tables"]["crm_opportunities"]["Row"];
export type CrmActivityRow = Database["public"]["Tables"]["crm_activities"]["Row"];
