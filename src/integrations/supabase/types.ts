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
      admin_vm_permissions: {
        Row: {
          admin_user_id: string
          can_use_vm: boolean
          created_at: string
          granted_at: string | null
          granted_by: string | null
          id: string
          revoked_at: string | null
        }
        Insert: {
          admin_user_id: string
          can_use_vm?: boolean
          created_at?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
        }
        Update: {
          admin_user_id?: string
          can_use_vm?: boolean
          created_at?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
      ai_campaign_logs: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          log_type: string
          message: string
          metadata: Json | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          log_type?: string
          message: string
          metadata?: Json | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          log_type?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaign_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_campaign_payments: {
        Row: {
          admin_notes: string | null
          amount: number
          campaign_id: string
          created_at: string
          currency: string
          id: string
          payment_method: string
          payment_reference: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          campaign_id: string
          created_at?: string
          currency?: string
          id?: string
          payment_method: string
          payment_reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          campaign_id?: string
          created_at?: string
          currency?: string
          id?: string
          payment_method?: string
          payment_reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaign_payments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_campaigns: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          daily_cost: number
          days_requested: number
          description: string | null
          destination: string
          failed_count: number
          id: string
          is_scheduled: boolean
          message_template: string
          name: string
          recipients: string[]
          scheduled_at: string | null
          sent_count: number
          started_at: string | null
          status: string
          target_audience: string
          total_cost: number
          total_recipients: number
          updated_at: string
          user_id: string
          whatsapp_number: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          daily_cost?: number
          days_requested?: number
          description?: string | null
          destination?: string
          failed_count?: number
          id?: string
          is_scheduled?: boolean
          message_template: string
          name: string
          recipients?: string[]
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          target_audience: string
          total_cost?: number
          total_recipients?: number
          updated_at?: string
          user_id: string
          whatsapp_number: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          daily_cost?: number
          days_requested?: number
          description?: string | null
          destination?: string
          failed_count?: number
          id?: string
          is_scheduled?: boolean
          message_template?: string
          name?: string
          recipients?: string[]
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          target_audience?: string
          total_cost?: number
          total_recipients?: number
          updated_at?: string
          user_id?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      ai_receptionist_configs: {
        Row: {
          ai_model: string | null
          ai_provider: string
          business_hours: Json | null
          closing_message: string | null
          company_name: string | null
          created_at: string | null
          faq_data: Json | null
          greeting_message: string | null
          id: string
          is_active: boolean | null
          linked_sip_config_id: string | null
          linked_voice_profile_id: string | null
          max_tokens: number | null
          receptionist_name: string
          system_prompt: string | null
          temperature: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string
          business_hours?: Json | null
          closing_message?: string | null
          company_name?: string | null
          created_at?: string | null
          faq_data?: Json | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean | null
          linked_sip_config_id?: string | null
          linked_voice_profile_id?: string | null
          max_tokens?: number | null
          receptionist_name?: string
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string
          business_hours?: Json | null
          closing_message?: string | null
          company_name?: string | null
          created_at?: string | null
          faq_data?: Json | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean | null
          linked_sip_config_id?: string | null
          linked_voice_profile_id?: string | null
          max_tokens?: number | null
          receptionist_name?: string
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_receptionist_configs_linked_sip_config_id_fkey"
            columns: ["linked_sip_config_id"]
            isOneToOne: false
            referencedRelation: "sip_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_receptionist_configs_linked_voice_profile_id_fkey"
            columns: ["linked_voice_profile_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_twin_calls: {
        Row: {
          call_sid: string | null
          call_status: string | null
          caller_phone: string
          caller_sentiment: string | null
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string | null
          tokens_charged: number | null
          transcript: Json | null
          twin_id: string
          user_id: string
        }
        Insert: {
          call_sid?: string | null
          call_status?: string | null
          caller_phone: string
          caller_sentiment?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          tokens_charged?: number | null
          transcript?: Json | null
          twin_id: string
          user_id: string
        }
        Update: {
          call_sid?: string | null
          call_status?: string | null
          caller_phone?: string
          caller_sentiment?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          tokens_charged?: number | null
          transcript?: Json | null
          twin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_twin_calls_twin_id_fkey"
            columns: ["twin_id"]
            isOneToOne: false
            referencedRelation: "ai_twins"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_twin_memories: {
        Row: {
          caller_name: string | null
          caller_phone: string
          created_at: string | null
          id: string
          importance: number | null
          last_referenced_at: string | null
          memory_content: string
          memory_type: string | null
          twin_id: string
          updated_at: string | null
        }
        Insert: {
          caller_name?: string | null
          caller_phone: string
          created_at?: string | null
          id?: string
          importance?: number | null
          last_referenced_at?: string | null
          memory_content: string
          memory_type?: string | null
          twin_id: string
          updated_at?: string | null
        }
        Update: {
          caller_name?: string | null
          caller_phone?: string
          created_at?: string | null
          id?: string
          importance?: number | null
          last_referenced_at?: string | null
          memory_content?: string
          memory_type?: string | null
          twin_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_twin_memories_twin_id_fkey"
            columns: ["twin_id"]
            isOneToOne: false
            referencedRelation: "ai_twins"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_twins: {
        Row: {
          cost_per_minute: number | null
          created_at: string | null
          custom_instructions: string | null
          forwarding_number: string | null
          greeting_message: string | null
          id: string
          is_active: boolean | null
          language: string | null
          name: string
          personality_traits: string[] | null
          speaking_style: string | null
          tone_calm: number | null
          tone_intuitive: number | null
          tone_playful: number | null
          total_calls: number | null
          total_minutes_used: number | null
          updated_at: string | null
          user_id: string
          voice_id: string | null
        }
        Insert: {
          cost_per_minute?: number | null
          created_at?: string | null
          custom_instructions?: string | null
          forwarding_number?: string | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          name?: string
          personality_traits?: string[] | null
          speaking_style?: string | null
          tone_calm?: number | null
          tone_intuitive?: number | null
          tone_playful?: number | null
          total_calls?: number | null
          total_minutes_used?: number | null
          updated_at?: string | null
          user_id: string
          voice_id?: string | null
        }
        Update: {
          cost_per_minute?: number | null
          created_at?: string | null
          custom_instructions?: string | null
          forwarding_number?: string | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          name?: string
          personality_traits?: string[] | null
          speaking_style?: string | null
          tone_calm?: number | null
          tone_intuitive?: number | null
          tone_playful?: number | null
          total_calls?: number | null
          total_minutes_used?: number | null
          updated_at?: string | null
          user_id?: string
          voice_id?: string | null
        }
        Relationships: []
      }
      api_keys_vault: {
        Row: {
          created_at: string | null
          id: string
          is_valid: boolean | null
          key_encrypted: string
          last_used_at: string | null
          service_name: string
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_valid?: boolean | null
          key_encrypted: string
          last_used_at?: string | null
          service_name: string
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_valid?: boolean | null
          key_encrypted?: string
          last_used_at?: string | null
          service_name?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          is_deleted_by_receiver: boolean
          is_deleted_by_sender: boolean
          is_read: boolean
          message: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_deleted_by_receiver?: boolean
          is_deleted_by_sender?: boolean
          is_read?: boolean
          message: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_deleted_by_receiver?: boolean
          is_deleted_by_sender?: boolean
          is_read?: boolean
          message?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          activity_type: string
          contact_id: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          activity_type: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          activity_type?: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          last_contacted_at: string | null
          name: string
          notes: string | null
          phone: string | null
          stage: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          last_contacted_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          stage?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          last_contacted_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          stage?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_emails: {
        Row: {
          body: string
          contact_id: string | null
          created_at: string
          direction: string
          from_email: string
          id: string
          opened_at: string | null
          replied_at: string | null
          status: string
          subject: string
          to_email: string
          user_id: string
        }
        Insert: {
          body: string
          contact_id?: string | null
          created_at?: string
          direction?: string
          from_email: string
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          status?: string
          subject: string
          to_email: string
          user_id: string
        }
        Update: {
          body?: string
          contact_id?: string | null
          created_at?: string
          direction?: string
          from_email?: string
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_subscriptions: {
        Row: {
          created_at: string
          credits_charged: number
          expires_at: string
          id: string
          is_active: boolean
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_charged?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_charged?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crypto_orders: {
        Row: {
          admin_notes: string | null
          created_at: string
          credits_amount: number
          crypto_type: string
          expected_amount: number
          expires_at: string
          id: string
          paid_at: string | null
          price_usd: number
          reviewed_by: string | null
          status: string
          tx_hash: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          credits_amount: number
          crypto_type: string
          expected_amount: number
          expires_at: string
          id?: string
          paid_at?: string | null
          price_usd: number
          reviewed_by?: string | null
          status?: string
          tx_hash?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          credits_amount?: number
          crypto_type?: string
          expected_amount?: number
          expires_at?: string
          id?: string
          paid_at?: string | null
          price_usd?: number
          reviewed_by?: string | null
          status?: string
          tx_hash?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      docker_bots: {
        Row: {
          assigned_port: number
          bot_api_key: string
          bot_name: string
          container_name: string
          created_at: string
          id: string
          is_admin_bot: boolean
          last_started_at: string | null
          last_stopped_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          assigned_port: number
          bot_api_key: string
          bot_name: string
          container_name: string
          created_at?: string
          id?: string
          is_admin_bot?: boolean
          last_started_at?: string | null
          last_stopped_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          assigned_port?: number
          bot_api_key?: string
          bot_name?: string
          container_name?: string
          created_at?: string
          id?: string
          is_admin_bot?: boolean
          last_started_at?: string | null
          last_stopped_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      forum_channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "forum_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_channel_messages: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          message: string
          sender_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          message: string
          sender_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "forum_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_channels: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string
          description: string | null
          icon: string | null
          id: string
          is_approved: boolean | null
          member_count: number | null
          name: string
          post_count: number | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          icon?: string | null
          id?: string
          is_approved?: boolean | null
          member_count?: number | null
          name: string
          post_count?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_approved?: boolean | null
          member_count?: number | null
          name?: string
          post_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      forum_follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          author_id: string
          channel_id: string
          content: string
          created_at: string | null
          id: string
          is_approved: boolean | null
          is_pinned: boolean | null
          reaction_count: number | null
          reply_count: number | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          author_id: string
          channel_id: string
          content: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          is_pinned?: boolean | null
          reaction_count?: number | null
          reply_count?: number | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          author_id?: string
          channel_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          is_pinned?: boolean | null
          reaction_count?: number | null
          reply_count?: number | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "forum_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_reactions: {
        Row: {
          created_at: string | null
          id: string
          post_id: string | null
          reaction_type: string
          reply_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          reaction_type?: string
          reply_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          reaction_type?: string
          reply_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_reactions_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_replies: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          parent_reply_id: string | null
          post_id: string
          reaction_count: number | null
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          parent_reply_id?: string | null
          post_id: string
          reaction_count?: number | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          parent_reply_id?: string | null
          post_id?: string
          reaction_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_user_stats: {
        Row: {
          created_at: string | null
          id: string
          posts_count: number | null
          reactions_received: number | null
          replies_count: number | null
          reputation_score: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          posts_count?: number | null
          reactions_received?: number | null
          replies_count?: number | null
          reputation_score?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          posts_count?: number | null
          reactions_received?: number | null
          replies_count?: number | null
          reputation_score?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          responded_at: string | null
          status: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          responded_at?: string | null
          status?: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          responded_at?: string | null
          status?: string
          to_user_id?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      game_bans: {
        Row: {
          banned_at: string
          banned_by: string
          character_id: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          is_permanent: boolean
          reason: string
          rule_violated: string | null
          user_id: string
        }
        Insert: {
          banned_at?: string
          banned_by: string
          character_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_permanent?: boolean
          reason: string
          rule_violated?: string | null
          user_id: string
        }
        Update: {
          banned_at?: string
          banned_by?: string
          character_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_permanent?: boolean
          reason?: string
          rule_violated?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_bans_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_characters: {
        Row: {
          armor: number
          arrests: number
          bank_balance: number
          cash: number
          cf_credits_spent_in_game: number | null
          created_at: string
          current_job: Database["public"]["Enums"]["job_type"]
          deaths: number | null
          energy: number
          equipped_weapon: string | null
          gang_id: string | null
          gender: Database["public"]["Enums"]["character_gender"]
          hair_color: string
          health: number
          hunger: number
          id: string
          is_in_jail: boolean | null
          is_knocked_out: boolean
          is_online: boolean
          jail_reason: string | null
          jail_until: string | null
          job_experience: number
          kills: number | null
          knocked_out_by: string | null
          knocked_out_until: string | null
          last_robbery_at: string | null
          last_seen_at: string | null
          name: string
          pants_color: string
          position_x: number
          position_y: number
          shirt_color: string
          skin_color: string
          total_crimes: number
          updated_at: string
          user_id: string
          wanted_level: number
        }
        Insert: {
          armor?: number
          arrests?: number
          bank_balance?: number
          cash?: number
          cf_credits_spent_in_game?: number | null
          created_at?: string
          current_job?: Database["public"]["Enums"]["job_type"]
          deaths?: number | null
          energy?: number
          equipped_weapon?: string | null
          gang_id?: string | null
          gender?: Database["public"]["Enums"]["character_gender"]
          hair_color?: string
          health?: number
          hunger?: number
          id?: string
          is_in_jail?: boolean | null
          is_knocked_out?: boolean
          is_online?: boolean
          jail_reason?: string | null
          jail_until?: string | null
          job_experience?: number
          kills?: number | null
          knocked_out_by?: string | null
          knocked_out_until?: string | null
          last_robbery_at?: string | null
          last_seen_at?: string | null
          name: string
          pants_color?: string
          position_x?: number
          position_y?: number
          shirt_color?: string
          skin_color?: string
          total_crimes?: number
          updated_at?: string
          user_id: string
          wanted_level?: number
        }
        Update: {
          armor?: number
          arrests?: number
          bank_balance?: number
          cash?: number
          cf_credits_spent_in_game?: number | null
          created_at?: string
          current_job?: Database["public"]["Enums"]["job_type"]
          deaths?: number | null
          energy?: number
          equipped_weapon?: string | null
          gang_id?: string | null
          gender?: Database["public"]["Enums"]["character_gender"]
          hair_color?: string
          health?: number
          hunger?: number
          id?: string
          is_in_jail?: boolean | null
          is_knocked_out?: boolean
          is_online?: boolean
          jail_reason?: string | null
          jail_until?: string | null
          job_experience?: number
          kills?: number | null
          knocked_out_by?: string | null
          knocked_out_until?: string | null
          last_robbery_at?: string | null
          last_seen_at?: string | null
          name?: string
          pants_color?: string
          position_x?: number
          position_y?: number
          shirt_color?: string
          skin_color?: string
          total_crimes?: number
          updated_at?: string
          user_id?: string
          wanted_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_characters_gang"
            columns: ["gang_id"]
            isOneToOne: false
            referencedRelation: "game_gangs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_characters_knocked_out_by_fkey"
            columns: ["knocked_out_by"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_combat_logs: {
        Row: {
          attacker_id: string
          created_at: string | null
          damage_dealt: number | null
          id: string
          is_kill: boolean | null
          victim_id: string
          weapon_used: string | null
        }
        Insert: {
          attacker_id: string
          created_at?: string | null
          damage_dealt?: number | null
          id?: string
          is_kill?: boolean | null
          victim_id: string
          weapon_used?: string | null
        }
        Update: {
          attacker_id?: string
          created_at?: string | null
          damage_dealt?: number | null
          id?: string
          is_kill?: boolean | null
          victim_id?: string
          weapon_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_combat_logs_attacker_id_fkey"
            columns: ["attacker_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_combat_logs_victim_id_fkey"
            columns: ["victim_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_crime_logs: {
        Row: {
          amount_stolen: number | null
          created_at: string
          crime_type: string
          criminal_id: string
          id: string
          location_x: number | null
          location_y: number | null
          victim_id: string | null
          wanted_level_added: number | null
        }
        Insert: {
          amount_stolen?: number | null
          created_at?: string
          crime_type: string
          criminal_id: string
          id?: string
          location_x?: number | null
          location_y?: number | null
          victim_id?: string | null
          wanted_level_added?: number | null
        }
        Update: {
          amount_stolen?: number | null
          created_at?: string
          crime_type?: string
          criminal_id?: string
          id?: string
          location_x?: number | null
          location_y?: number | null
          victim_id?: string | null
          wanted_level_added?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_crime_logs_criminal_id_fkey"
            columns: ["criminal_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_crime_logs_victim_id_fkey"
            columns: ["victim_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_criminal_jobs: {
        Row: {
          cooldown_minutes: number | null
          description: string | null
          energy_cost: number | null
          icon: string | null
          id: string
          job_type: string
          max_payout: number
          min_payout: number
          name: string
          required_item: string | null
          wanted_level_risk: number | null
        }
        Insert: {
          cooldown_minutes?: number | null
          description?: string | null
          energy_cost?: number | null
          icon?: string | null
          id?: string
          job_type: string
          max_payout?: number
          min_payout?: number
          name: string
          required_item?: string | null
          wanted_level_risk?: number | null
        }
        Update: {
          cooldown_minutes?: number | null
          description?: string | null
          energy_cost?: number | null
          icon?: string | null
          id?: string
          job_type?: string
          max_payout?: number
          min_payout?: number
          name?: string
          required_item?: string | null
          wanted_level_risk?: number | null
        }
        Relationships: []
      }
      game_friends: {
        Row: {
          character_id: string
          created_at: string
          friend_character_id: string
          id: string
          status: string
        }
        Insert: {
          character_id: string
          created_at?: string
          friend_character_id: string
          id?: string
          status?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          friend_character_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_friends_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_friends_friend_character_id_fkey"
            columns: ["friend_character_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_gang_applications: {
        Row: {
          character_id: string
          created_at: string | null
          gang_id: string
          id: string
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          character_id: string
          created_at?: string | null
          gang_id: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          character_id?: string
          created_at?: string | null
          gang_id?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_gang_applications_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_gang_applications_gang_id_fkey"
            columns: ["gang_id"]
            isOneToOne: false
            referencedRelation: "game_gangs"
            referencedColumns: ["id"]
          },
        ]
      }
      game_gangs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          color: string
          created_at: string | null
          description: string | null
          id: string
          is_approved: boolean | null
          leader_id: string | null
          max_members: number | null
          member_count: number | null
          name: string
          reputation: number | null
          tag: string
          treasury: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_approved?: boolean | null
          leader_id?: string | null
          max_members?: number | null
          member_count?: number | null
          name: string
          reputation?: number | null
          tag: string
          treasury?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_approved?: boolean | null
          leader_id?: string | null
          max_members?: number | null
          member_count?: number | null
          name?: string
          reputation?: number | null
          tag?: string
          treasury?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_gangs_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_jail_logs: {
        Row: {
          arrested_by: string | null
          character_id: string
          created_at: string | null
          id: string
          jail_duration_minutes: number | null
          reason: string | null
          released_at: string | null
          released_by: string | null
          used_jail_card: boolean | null
        }
        Insert: {
          arrested_by?: string | null
          character_id: string
          created_at?: string | null
          id?: string
          jail_duration_minutes?: number | null
          reason?: string | null
          released_at?: string | null
          released_by?: string | null
          used_jail_card?: boolean | null
        }
        Update: {
          arrested_by?: string | null
          character_id?: string
          created_at?: string | null
          id?: string
          jail_duration_minutes?: number | null
          reason?: string | null
          released_at?: string | null
          released_by?: string | null
          used_jail_card?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "game_jail_logs_arrested_by_fkey"
            columns: ["arrested_by"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_jail_logs_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_job_logs: {
        Row: {
          character_id: string
          created_at: string | null
          id: string
          job_type: string
          payout: number
          success: boolean | null
        }
        Insert: {
          character_id: string
          created_at?: string | null
          id?: string
          job_type: string
          payout: number
          success?: boolean | null
        }
        Update: {
          character_id?: string
          created_at?: string | null
          id?: string
          job_type?: string
          payout?: number
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "game_job_logs_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          message_type: string
          receiver_id: string | null
          sender_id: string
          sender_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          message_type?: string
          receiver_id?: string | null
          sender_id: string
          sender_name: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          message_type?: string
          receiver_id?: string | null
          sender_id?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_org_members: {
        Row: {
          character_id: string
          id: string
          joined_at: string
          organization_id: string
          role: string
        }
        Insert: {
          character_id: string
          id?: string
          joined_at?: string
          organization_id: string
          role?: string
        }
        Update: {
          character_id?: string
          id?: string
          joined_at?: string
          organization_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_org_members_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_org_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "game_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      game_organizations: {
        Row: {
          color: string
          created_at: string
          id: string
          leader_id: string | null
          name: string
          org_type: Database["public"]["Enums"]["organization_type"]
          reputation: number
          treasury: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          leader_id?: string | null
          name: string
          org_type: Database["public"]["Enums"]["organization_type"]
          reputation?: number
          treasury?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          leader_id?: string | null
          name?: string
          org_type?: Database["public"]["Enums"]["organization_type"]
          reputation?: number
          treasury?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_organizations_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_player_inventory: {
        Row: {
          acquired_at: string | null
          ammo: number | null
          character_id: string
          id: string
          is_equipped: boolean | null
          weapon_id: string
        }
        Insert: {
          acquired_at?: string | null
          ammo?: number | null
          character_id: string
          id?: string
          is_equipped?: boolean | null
          weapon_id: string
        }
        Update: {
          acquired_at?: string | null
          ammo?: number | null
          character_id?: string
          id?: string
          is_equipped?: boolean | null
          weapon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_player_inventory_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_player_inventory_weapon_id_fkey"
            columns: ["weapon_id"]
            isOneToOne: false
            referencedRelation: "game_weapons"
            referencedColumns: ["id"]
          },
        ]
      }
      game_police_applications: {
        Row: {
          admin_notes: string | null
          character_id: string
          character_name: string
          created_at: string
          experience: string | null
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          character_id: string
          character_name: string
          created_at?: string
          experience?: string | null
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          character_id?: string
          character_name?: string
          created_at?: string
          experience?: string | null
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_police_applications_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_properties: {
        Row: {
          created_at: string
          id: string
          is_for_sale: boolean
          name: string
          owner_id: string | null
          position_x: number
          position_y: number
          price: number
          property_type: Database["public"]["Enums"]["property_type"]
          rent_income: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_for_sale?: boolean
          name: string
          owner_id?: string | null
          position_x: number
          position_y: number
          price: number
          property_type: Database["public"]["Enums"]["property_type"]
          rent_income?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_for_sale?: boolean
          name?: string
          owner_id?: string | null
          position_x?: number
          position_y?: number
          price?: number
          property_type?: Database["public"]["Enums"]["property_type"]
          rent_income?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_taxi_fares: {
        Row: {
          completed_at: string | null
          created_at: string
          driver_id: string
          dropoff_x: number | null
          dropoff_y: number | null
          fare_amount: number
          id: string
          passenger_id: string
          pickup_x: number
          pickup_y: number
          status: string
          vehicle_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          driver_id: string
          dropoff_x?: number | null
          dropoff_y?: number | null
          fare_amount?: number
          id?: string
          passenger_id: string
          pickup_x: number
          pickup_y: number
          status?: string
          vehicle_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          driver_id?: string
          dropoff_x?: number | null
          dropoff_y?: number | null
          fare_amount?: number
          id?: string
          passenger_id?: string
          pickup_x?: number
          pickup_y?: number
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_taxi_fares_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_taxi_fares_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_taxi_fares_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "game_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_transactions: {
        Row: {
          amount: number
          character_id: string
          created_at: string
          description: string | null
          id: string
          transaction_type: string
        }
        Insert: {
          amount: number
          character_id: string
          created_at?: string
          description?: string | null
          id?: string
          transaction_type: string
        }
        Update: {
          amount?: number
          character_id?: string
          created_at?: string
          description?: string | null
          id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_transactions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_vehicles: {
        Row: {
          color: string
          created_at: string
          driver_id: string | null
          fuel: number
          health: number
          id: string
          is_for_sale: boolean
          is_locked: boolean
          max_speed: number
          name: string
          owner_id: string | null
          position_x: number
          position_y: number
          price: number
          rotation: number
          speed: number
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          color?: string
          created_at?: string
          driver_id?: string | null
          fuel?: number
          health?: number
          id?: string
          is_for_sale?: boolean
          is_locked?: boolean
          max_speed?: number
          name: string
          owner_id?: string | null
          position_x?: number
          position_y?: number
          price?: number
          rotation?: number
          speed?: number
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          color?: string
          created_at?: string
          driver_id?: string | null
          fuel?: number
          health?: number
          id?: string
          is_for_sale?: boolean
          is_locked?: boolean
          max_speed?: number
          name?: string
          owner_id?: string | null
          position_x?: number
          position_y?: number
          price?: number
          rotation?: number
          speed?: number
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: [
          {
            foreignKeyName: "game_vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "game_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      game_weapons: {
        Row: {
          ammo_capacity: number | null
          damage: number
          description: string | null
          icon: string | null
          id: string
          name: string
          price: number
          range: number
          weapon_type: string
        }
        Insert: {
          ammo_capacity?: number | null
          damage?: number
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          price?: number
          range?: number
          weapon_type?: string
        }
        Update: {
          ammo_capacity?: number | null
          damage?: number
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          price?: number
          range?: number
          weapon_type?: string
        }
        Relationships: []
      }
      large_transaction_approvals: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          from_wallet_id: string
          id: string
          otp_code: string | null
          otp_expires_at: string | null
          status: string
          to_wallet_id: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          from_wallet_id: string
          id?: string
          otp_code?: string | null
          otp_expires_at?: string | null
          status?: string
          to_wallet_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          from_wallet_id?: string
          id?: string
          otp_code?: string | null
          otp_expires_at?: string | null
          status?: string
          to_wallet_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "large_transaction_approvals_from_wallet_id_fkey"
            columns: ["from_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "large_transaction_approvals_to_wallet_id_fkey"
            columns: ["to_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      miner_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      mining_sessions: {
        Row: {
          captchas_completed: number
          id: string
          is_active: boolean
          session_end: string | null
          session_start: string
          tokens_earned: number
          user_id: string
          wallet_id: string
        }
        Insert: {
          captchas_completed?: number
          id?: string
          is_active?: boolean
          session_end?: string | null
          session_start?: string
          tokens_earned?: number
          user_id: string
          wallet_id: string
        }
        Update: {
          captchas_completed?: number
          id?: string
          is_active?: boolean
          session_end?: string | null
          session_start?: string
          tokens_earned?: number
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mining_sessions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      mining_task_logs: {
        Row: {
          completed_at: string
          id: string
          session_id: string | null
          task_details: Json | null
          task_type: string
          tokens_awarded: number
          user_id: string
          wallet_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          session_id?: string | null
          task_details?: Json | null
          task_type: string
          tokens_awarded?: number
          user_id: string
          wallet_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          session_id?: string | null
          task_details?: Json | null
          task_type?: string
          tokens_awarded?: number
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mining_task_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mining_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mining_task_logs_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          daily_sms_limit: number | null
          daily_sms_reset_at: string | null
          daily_sms_used: number
          default_sender_id: string | null
          email: string
          full_name: string | null
          id: string
          is_approved: boolean
          phone_number: string | null
          sms_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_sms_limit?: number | null
          daily_sms_reset_at?: string | null
          daily_sms_used?: number
          default_sender_id?: string | null
          email: string
          full_name?: string | null
          id?: string
          is_approved?: boolean
          phone_number?: string | null
          sms_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_sms_limit?: number | null
          daily_sms_reset_at?: string | null
          daily_sms_used?: number
          default_sender_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_approved?: boolean
          phone_number?: string | null
          sms_credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promo_orders: {
        Row: {
          admin_notes: string | null
          created_at: string
          crypto_type: string | null
          ends_at: string | null
          id: string
          package_type: string
          payment_method: string
          price_gbp: number
          reviewed_at: string | null
          reviewed_by: string | null
          starts_at: string | null
          status: string
          tx_hash: string | null
          updated_at: string
          user_id: string
          video_title: string | null
          view_count: number
          youtube_url: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          crypto_type?: string | null
          ends_at?: string | null
          id?: string
          package_type: string
          payment_method: string
          price_gbp: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_at?: string | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_id: string
          video_title?: string | null
          view_count?: number
          youtube_url: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          crypto_type?: string | null
          ends_at?: string | null
          id?: string
          package_type?: string
          payment_method?: string
          price_gbp?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_at?: string | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
          video_title?: string | null
          view_count?: number
          youtube_url?: string
        }
        Relationships: []
      }
      purchase_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          credits_amount: number
          currency: string
          destination: string
          id: string
          package_name: string
          price: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          credits_amount: number
          currency?: string
          destination: string
          id?: string
          package_name: string
          price: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          credits_amount?: number
          currency?: string
          destination?: string
          id?: string
          package_name?: string
          price?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      sender_id_requests: {
        Row: {
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          sender_id: string
          status: Database["public"]["Enums"]["sender_id_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["sender_id_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["sender_id_status"]
          user_id?: string
        }
        Relationships: []
      }
      signal_access: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          can_execute_trades: boolean | null
          can_view_signals: boolean | null
          created_at: string
          id: string
          is_approved: boolean | null
          telegram_user_id: number | null
          telegram_username: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          can_execute_trades?: boolean | null
          can_view_signals?: boolean | null
          created_at?: string
          id?: string
          is_approved?: boolean | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          can_execute_trades?: boolean | null
          can_view_signals?: boolean | null
          created_at?: string
          id?: string
          is_approved?: boolean | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          user_id?: string
        }
        Relationships: []
      }
      signal_access_sessions: {
        Row: {
          created_at: string
          credits_charged: number
          expires_at: string
          id: string
          is_active: boolean
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_charged?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_charged?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signal_batches: {
        Row: {
          id: string
          recipient_count: number | null
          sent_at: string
          sent_via: string | null
          subscription_id: string | null
          tokens_included: string[] | null
        }
        Insert: {
          id?: string
          recipient_count?: number | null
          sent_at?: string
          sent_via?: string | null
          subscription_id?: string | null
          tokens_included?: string[] | null
        }
        Update: {
          id?: string
          recipient_count?: number | null
          sent_at?: string
          sent_via?: string | null
          subscription_id?: string | null
          tokens_included?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "signal_batches_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "signal_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_subscriptions: {
        Row: {
          created_at: string
          credits_spent: number
          expires_at: string
          id: string
          is_active: boolean
          plan_type: string
          signals_sent: number
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_spent?: number
          expires_at: string
          id?: string
          is_active?: boolean
          plan_type?: string
          signals_sent?: number
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_spent?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          plan_type?: string
          signals_sent?: number
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signal_trades: {
        Row: {
          amount_sol: number
          closed_at: string | null
          created_at: string
          entry_sol: number | null
          exit_reason: string | null
          exit_signature: string | null
          gross_profit_usd: number | null
          id: string
          mint_address: string
          net_profit_usd: number | null
          output_tokens: number | null
          pnl_percent: number | null
          price_at_trade: number | null
          status: string | null
          targeted_ca: string | null
          token_amount: number | null
          token_name: string | null
          token_signal_id: string | null
          token_symbol: string | null
          trade_type: string
          tx_signature: string | null
          user_id: string
        }
        Insert: {
          amount_sol: number
          closed_at?: string | null
          created_at?: string
          entry_sol?: number | null
          exit_reason?: string | null
          exit_signature?: string | null
          gross_profit_usd?: number | null
          id?: string
          mint_address: string
          net_profit_usd?: number | null
          output_tokens?: number | null
          pnl_percent?: number | null
          price_at_trade?: number | null
          status?: string | null
          targeted_ca?: string | null
          token_amount?: number | null
          token_name?: string | null
          token_signal_id?: string | null
          token_symbol?: string | null
          trade_type: string
          tx_signature?: string | null
          user_id: string
        }
        Update: {
          amount_sol?: number
          closed_at?: string | null
          created_at?: string
          entry_sol?: number | null
          exit_reason?: string | null
          exit_signature?: string | null
          gross_profit_usd?: number | null
          id?: string
          mint_address?: string
          net_profit_usd?: number | null
          output_tokens?: number | null
          pnl_percent?: number | null
          price_at_trade?: number | null
          status?: string | null
          targeted_ca?: string | null
          token_amount?: number | null
          token_name?: string | null
          token_signal_id?: string | null
          token_symbol?: string | null
          trade_type?: string
          tx_signature?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_trades_token_signal_id_fkey"
            columns: ["token_signal_id"]
            isOneToOne: false
            referencedRelation: "token_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      sip_call_sessions: {
        Row: {
          ai_confidence_score: number | null
          call_status: string | null
          caller_id: string | null
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          receptionist_config_id: string | null
          recording_url: string | null
          sentiment: string | null
          sip_config_id: string | null
          started_at: string | null
          tokens_used: number | null
          transcript: Json | null
          user_id: string
        }
        Insert: {
          ai_confidence_score?: number | null
          call_status?: string | null
          caller_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          receptionist_config_id?: string | null
          recording_url?: string | null
          sentiment?: string | null
          sip_config_id?: string | null
          started_at?: string | null
          tokens_used?: number | null
          transcript?: Json | null
          user_id: string
        }
        Update: {
          ai_confidence_score?: number | null
          call_status?: string | null
          caller_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          receptionist_config_id?: string | null
          recording_url?: string | null
          sentiment?: string | null
          sip_config_id?: string | null
          started_at?: string | null
          tokens_used?: number | null
          transcript?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sip_call_sessions_receptionist_config_id_fkey"
            columns: ["receptionist_config_id"]
            isOneToOne: false
            referencedRelation: "ai_receptionist_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sip_call_sessions_sip_config_id_fkey"
            columns: ["sip_config_id"]
            isOneToOne: false
            referencedRelation: "sip_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      sip_configurations: {
        Row: {
          allowed_numbers: Json | null
          auth_username: string | null
          connection_status: string | null
          created_at: string | null
          domain: string
          id: string
          inbound_number: string | null
          is_active: boolean | null
          last_tested_at: string | null
          password_encrypted: string
          port: number
          provider_name: string
          sip_username: string
          transport: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allowed_numbers?: Json | null
          auth_username?: string | null
          connection_status?: string | null
          created_at?: string | null
          domain: string
          id?: string
          inbound_number?: string | null
          is_active?: boolean | null
          last_tested_at?: string | null
          password_encrypted: string
          port?: number
          provider_name?: string
          sip_username: string
          transport?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allowed_numbers?: Json | null
          auth_username?: string | null
          connection_status?: string | null
          created_at?: string | null
          domain?: string
          id?: string
          inbound_number?: string | null
          is_active?: boolean | null
          last_tested_at?: string | null
          password_encrypted?: string
          port?: number
          provider_name?: string
          sip_username?: string
          transport?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          api_response: Json | null
          created_at: string
          credits_used: number
          destination: Database["public"]["Enums"]["sms_destination"]
          id: string
          message: string
          recipient: string
          sender_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          api_response?: Json | null
          created_at?: string
          credits_used?: number
          destination: Database["public"]["Enums"]["sms_destination"]
          id?: string
          message: string
          recipient: string
          sender_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          api_response?: Json | null
          created_at?: string
          credits_used?: number
          destination?: Database["public"]["Enums"]["sms_destination"]
          id?: string
          message?: string
          recipient?: string
          sender_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      solana_wallets: {
        Row: {
          auto_trade_settings: Json | null
          balance_sol: number | null
          created_at: string
          encrypted_private_key: string | null
          id: string
          is_trading_enabled: boolean | null
          last_balance_check: string | null
          public_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_trade_settings?: Json | null
          balance_sol?: number | null
          created_at?: string
          encrypted_private_key?: string | null
          id?: string
          is_trading_enabled?: boolean | null
          last_balance_check?: string | null
          public_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_trade_settings?: Json | null
          balance_sol?: number | null
          created_at?: string
          encrypted_private_key?: string | null
          id?: string
          is_trading_enabled?: boolean | null
          last_balance_check?: string | null
          public_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_bot_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          groups_sent_to: number | null
          id: string
          message: string
          metadata: Json | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          groups_sent_to?: number | null
          id?: string
          message: string
          metadata?: Json | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          groups_sent_to?: number | null
          id?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      telegram_bot_groups: {
        Row: {
          added_at: string | null
          chat_id: number
          chat_title: string | null
          chat_type: string | null
          id: string
          is_active: boolean | null
          last_alert_at: string | null
        }
        Insert: {
          added_at?: string | null
          chat_id: number
          chat_title?: string | null
          chat_type?: string | null
          id?: string
          is_active?: boolean | null
          last_alert_at?: string | null
        }
        Update: {
          added_at?: string | null
          chat_id?: number
          chat_title?: string | null
          chat_type?: string | null
          id?: string
          is_active?: boolean | null
          last_alert_at?: string | null
        }
        Relationships: []
      }
      telnyx_phone_requests: {
        Row: {
          admin_notes: string | null
          agent_id: string | null
          agent_name: string | null
          created_at: string
          credits_charged: number
          id: string
          phone_number: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          telnyx_number_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          agent_id?: string | null
          agent_name?: string | null
          created_at?: string
          credits_charged?: number
          id?: string
          phone_number: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          telnyx_number_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          agent_id?: string | null
          agent_name?: string | null
          created_at?: string
          credits_charged?: number
          id?: string
          phone_number?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          telnyx_number_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telnyx_phone_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_twins"
            referencedColumns: ["id"]
          },
        ]
      }
      token_holdings: {
        Row: {
          amount: number
          avg_buy_price: number
          created_at: string
          id: string
          token_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          avg_buy_price?: number
          created_at?: string
          id?: string
          token_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          avg_buy_price?: number
          created_at?: string
          id?: string
          token_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_holdings_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "user_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      token_news: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          impact: string | null
          metadata: Json | null
          title: string
          token_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          impact?: string | null
          metadata?: Json | null
          title: string
          token_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          impact?: string | null
          metadata?: Json | null
          title?: string
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_news_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "user_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      token_signals: {
        Row: {
          created_time: string
          first_seen_at: string
          id: string
          liquidity_sol: number | null
          market_cap_sol: number | null
          metadata: Json | null
          mint_address: string
          price_usd: number | null
          source: string | null
          token_name: string
          token_symbol: string
        }
        Insert: {
          created_time: string
          first_seen_at?: string
          id?: string
          liquidity_sol?: number | null
          market_cap_sol?: number | null
          metadata?: Json | null
          mint_address: string
          price_usd?: number | null
          source?: string | null
          token_name: string
          token_symbol: string
        }
        Update: {
          created_time?: string
          first_seen_at?: string
          id?: string
          liquidity_sol?: number | null
          market_cap_sol?: number | null
          metadata?: Json | null
          mint_address?: string
          price_usd?: number | null
          source?: string | null
          token_name?: string
          token_symbol?: string
        }
        Relationships: []
      }
      token_transactions: {
        Row: {
          amount: number
          buyer_id: string | null
          created_at: string
          id: string
          price_per_token: number
          seller_id: string | null
          token_id: string
          total_credits: number
          transaction_type: string
        }
        Insert: {
          amount: number
          buyer_id?: string | null
          created_at?: string
          id?: string
          price_per_token?: number
          seller_id?: string | null
          token_id: string
          total_credits: number
          transaction_type: string
        }
        Update: {
          amount?: number
          buyer_id?: string | null
          created_at?: string
          id?: string
          price_per_token?: number
          seller_id?: string | null
          token_id?: string
          total_credits?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_transactions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "user_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_notifications: {
        Row: {
          amount_sol: number
          created_at: string
          id: string
          profit_percent: number
          token_name: string
          token_symbol: string
          user_id: string
          username: string
        }
        Insert: {
          amount_sol?: number
          created_at?: string
          id?: string
          profit_percent: number
          token_name: string
          token_symbol: string
          user_id: string
          username?: string
        }
        Update: {
          amount_sol?: number
          created_at?: string
          id?: string
          profit_percent?: number
          token_name?: string
          token_symbol?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          credits_purchased: number
          currency: string
          id: string
          payment_method: string
          payment_reference: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credits_purchased: number
          currency?: string
          id?: string
          payment_method: string
          payment_reference?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credits_purchased?: number
          currency?: string
          id?: string
          payment_method?: string
          payment_reference?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      url_whitelist_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          url: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          url: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_tokens: {
        Row: {
          circulating_supply: number
          created_at: string
          creator_id: string
          description: string | null
          holder_count: number | null
          id: string
          is_featured: boolean | null
          logo_emoji: string | null
          market_cap: number
          name: string
          price_per_token: number
          status: Database["public"]["Enums"]["token_status"]
          symbol: string
          total_sales_value: number
          total_supply: number
          total_volume: number
          updated_at: string
        }
        Insert: {
          circulating_supply?: number
          created_at?: string
          creator_id: string
          description?: string | null
          holder_count?: number | null
          id?: string
          is_featured?: boolean | null
          logo_emoji?: string | null
          market_cap?: number
          name: string
          price_per_token?: number
          status?: Database["public"]["Enums"]["token_status"]
          symbol: string
          total_sales_value?: number
          total_supply?: number
          total_volume?: number
          updated_at?: string
        }
        Update: {
          circulating_supply?: number
          created_at?: string
          creator_id?: string
          description?: string | null
          holder_count?: number | null
          id?: string
          is_featured?: boolean | null
          logo_emoji?: string | null
          market_cap?: number
          name?: string
          price_per_token?: number
          status?: Database["public"]["Enums"]["token_status"]
          symbol?: string
          total_sales_value?: number
          total_supply?: number
          total_volume?: number
          updated_at?: string
        }
        Relationships: []
      }
      vm_rentals: {
        Row: {
          created_at: string
          credits_paid: number
          expires_at: string
          id: string
          is_active: boolean
          plan_type: string
          started_at: string
          time_remaining_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_paid: number
          expires_at: string
          id?: string
          is_active?: boolean
          plan_type?: string
          started_at?: string
          time_remaining_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_paid?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          plan_type?: string
          started_at?: string
          time_remaining_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_profiles: {
        Row: {
          audio_file_url: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          metadata: Json | null
          provider: string
          quality_score: number | null
          sample_duration_seconds: number | null
          training_status: string | null
          updated_at: string | null
          user_id: string
          voice_id: string | null
          voice_name: string
        }
        Insert: {
          audio_file_url?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          metadata?: Json | null
          provider: string
          quality_score?: number | null
          sample_duration_seconds?: number | null
          training_status?: string | null
          updated_at?: string | null
          user_id: string
          voice_id?: string | null
          voice_name: string
        }
        Update: {
          audio_file_url?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          metadata?: Json | null
          provider?: string
          quality_score?: number | null
          sample_duration_seconds?: number | null
          training_status?: string | null
          updated_at?: string | null
          user_id?: string
          voice_id?: string | null
          voice_name?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          device_info: string | null
          from_wallet_id: string | null
          id: string
          ip_address: string | null
          is_deleted_by_receiver: boolean
          is_deleted_by_sender: boolean
          metadata: Json | null
          status: string
          to_wallet_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          device_info?: string | null
          from_wallet_id?: string | null
          id?: string
          ip_address?: string | null
          is_deleted_by_receiver?: boolean
          is_deleted_by_sender?: boolean
          metadata?: Json | null
          status?: string
          to_wallet_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          device_info?: string | null
          from_wallet_id?: string | null
          id?: string
          ip_address?: string | null
          is_deleted_by_receiver?: boolean
          is_deleted_by_sender?: boolean
          metadata?: Json | null
          status?: string
          to_wallet_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_from_wallet_id_fkey"
            columns: ["from_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_to_wallet_id_fkey"
            columns: ["to_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          is_miner_approved: boolean
          is_verified: boolean | null
          last_login_at: string | null
          last_login_device: string | null
          last_login_ip: string | null
          total_mined: number
          total_received: number
          total_sent: number
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          is_miner_approved?: boolean
          is_verified?: boolean | null
          last_login_at?: string | null
          last_login_device?: string | null
          last_login_ip?: string | null
          total_mined?: number
          total_received?: number
          total_sent?: number
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          is_miner_approved?: boolean
          is_verified?: boolean | null
          last_login_at?: string | null
          last_login_device?: string | null
          last_login_ip?: string | null
          total_mined?: number
          total_received?: number
          total_sent?: number
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
          wallet_address: string
          wallet_id: string
          withdrawal_type: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
          wallet_address: string
          wallet_id: string
          withdrawal_type: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
          wallet_address?: string
          wallet_id?: string
          withdrawal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_forum_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          is_verified: boolean
          posts_count: number
          rank: number
          reactions_received: number
          replies_count: number
          reputation_score: number
          user_id: string
          username: string
        }[]
      }
      get_mining_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          captchas_completed: number
          is_current_user: boolean
          is_verified: boolean
          rank: number
          tokens_earned: number
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      character_gender: "male" | "female" | "other"
      job_type:
        | "unemployed"
        | "police"
        | "medic"
        | "taxi_driver"
        | "mechanic"
        | "criminal"
        | "business_owner"
        | "gang_member"
      organization_type: "gang" | "business" | "police_department" | "hospital"
      property_type:
        | "small_apartment"
        | "medium_house"
        | "large_mansion"
        | "business"
        | "gang_hideout"
      sender_id_status: "pending" | "approved" | "rejected"
      sms_destination: "uk" | "usa"
      token_status:
        | "active"
        | "established"
        | "verified"
        | "graduated"
        | "suspended"
      vehicle_type:
        | "bicycle"
        | "motorcycle"
        | "sedan"
        | "sports_car"
        | "suv"
        | "truck"
        | "taxi"
        | "police_car"
        | "ambulance"
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
      app_role: ["admin", "user"],
      character_gender: ["male", "female", "other"],
      job_type: [
        "unemployed",
        "police",
        "medic",
        "taxi_driver",
        "mechanic",
        "criminal",
        "business_owner",
        "gang_member",
      ],
      organization_type: ["gang", "business", "police_department", "hospital"],
      property_type: [
        "small_apartment",
        "medium_house",
        "large_mansion",
        "business",
        "gang_hideout",
      ],
      sender_id_status: ["pending", "approved", "rejected"],
      sms_destination: ["uk", "usa"],
      token_status: [
        "active",
        "established",
        "verified",
        "graduated",
        "suspended",
      ],
      vehicle_type: [
        "bicycle",
        "motorcycle",
        "sedan",
        "sports_car",
        "suv",
        "truck",
        "taxi",
        "police_car",
        "ambulance",
      ],
    },
  },
} as const
