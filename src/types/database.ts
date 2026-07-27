// Hand-written TypeScript types matching the Phase 1 Supabase schema
// (supabase/migrations/*_initial_schema.sql). Structured the same way the
// Supabase CLI's own `supabase gen types typescript` output is shaped
// (Database -> public -> Tables -> <table> -> Row/Insert/Update), so this
// file can be replaced by a generated one later without touching any of
// the code that imports it.
//
// IMPORTANT: nothing in this file is fetched from or writes to the
// database yet — Phase 1 only establishes the shape. The website
// continues reading src/data/strings.ts and src/data/stringSpecialistProfiles.ts
// exactly as before.

/** Generic JSON-compatible value, matching Supabase's own generated `Json` type. */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type StockStatus = 'in-stock' | 'low-stock' | 'unavailable'
export type PackageType = 'reel' | 'set' | 'mixed' | 'unknown'
export type StringCategory = 'repulsion' | 'control' | 'durability'
export type SpecialistFeel = 'hard' | 'medium' | 'soft'
export type ExperienceSource = 'personal' | 'club' | 'stringing-observation' | 'manufacturer' | 'community' | 'mixed'
export type Confidence = 'very-high' | 'high' | 'medium' | 'low' | 'unknown'

/** Shape of the `tension_meta` jsonb column — mirrors StringTensionMeta in data/strings.ts. */
export interface TensionMetaJson {
  tensionAdjustment?: number
  recommendedMin?: number
  recommendedMax?: number
  tensionNotes?: string
}

/** Shape of the `dimensions` / `dimension_confidence` jsonb columns — mirrors SpecialistDimensions in data/stringSpecialistProfiles.ts. Sparse by design. */
export interface SpecialistDimensionsJson {
  hardHitterFit?: number
  easyPower?: number
  attackSmash?: number
  fastDoubles?: number
  flatDriveGame?: number
  controlPrecision?: number
  shuttleGripHold?: number
  netTechnical?: number
  comfort?: number
  directness?: number
  softness?: number
  tensionRetention?: number
  normalWearDurability?: number
  mishitTolerance?: number
  beginnerFriendliness?: number
  value?: number
  allRoundSuitability?: number
}

/** Per-dimension confidence overrides — same sparse key space as SpecialistDimensionsJson, values are Confidence instead of a number. */
export type SpecialistDimensionConfidenceJson = Partial<Record<keyof SpecialistDimensionsJson, Confidence>>

export interface Database {
  public: {
    Tables: {
      strings: {
        Row: {
          id: string
          brand: string
          name: string
          category: StringCategory
          gauge_mm: number | null
          repulsion: number
          durability: number
          hitting_sound: number
          shock_absorption: number | null
          control: number
          string_cost_eur: number | null
          description: string | null
          tension_meta: TensionMetaJson | null
          popularity_rank: number | null
          product_url: string | null
          image_url: string | null
          colors: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          brand: string
          name: string
          category: StringCategory
          gauge_mm?: number | null
          repulsion: number
          durability: number
          hitting_sound: number
          shock_absorption?: number | null
          control: number
          string_cost_eur?: number | null
          description?: string | null
          tension_meta?: TensionMetaJson | null
          popularity_rank?: number | null
          product_url?: string | null
          image_url?: string | null
          colors?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brand?: string
          name?: string
          category?: StringCategory
          gauge_mm?: number | null
          repulsion?: number
          durability?: number
          hitting_sound?: number
          shock_absorption?: number | null
          control?: number
          string_cost_eur?: number | null
          description?: string | null
          tension_meta?: TensionMetaJson | null
          popularity_rank?: number | null
          product_url?: string | null
          image_url?: string | null
          colors?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      inventory: {
        Row: {
          string_id: string
          stock_status: StockStatus
          quantity: number | null
          package_type: PackageType
          color: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          string_id: string
          stock_status?: StockStatus
          quantity?: number | null
          package_type?: PackageType
          color?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          string_id?: string
          stock_status?: StockStatus
          quantity?: number | null
          package_type?: PackageType
          color?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      specialist_profiles: {
        Row: {
          string_id: string
          feel: SpecialistFeel | null
          personal_tension_min_kg: number | null
          personal_tension_max_kg: number | null
          experience_source: ExperienceSource
          confidence: Confidence
          dimensions: SpecialistDimensionsJson
          dimension_confidence: SpecialistDimensionConfidenceJson | null
          strengths: string[] | null
          weaknesses: string[] | null
          specialist_tags: string[] | null
          subjective_notes: string | null
          updated_at: string
        }
        Insert: {
          string_id: string
          feel?: SpecialistFeel | null
          personal_tension_min_kg?: number | null
          personal_tension_max_kg?: number | null
          experience_source: ExperienceSource
          confidence: Confidence
          dimensions?: SpecialistDimensionsJson
          dimension_confidence?: SpecialistDimensionConfidenceJson | null
          strengths?: string[] | null
          weaknesses?: string[] | null
          specialist_tags?: string[] | null
          subjective_notes?: string | null
          updated_at?: string
        }
        Update: {
          string_id?: string
          feel?: SpecialistFeel | null
          personal_tension_min_kg?: number | null
          personal_tension_max_kg?: number | null
          experience_source?: ExperienceSource
          confidence?: Confidence
          dimensions?: SpecialistDimensionsJson
          dimension_confidence?: SpecialistDimensionConfidenceJson | null
          strengths?: string[] | null
          weaknesses?: string[] | null
          specialist_tags?: string[] | null
          subjective_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      retailer_prices: {
        Row: {
          id: number
          string_id: string
          retailer_name: string
          retailer_product_url: string | null
          set_price_eur: number | null
          reel_price_eur: number | null
          sale_price_eur: number | null
          retailer_in_stock: boolean | null
          last_checked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          string_id: string
          retailer_name: string
          retailer_product_url?: string | null
          set_price_eur?: number | null
          reel_price_eur?: number | null
          sale_price_eur?: number | null
          retailer_in_stock?: boolean | null
          last_checked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          string_id?: string
          retailer_name?: string
          retailer_product_url?: string | null
          set_price_eur?: number | null
          reel_price_eur?: number | null
          sale_price_eur?: number | null
          retailer_in_stock?: boolean | null
          last_checked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      admin_users: {
        Row: {
          user_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
  }
}
