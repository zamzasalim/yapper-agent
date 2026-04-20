export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type JobType   = "content" | "repost" | "like_reply" | "campaign" | "custom";
export type JobStatus = "open" | "in_progress" | "completed" | "cancelled" | "pending_approval";
export type UserRole  = "creator" | "client" | "agent";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          created_at: string;
          privy_did: string;
          wallet_address: string;
          twitter_handle: string;
          twitter_id: string;
          twitter_followers: number;
          display_name: string;
          avatar_url: string | null;
          is_verified_blue: boolean;
          bio: string | null;
          telegram_chat_id: string | null;
          telegram_username: string | null;
          telegram_link_token: string | null;
          telegram_token_expires_at: string | null;
          telegram_pending_job_id: string | null;
          role: UserRole;
          total_earned_usdc: number;
          jobs_completed: number;
          rating: number;
          niches: string[];
        };
        Insert: {
          id: string;
          created_at?: string;
          privy_did: string;
          wallet_address: string;
          twitter_handle: string;
          twitter_id: string;
          twitter_followers?: number;
          display_name: string;
          avatar_url?: string | null;
          is_verified_blue?: boolean;
          bio?: string | null;
          telegram_chat_id?: string | null;
          telegram_username?: string | null;
          telegram_link_token?: string | null;
          telegram_token_expires_at?: string | null;
          telegram_pending_job_id?: string | null;
          role: UserRole;
          total_earned_usdc?: number;
          jobs_completed?: number;
          rating?: number;
          niches?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          created_at: string;
          client_id: string;
          creator_id: string | null;
          type: JobType;
          status: JobStatus;
          title: string;
          description: string;
          price_usdc: number;
          tweet_url: string | null;
          content_brief: string | null;
          proof_url: string | null;
          is_agent_job: boolean;
          deadline_hours: number;
          telegram_message_id: string | null;
          rating: number | null;
          tx_hash: string | null;
          max_creators: number;
          slots_taken: number;
          require_blue: boolean;
          min_followers: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          client_id: string;
          creator_id?: string | null;
          type: JobType;
          status?: JobStatus;
          title: string;
          description: string;
          price_usdc: number;
          tweet_url?: string | null;
          content_brief?: string | null;
          proof_url?: string | null;
          is_agent_job?: boolean;
          deadline_hours: number;
          telegram_message_id?: string | null;
          rating?: number | null;
          tx_hash?: string | null;
          max_creators?: number;
          slots_taken?: number;
          require_blue?: boolean;
          min_followers?: number;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [];
      };
      job_completions: {
        Row: {
          id: string;
          created_at: string;
          job_id: string;
          creator_id: string;
          proof_url: string | null;
          status: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          job_id: string;
          creator_id: string;
          proof_url?: string | null;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["job_completions"]["Insert"]>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          created_at: string;
          job_id: string;
          from_wallet: string;
          to_wallet: string;
          amount_usdc: number;
          tx_signature: string;
          confirmed: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          job_id: string;
          from_wallet: string;
          to_wallet: string;
          amount_usdc: number;
          tx_signature: string;
          confirmed?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
