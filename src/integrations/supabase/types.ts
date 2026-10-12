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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          active: boolean
          created_at: string
          description_de: string | null
          description_en: string | null
          id: string
          image_path: string | null
          name_de: string
          name_en: string | null
          slug: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description_de?: string | null
          description_en?: string | null
          id?: string
          image_path?: string | null
          name_de: string
          name_en?: string | null
          slug: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description_de?: string | null
          description_en?: string | null
          id?: string
          image_path?: string | null
          name_de?: string
          name_en?: string | null
          slug?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          ends_at: string | null
          id: string
          kind: Database["public"]["Enums"]["discount_kind"]
          max_redemptions: number | null
          min_subtotal_cents: number
          note: string | null
          redemptions: number
          starts_at: string | null
          updated_at: string
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          ends_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["discount_kind"]
          max_redemptions?: number | null
          min_subtotal_cents?: number
          note?: string | null
          redemptions?: number
          starts_at?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["discount_kind"]
          max_redemptions?: number | null
          min_subtotal_cents?: number
          note?: string | null
          redemptions?: number
          starts_at?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      gift_card_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          delta_cents: number
          gift_card_id: string
          id: number
          kind: Database["public"]["Enums"]["gift_card_tx_kind"]
          note: string | null
          order_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta_cents: number
          gift_card_id: string
          id?: never
          kind: Database["public"]["Enums"]["gift_card_tx_kind"]
          note?: string | null
          order_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta_cents?: number
          gift_card_id?: string
          id?: never
          kind?: Database["public"]["Enums"]["gift_card_tx_kind"]
          note?: string | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_transactions_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          balance_cents: number
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          initial_cents: number
          locale: string
          message: string | null
          note: string | null
          purchase_order_id: string | null
          purchaser_email: string | null
          recipient_email: string | null
          recipient_name: string | null
          sender_name: string | null
          status: Database["public"]["Enums"]["gift_card_status"]
          updated_at: string
        }
        Insert: {
          balance_cents: number
          code: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          initial_cents: number
          locale?: string
          message?: string | null
          note?: string | null
          purchase_order_id?: string | null
          purchaser_email?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sender_name?: string | null
          status?: Database["public"]["Enums"]["gift_card_status"]
          updated_at?: string
        }
        Update: {
          balance_cents?: number
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          initial_cents?: number
          locale?: string
          message?: string | null
          note?: string | null
          purchase_order_id?: string | null
          purchaser_email?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sender_name?: string | null
          status?: Database["public"]["Enums"]["gift_card_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          confirmed_at: string | null
          consent_at: string
          consent_text: string
          created_at: string
          email: string
          id: string
          locale: string
          source: string
          status: Database["public"]["Enums"]["newsletter_status"]
          token_hash: string | null
          unsubscribed_at: string | null
          updated_at: string
          welcome_code: string | null
        }
        Insert: {
          confirmed_at?: string | null
          consent_at?: string
          consent_text: string
          created_at?: string
          email: string
          id?: string
          locale?: string
          source?: string
          status?: Database["public"]["Enums"]["newsletter_status"]
          token_hash?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          welcome_code?: string | null
        }
        Update: {
          confirmed_at?: string | null
          consent_at?: string
          consent_text?: string
          created_at?: string
          email?: string
          id?: string
          locale?: string
          source?: string
          status?: Database["public"]["Enums"]["newsletter_status"]
          token_hash?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          welcome_code?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          color: string | null
          created_at: string
          handle: string | null
          id: string
          image: string | null
          line_total_cents: number
          order_id: string
          product_id: string | null
          quantity: number
          restocked_quantity: number
          size: string | null
          title: string
          unit_price_cents: number
          variant_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          handle?: string | null
          id?: string
          image?: string | null
          line_total_cents: number
          order_id: string
          product_id?: string | null
          quantity: number
          restocked_quantity?: number
          size?: string | null
          title: string
          unit_price_cents: number
          variant_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          handle?: string | null
          id?: string
          image?: string | null
          line_total_cents?: number
          order_id?: string
          product_id?: string | null
          quantity?: number
          restocked_quantity?: number
          size?: string | null
          title?: string
          unit_price_cents?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_note: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          confirmation_sent_at: string | null
          created_at: string
          currency: string
          discount_cents: number
          discount_code: string | null
          discount_code_id: string | null
          email: string
          expires_at: string | null
          gift_card_cents: number
          gift_card_id: string | null
          gift_card_purchase: Json | null
          gift_card_sent_at: string | null
          id: string
          issued_gift_card_id: string | null
          kind: Database["public"]["Enums"]["order_kind"]
          locale: string
          needs_attention: boolean
          notification_sent_at: string | null
          number: number
          paid_at: string | null
          payment_method: string | null
          phone: string | null
          refunded_cents: number
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cents: number
          shipping_name: string | null
          shipping_sent_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          status_token: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal_cents: number
          total_cents: number
          tracking_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          discount_code?: string | null
          discount_code_id?: string | null
          email: string
          expires_at?: string | null
          gift_card_cents?: number
          gift_card_id?: string | null
          gift_card_purchase?: Json | null
          gift_card_sent_at?: string | null
          id?: string
          issued_gift_card_id?: string | null
          kind?: Database["public"]["Enums"]["order_kind"]
          locale?: string
          needs_attention?: boolean
          notification_sent_at?: string | null
          number?: number
          paid_at?: string | null
          payment_method?: string | null
          phone?: string | null
          refunded_cents?: number
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cents?: number
          shipping_name?: string | null
          shipping_sent_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_token?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_cents: number
          total_cents: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          discount_code?: string | null
          discount_code_id?: string | null
          email?: string
          expires_at?: string | null
          gift_card_cents?: number
          gift_card_id?: string | null
          gift_card_purchase?: Json | null
          gift_card_sent_at?: string | null
          id?: string
          issued_gift_card_id?: string | null
          kind?: Database["public"]["Enums"]["order_kind"]
          locale?: string
          needs_attention?: boolean
          notification_sent_at?: string | null
          number?: number
          paid_at?: string | null
          payment_method?: string | null
          phone?: string | null
          refunded_cents?: number
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cents?: number
          shipping_name?: string | null
          shipping_sent_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_token?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number
          total_cents?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_issued_gift_card_id_fkey"
            columns: ["issued_gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_de: string
          alt_en: string | null
          created_at: string
          height: number
          id: string
          path: string
          product_id: string
          sort: number
          width: number
        }
        Insert: {
          alt_de?: string
          alt_en?: string | null
          created_at?: string
          height?: number
          id?: string
          path: string
          product_id: string
          sort?: number
          width?: number
        }
        Update: {
          alt_de?: string
          alt_en?: string | null
          created_at?: string
          height?: number
          id?: string
          path?: string
          product_id?: string
          sort?: number
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          active: boolean
          barcode: string | null
          compare_at_cents: number | null
          created_at: string
          id: string
          price_cents: number | null
          product_id: string
          size: string
          sku: string | null
          sort: number
          stock: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          compare_at_cents?: number | null
          created_at?: string
          id?: string
          price_cents?: number | null
          product_id: string
          size: string
          sku?: string | null
          sort?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          compare_at_cents?: number | null
          created_at?: string
          id?: string
          price_cents?: number | null
          product_id?: string
          size?: string
          sku?: string | null
          sort?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          care_de: string | null
          care_en: string | null
          category_id: string
          color_hex: string
          color_name_de: string
          color_name_en: string | null
          compare_at_cents: number | null
          created_at: string
          description_de: string
          description_en: string | null
          fit: string | null
          fit_note_de: string | null
          fit_note_en: string | null
          handle: string
          id: string
          material_de: string | null
          material_en: string | null
          model: string
          occasions: string[]
          outfit_handles: string[]
          price_cents: number
          sort: number
          status: Database["public"]["Enums"]["product_status"]
          tags: string[]
          title_de: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          care_de?: string | null
          care_en?: string | null
          category_id: string
          color_hex: string
          color_name_de: string
          color_name_en?: string | null
          compare_at_cents?: number | null
          created_at?: string
          description_de?: string
          description_en?: string | null
          fit?: string | null
          fit_note_de?: string | null
          fit_note_en?: string | null
          handle: string
          id?: string
          material_de?: string | null
          material_en?: string | null
          model: string
          occasions?: string[]
          outfit_handles?: string[]
          price_cents: number
          sort?: number
          status?: Database["public"]["Enums"]["product_status"]
          tags?: string[]
          title_de: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          care_de?: string | null
          care_en?: string | null
          category_id?: string
          color_hex?: string
          color_name_de?: string
          color_name_en?: string | null
          compare_at_cents?: number | null
          created_at?: string
          description_de?: string
          description_en?: string | null
          fit?: string | null
          fit_note_de?: string | null
          fit_note_en?: string | null
          handle?: string
          id?: string
          material_de?: string | null
          material_en?: string | null
          model?: string
          occasions?: string[]
          outfit_handles?: string[]
          price_cents?: number
          sort?: number
          status?: Database["public"]["Enums"]["product_status"]
          tags?: string[]
          title_de?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: Json | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: Json | null
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shop_settings: {
        Row: {
          free_shipping_from_cents: number | null
          gift_card_max_cents: number
          gift_card_min_cents: number
          gift_card_valid_years: number
          id: number
          newsletter_welcome_percent: number | null
          notify_email: string | null
          shipping_cents: number
          updated_at: string
        }
        Insert: {
          free_shipping_from_cents?: number | null
          gift_card_max_cents?: number
          gift_card_min_cents?: number
          gift_card_valid_years?: number
          id?: number
          newsletter_welcome_percent?: number | null
          notify_email?: string | null
          shipping_cents?: number
          updated_at?: string
        }
        Update: {
          free_shipping_from_cents?: number | null
          gift_card_max_cents?: number
          gift_card_min_cents?: number
          gift_card_valid_years?: number
          id?: number
          newsletter_welcome_percent?: number | null
          notify_email?: string | null
          shipping_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: number
          note: string | null
          order_id: string | null
          reason: Database["public"]["Enums"]["stock_reason"]
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: never
          note?: string | null
          order_id?: string | null
          reason: Database["public"]["Enums"]["stock_reason"]
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: never
          note?: string | null
          order_id?: string | null
          reason?: Database["public"]["Enums"]["stock_reason"]
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          id: string
          processed_at: string | null
          received_at: string
          type: string
        }
        Insert: {
          id: string
          processed_at?: string | null
          received_at?: string
          type: string
        }
        Update: {
          id?: string
          processed_at?: string | null
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_stock: {
        Args: {
          p_delta: number
          p_note?: string
          p_reason: Database["public"]["Enums"]["stock_reason"]
          p_variant_id: string
        }
        Returns: number
      }
      admin_dashboard: { Args: { p_from: string; p_to: string }; Returns: Json }
      admin_get_settings: { Args: never; Returns: Json }
      admin_grant_admin: { Args: { p_email: string }; Returns: Json }
      admin_list_admins: {
        Args: never
        Returns: {
          created_at: string
          email: string
          user_id: string
        }[]
      }
      admin_restock_order: {
        Args: { p_items: Json; p_order_id: string }
        Returns: Json
      }
      admin_revoke_admin: { Args: { p_user_id: string }; Returns: undefined }
      attach_checkout_session: {
        Args: { p_expires_at: string; p_order_id: string; p_session_id: string }
        Returns: undefined
      }
      cancel_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: boolean
      }
      check_discount: {
        Args: { p_code: string; p_subtotal_cents: number }
        Returns: Json
      }
      check_gift_card: { Args: { p_code: string }; Returns: Json }
      claim_guest_orders: { Args: never; Returns: number }
      complete_order: {
        Args: { p_order_id: string; p_payment?: Json }
        Returns: Json
      }
      finish_stripe_event: { Args: { p_event_id: string }; Returns: undefined }
      forget_stripe_event: { Args: { p_event_id: string }; Returns: undefined }
      get_gift_card_for_email: {
        Args: { p_gift_card_id: string }
        Returns: Json
      }
      get_order_for_email: { Args: { p_order_id: string }; Returns: Json }
      get_order_status: { Args: { p_token: string }; Returns: Json }
      get_shop_notify_email: { Args: never; Returns: string }
      issue_gift_card: {
        Args: {
          p_amount_cents: number
          p_created_by?: string
          p_locale: string
          p_message?: string
          p_note?: string
          p_recipient_email: string
          p_recipient_name?: string
          p_sender_name?: string
        }
        Returns: Json
      }
      mark_order_email_sent: {
        Args: { p_kind: string; p_order_id: string }
        Returns: undefined
      }
      mark_order_shipped: {
        Args: { p_order_id: string; p_tracking: string }
        Returns: Json
      }
      newsletter_confirm: { Args: { p_token: string }; Returns: Json }
      newsletter_subscribe: {
        Args: {
          p_consent: string
          p_email: string
          p_ip?: string
          p_locale: string
          p_source?: string
        }
        Returns: Json
      }
      newsletter_unsubscribe: { Args: { p_token: string }; Returns: Json }
      prepare_account_deletion: { Args: { p_user_id: string }; Returns: Json }
      record_refund: {
        Args: { p_payment_intent_id: string; p_refunded_cents: number }
        Returns: Json
      }
      register_stripe_event: {
        Args: { p_event_id: string; p_type: string }
        Returns: string
      }
      release_expired_orders: { Args: { p_grace?: string }; Returns: number }
      reserve_checkout: {
        Args: {
          p_discount_code?: string
          p_email: string
          p_gift_card_code?: string
          p_lines: Json
          p_locale?: string
          p_user_id?: string
        }
        Returns: Json
      }
      reserve_gift_card_purchase: {
        Args: {
          p_amount_cents: number
          p_email: string
          p_locale?: string
          p_purchase?: Json
          p_user_id?: string
        }
        Returns: Json
      }
      user_is_admin: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin"
      discount_kind: "percent" | "amount"
      gift_card_status: "active" | "disabled"
      gift_card_tx_kind: "issue" | "redeem" | "release" | "adjust"
      newsletter_status: "pending" | "confirmed" | "unsubscribed"
      order_kind: "cart" | "gift_card"
      order_status: "pending" | "paid" | "shipped" | "cancelled" | "refunded"
      product_status: "draft" | "active" | "archived"
      stock_reason:
        | "reservation"
        | "release"
        | "sale_store"
        | "return"
        | "correction"
        | "reclaim"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
      discount_kind: ["percent", "amount"],
      gift_card_status: ["active", "disabled"],
      gift_card_tx_kind: ["issue", "redeem", "release", "adjust"],
      newsletter_status: ["pending", "confirmed", "unsubscribed"],
      order_kind: ["cart", "gift_card"],
      order_status: ["pending", "paid", "shipped", "cancelled", "refunded"],
      product_status: ["draft", "active", "archived"],
      stock_reason: [
        "reservation",
        "release",
        "sale_store",
        "return",
        "correction",
        "reclaim",
      ],
    },
  },
} as const
