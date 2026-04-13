export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type JobType = "content" | "repost" | "reply" | "like" | "custom";
export type JobStatus = "open" | "in_progress" | "completed" | "cancelled";
export type UserRole = "creator" | "client" | "agent";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          created_at: string;
          wallet_address: string;
          twitter_handle: string;
          twitter_id: string;
          twitter_followers: number;
          display_name: string;
          avatar_url: string | null;
          is_verified_blue: boolean;
          bio: string | null;
          telegram_chat_id: string | null;
          role: UserRole;
          total_earned_usdc: number;
          jobs_completed: number;
          rating: number;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "created_at" | "total_earned_usdc" | "jobs_completed" | "rating">;
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
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
        };
        Insert: Omit<Database["public"]["Tables"]["jobs"]["Row"], "created_at" | "creator_id" | "proof_url" | "telegram_message_id">;
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
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
        Insert: Omit<Database["public"]["Tables"]["transactions"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
