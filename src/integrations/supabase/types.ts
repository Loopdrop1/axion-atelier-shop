// Automatisch erzeugt mit scripts/db/gen-types.ts aus den Migrationen. Nicht von Hand ändern.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          slug: string;
          name_de: string;
          name_en: string | null;
          description_de: string | null;
          description_en: string | null;
          en_auto: string[];
          image_path: string | null;
          sort: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name_de: string;
          name_en?: string | null;
          description_de?: string | null;
          description_en?: string | null;
          en_auto?: string[];
          image_path?: string | null;
          sort?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name_de?: string;
          name_en?: string | null;
          description_de?: string | null;
          description_en?: string | null;
          en_auto?: string[];
          image_path?: string | null;
          sort?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      discount_codes: {
        Row: {
          id: string;
          code: string;
          kind: Database["public"]["Enums"]["discount_kind"];
          value: number;
          min_subtotal_cents: number;
          starts_at: string | null;
          ends_at: string | null;
          max_redemptions: number | null;
          redemptions: number;
          active: boolean;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          kind: Database["public"]["Enums"]["discount_kind"];
          value: number;
          min_subtotal_cents?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          max_redemptions?: number | null;
          redemptions?: number;
          active?: boolean;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          kind?: Database["public"]["Enums"]["discount_kind"];
          value?: number;
          min_subtotal_cents?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          max_redemptions?: number | null;
          redemptions?: number;
          active?: boolean;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gift_card_transactions: {
        Row: {
          id: number;
          gift_card_id: string;
          order_id: string | null;
          delta_cents: number;
          kind: Database["public"]["Enums"]["gift_card_tx_kind"];
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          gift_card_id: string;
          order_id?: string | null;
          delta_cents: number;
          kind: Database["public"]["Enums"]["gift_card_tx_kind"];
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          gift_card_id?: string;
          order_id?: string | null;
          delta_cents?: number;
          kind?: Database["public"]["Enums"]["gift_card_tx_kind"];
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gift_card_transactions_gift_card_id_fkey";
            columns: ["gift_card_id"];
            isOneToOne: false;
            referencedRelation: "gift_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gift_card_transactions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      gift_cards: {
        Row: {
          id: string;
          code: string;
          initial_cents: number;
          balance_cents: number;
          status: Database["public"]["Enums"]["gift_card_status"];
          expires_at: string;
          locale: string;
          purchaser_email: string | null;
          recipient_email: string | null;
          recipient_name: string | null;
          sender_name: string | null;
          message: string | null;
          purchase_order_id: string | null;
          created_by: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          initial_cents: number;
          balance_cents: number;
          status?: Database["public"]["Enums"]["gift_card_status"];
          expires_at: string;
          locale?: string;
          purchaser_email?: string | null;
          recipient_email?: string | null;
          recipient_name?: string | null;
          sender_name?: string | null;
          message?: string | null;
          purchase_order_id?: string | null;
          created_by?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          initial_cents?: number;
          balance_cents?: number;
          status?: Database["public"]["Enums"]["gift_card_status"];
          expires_at?: string;
          locale?: string;
          purchaser_email?: string | null;
          recipient_email?: string | null;
          recipient_name?: string | null;
          sender_name?: string | null;
          message?: string | null;
          purchase_order_id?: string | null;
          created_by?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gift_cards_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      newsletter_subscribers: {
        Row: {
          id: string;
          email: string;
          locale: string;
          status: Database["public"]["Enums"]["newsletter_status"];
          consent_text: string;
          consent_at: string;
          source: string;
          token_hash: string | null;
          confirmed_at: string | null;
          unsubscribed_at: string | null;
          welcome_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          locale?: string;
          status?: Database["public"]["Enums"]["newsletter_status"];
          consent_text: string;
          consent_at?: string;
          source?: string;
          token_hash?: string | null;
          confirmed_at?: string | null;
          unsubscribed_at?: string | null;
          welcome_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          locale?: string;
          status?: Database["public"]["Enums"]["newsletter_status"];
          consent_text?: string;
          consent_at?: string;
          source?: string;
          token_hash?: string | null;
          confirmed_at?: string | null;
          unsubscribed_at?: string | null;
          welcome_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          variant_id: string | null;
          handle: string | null;
          title: string;
          size: string | null;
          color: string | null;
          image: string | null;
          unit_price_cents: number;
          quantity: number;
          line_total_cents: number;
          restocked_quantity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          variant_id?: string | null;
          handle?: string | null;
          title: string;
          size?: string | null;
          color?: string | null;
          image?: string | null;
          unit_price_cents: number;
          quantity: number;
          line_total_cents: number;
          restocked_quantity?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          variant_id?: string | null;
          handle?: string | null;
          title?: string;
          size?: string | null;
          color?: string | null;
          image?: string | null;
          unit_price_cents?: number;
          quantity?: number;
          line_total_cents?: number;
          restocked_quantity?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          number: number;
          status_token: string;
          kind: Database["public"]["Enums"]["order_kind"];
          status: Database["public"]["Enums"]["order_status"];
          user_id: string | null;
          email: string;
          locale: string;
          currency: string;
          subtotal_cents: number;
          discount_cents: number;
          discount_code: string | null;
          discount_code_id: string | null;
          gift_card_cents: number;
          gift_card_id: string | null;
          shipping_cents: number;
          total_cents: number;
          refunded_cents: number;
          shipping_name: string | null;
          shipping_address: Json | null;
          phone: string | null;
          stripe_session_id: string | null;
          stripe_payment_intent_id: string | null;
          payment_method: string | null;
          gift_card_purchase: Json | null;
          issued_gift_card_id: string | null;
          tracking_number: string | null;
          shipped_at: string | null;
          paid_at: string | null;
          cancelled_at: string | null;
          cancel_reason: string | null;
          expires_at: string | null;
          needs_attention: boolean;
          confirmation_sent_at: string | null;
          notification_sent_at: string | null;
          gift_card_sent_at: string | null;
          shipping_sent_at: string | null;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          number?: number;
          status_token?: string;
          kind?: Database["public"]["Enums"]["order_kind"];
          status?: Database["public"]["Enums"]["order_status"];
          user_id?: string | null;
          email: string;
          locale?: string;
          currency?: string;
          subtotal_cents: number;
          discount_cents?: number;
          discount_code?: string | null;
          discount_code_id?: string | null;
          gift_card_cents?: number;
          gift_card_id?: string | null;
          shipping_cents?: number;
          total_cents: number;
          refunded_cents?: number;
          shipping_name?: string | null;
          shipping_address?: Json | null;
          phone?: string | null;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          payment_method?: string | null;
          gift_card_purchase?: Json | null;
          issued_gift_card_id?: string | null;
          tracking_number?: string | null;
          shipped_at?: string | null;
          paid_at?: string | null;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
          expires_at?: string | null;
          needs_attention?: boolean;
          confirmation_sent_at?: string | null;
          notification_sent_at?: string | null;
          gift_card_sent_at?: string | null;
          shipping_sent_at?: string | null;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          number?: number;
          status_token?: string;
          kind?: Database["public"]["Enums"]["order_kind"];
          status?: Database["public"]["Enums"]["order_status"];
          user_id?: string | null;
          email?: string;
          locale?: string;
          currency?: string;
          subtotal_cents?: number;
          discount_cents?: number;
          discount_code?: string | null;
          discount_code_id?: string | null;
          gift_card_cents?: number;
          gift_card_id?: string | null;
          shipping_cents?: number;
          total_cents?: number;
          refunded_cents?: number;
          shipping_name?: string | null;
          shipping_address?: Json | null;
          phone?: string | null;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          payment_method?: string | null;
          gift_card_purchase?: Json | null;
          issued_gift_card_id?: string | null;
          tracking_number?: string | null;
          shipped_at?: string | null;
          paid_at?: string | null;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
          expires_at?: string | null;
          needs_attention?: boolean;
          confirmation_sent_at?: string | null;
          notification_sent_at?: string | null;
          gift_card_sent_at?: string | null;
          shipping_sent_at?: string | null;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_discount_code_id_fkey";
            columns: ["discount_code_id"];
            isOneToOne: false;
            referencedRelation: "discount_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_gift_card_id_fkey";
            columns: ["gift_card_id"];
            isOneToOne: false;
            referencedRelation: "gift_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_issued_gift_card_id_fkey";
            columns: ["issued_gift_card_id"];
            isOneToOne: false;
            referencedRelation: "gift_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          path: string;
          alt_de: string;
          alt_en: string | null;
          en_auto: string[];
          width: number;
          height: number;
          sort: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          path: string;
          alt_de?: string;
          alt_en?: string | null;
          en_auto?: string[];
          width?: number;
          height?: number;
          sort?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          path?: string;
          alt_de?: string;
          alt_en?: string | null;
          en_auto?: string[];
          width?: number;
          height?: number;
          sort?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          size: string;
          sku: string | null;
          barcode: string | null;
          price_cents: number | null;
          compare_at_cents: number | null;
          stock: number;
          sort: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          size: string;
          sku?: string | null;
          barcode?: string | null;
          price_cents?: number | null;
          compare_at_cents?: number | null;
          stock?: number;
          sort?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          size?: string;
          sku?: string | null;
          barcode?: string | null;
          price_cents?: number | null;
          compare_at_cents?: number | null;
          stock?: number;
          sort?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          handle: string;
          category_id: string;
          model: string;
          status: Database["public"]["Enums"]["product_status"];
          title_de: string;
          title_en: string | null;
          description_de: string;
          description_en: string | null;
          en_auto: string[];
          material_de: string | null;
          material_en: string | null;
          care_de: string | null;
          care_en: string | null;
          fit_note_de: string | null;
          fit_note_en: string | null;
          fit: string | null;
          color_name_de: string;
          color_name_en: string | null;
          color_hex: string;
          tags: string[];
          occasions: string[];
          outfit_handles: string[];
          price_cents: number;
          compare_at_cents: number | null;
          sort: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          handle: string;
          category_id: string;
          model: string;
          status?: Database["public"]["Enums"]["product_status"];
          title_de: string;
          title_en?: string | null;
          description_de?: string;
          description_en?: string | null;
          en_auto?: string[];
          material_de?: string | null;
          material_en?: string | null;
          care_de?: string | null;
          care_en?: string | null;
          fit_note_de?: string | null;
          fit_note_en?: string | null;
          fit?: string | null;
          color_name_de: string;
          color_name_en?: string | null;
          color_hex: string;
          tags?: string[];
          occasions?: string[];
          outfit_handles?: string[];
          price_cents: number;
          compare_at_cents?: number | null;
          sort?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          handle?: string;
          category_id?: string;
          model?: string;
          status?: Database["public"]["Enums"]["product_status"];
          title_de?: string;
          title_en?: string | null;
          description_de?: string;
          description_en?: string | null;
          en_auto?: string[];
          material_de?: string | null;
          material_en?: string | null;
          care_de?: string | null;
          care_en?: string | null;
          fit_note_de?: string | null;
          fit_note_en?: string | null;
          fit?: string | null;
          color_name_de?: string;
          color_name_en?: string | null;
          color_hex?: string;
          tags?: string[];
          occasions?: string[];
          outfit_handles?: string[];
          price_cents?: number;
          compare_at_cents?: number | null;
          sort?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          address: Json | null;
          locale: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          address?: Json | null;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          address?: Json | null;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shop_settings: {
        Row: {
          id: number;
          shipping_cents: number;
          free_shipping_from_cents: number | null;
          gift_card_min_cents: number;
          gift_card_max_cents: number;
          gift_card_valid_years: number;
          newsletter_welcome_percent: number | null;
          notify_email: string | null;
          hide_sold_out: boolean;
          updated_at: string;
        };
        Insert: {
          id?: number;
          shipping_cents?: number;
          free_shipping_from_cents?: number | null;
          gift_card_min_cents?: number;
          gift_card_max_cents?: number;
          gift_card_valid_years?: number;
          newsletter_welcome_percent?: number | null;
          notify_email?: string | null;
          hide_sold_out?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: number;
          shipping_cents?: number;
          free_shipping_from_cents?: number | null;
          gift_card_min_cents?: number;
          gift_card_max_cents?: number;
          gift_card_valid_years?: number;
          newsletter_welcome_percent?: number | null;
          notify_email?: string | null;
          hide_sold_out?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_content: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          id: number;
          variant_id: string;
          delta: number;
          reason: Database["public"]["Enums"]["stock_reason"];
          order_id: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          variant_id: string;
          delta: number;
          reason: Database["public"]["Enums"]["stock_reason"];
          order_id?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          variant_id?: string;
          delta?: number;
          reason?: Database["public"]["Enums"]["stock_reason"];
          order_id?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          id: string;
          type: string;
          received_at: string;
        };
        Insert: {
          id: string;
          type: string;
          received_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          received_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at: string;
        };
        Insert: {
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Update: {
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_adjust_stock: {
        Args: {
          p_variant_id: string;
          p_delta: number;
          p_reason: Database["public"]["Enums"]["stock_reason"];
          p_note?: string;
        };
        Returns: number;
      };
      admin_dashboard: {
        Args: { p_from: string; p_to: string };
        Returns: Json;
      };
      admin_get_order: {
        Args: { p_order_id: string };
        Returns: Json;
      };
      admin_get_settings: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      admin_grant_admin: {
        Args: { p_email: string };
        Returns: Json;
      };
      admin_list_admins: {
        Args: Record<PropertyKey, never>;
        Returns: { user_id: string; email: string; created_at: string }[];
      };
      admin_restock_order: {
        Args: { p_order_id: string; p_items: Json };
        Returns: Json;
      };
      admin_revoke_admin: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      attach_checkout_session: {
        Args: { p_order_id: string; p_session_id: string; p_expires_at: string };
        Returns: undefined;
      };
      cancel_checkout_by_token: {
        Args: { p_token: string };
        Returns: Json;
      };
      cancel_order: {
        Args: { p_order_id: string; p_reason?: string };
        Returns: boolean;
      };
      check_discount: {
        Args: { p_code: string; p_subtotal_cents: number };
        Returns: Json;
      };
      check_gift_card: {
        Args: { p_code: string };
        Returns: Json;
      };
      claim_guest_orders: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      complete_order: {
        Args: { p_order_id: string; p_payment?: Json };
        Returns: Json;
      };
      forget_stripe_event: {
        Args: { p_event_id: string };
        Returns: undefined;
      };
      get_gift_card_for_email: {
        Args: { p_gift_card_id: string };
        Returns: Json;
      };
      get_order_for_email: {
        Args: { p_order_id: string };
        Returns: Json;
      };
      get_order_status: {
        Args: { p_token: string };
        Returns: Json;
      };
      get_shop_notify_email: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      issue_gift_card: {
        Args: {
          p_amount_cents: number;
          p_locale: string;
          p_recipient_email: string;
          p_recipient_name?: string;
          p_sender_name?: string;
          p_message?: string;
          p_created_by?: string;
          p_note?: string;
        };
        Returns: Json;
      };
      mark_order_email_sent: {
        Args: { p_order_id: string; p_kind: string };
        Returns: undefined;
      };
      mark_order_shipped: {
        Args: { p_order_id: string; p_tracking: string };
        Returns: Json;
      };
      newsletter_confirm: {
        Args: { p_token: string };
        Returns: Json;
      };
      newsletter_subscribe: {
        Args: {
          p_email: string;
          p_locale: string;
          p_consent: string;
          p_source?: string;
          p_ip?: string;
        };
        Returns: Json;
      };
      newsletter_unsubscribe: {
        Args: { p_token: string };
        Returns: Json;
      };
      prepare_account_deletion: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      record_refund: {
        Args: { p_payment_intent_id: string; p_refunded_cents: number };
        Returns: Json;
      };
      register_stripe_event: {
        Args: { p_event_id: string; p_type: string };
        Returns: boolean;
      };
      release_expired_orders: {
        Args: { p_grace?: string };
        Returns: number;
      };
      reserve_checkout: {
        Args: {
          p_lines: Json;
          p_email: string;
          p_locale?: string;
          p_discount_code?: string;
          p_gift_card_code?: string;
          p_user_id?: string;
        };
        Returns: Json;
      };
      reserve_gift_card_purchase: {
        Args: {
          p_amount_cents: number;
          p_email: string;
          p_locale?: string;
          p_purchase?: Json;
          p_user_id?: string;
        };
        Returns: Json;
      };
      user_is_admin: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin";
      discount_kind: "percent" | "amount";
      gift_card_status: "active" | "disabled";
      gift_card_tx_kind: "issue" | "redeem" | "release" | "adjust";
      newsletter_status: "pending" | "confirmed" | "unsubscribed";
      order_kind: "cart" | "gift_card";
      order_status: "pending" | "paid" | "shipped" | "cancelled" | "refunded";
      product_status: "draft" | "active" | "archived";
      stock_reason: "reservation" | "release" | "sale_store" | "return" | "correction" | "reclaim";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
export type Functions<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T];

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
      stock_reason: ["reservation", "release", "sale_store", "return", "correction", "reclaim"],
    },
  },
} as const;
