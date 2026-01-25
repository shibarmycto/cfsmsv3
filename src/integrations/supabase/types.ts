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
      sender_id_status: "pending" | "approved" | "rejected"
      sms_destination: "uk" | "usa"
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
      sender_id_status: ["pending", "approved", "rejected"],
      sms_destination: ["uk", "usa"],
    },
  },
} as const
