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

/** retailer_prices.currency — EUR only for now (no conversion is ever performed); widen this when another currency is genuinely needed, matching the DB's own CHECK constraint. */
export type RetailerCurrency = 'EUR'
export type RetailerAvailabilityStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder' | 'discontinued' | 'unknown'
/** retailer_prices.package_type — describes what the RETAILER is selling (distinct from inventory's own PackageType, and from a string's technical gauge/hybrid metadata on public.strings). */
export type RetailerPackageType = 'set' | 'reel' | 'hybrid' | 'other'

/** Shape of the `tension_meta` jsonb column — mirrors StringTensionMeta in data/strings.ts. */
export interface TensionMetaJson {
  tensionAdjustment?: number
  recommendedMin?: number
  recommendedMax?: number
  tensionNotes?: string
}

/** Shape of the `main_string_meta` / `cross_string_meta` jsonb columns — mirrors HybridStringMeta in data/strings.ts. Display/admin metadata only, never a recommendation input. */
export interface HybridStringMetaJson {
  gauge?: number
  material?: string
  construction?: string
  coating?: string
  color?: string
  colorOverride?: string
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
          is_hybrid: boolean
          main_string_meta: HybridStringMetaJson | null
          cross_string_meta: HybridStringMetaJson | null
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
          is_hybrid?: boolean
          main_string_meta?: HybridStringMetaJson | null
          cross_string_meta?: HybridStringMetaJson | null
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
          is_hybrid?: boolean
          main_string_meta?: HybridStringMetaJson | null
          cross_string_meta?: HybridStringMetaJson | null
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
        Relationships: [
          {
            foreignKeyName: 'inventory_string_id_fkey'
            columns: ['string_id']
            isOneToOne: true
            referencedRelation: 'strings'
            referencedColumns: ['id']
          },
        ]
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
          reviewer: string | null
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
          reviewer?: string | null
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
          reviewer?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'specialist_profiles_string_id_fkey'
            columns: ['string_id']
            isOneToOne: true
            referencedRelation: 'strings'
            referencedColumns: ['id']
          },
        ]
      }

      retailers: {
        Row: {
          id: number
          name: string
          logo_url: string | null
          website_url: string | null
          country: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          logo_url?: string | null
          website_url?: string | null
          country?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          logo_url?: string | null
          website_url?: string | null
          country?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      retailer_prices: {
        Row: {
          id: number
          string_id: string
          retailer_id: number
          product_url: string | null
          price: number | null
          currency: RetailerCurrency
          availability_status: RetailerAvailabilityStatus
          package_type: RetailerPackageType
          package_length_m: number | null
          is_preferred: boolean
          notes: string | null
          last_checked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          string_id: string
          retailer_id: number
          product_url?: string | null
          price?: number | null
          currency?: RetailerCurrency
          availability_status?: RetailerAvailabilityStatus
          package_type?: RetailerPackageType
          package_length_m?: number | null
          is_preferred?: boolean
          notes?: string | null
          last_checked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          string_id?: string
          retailer_id?: number
          product_url?: string | null
          price?: number | null
          currency?: RetailerCurrency
          availability_status?: RetailerAvailabilityStatus
          package_type?: RetailerPackageType
          package_length_m?: number | null
          is_preferred?: boolean
          notes?: string | null
          last_checked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'retailer_prices_string_id_fkey'
            columns: ['string_id']
            isOneToOne: false
            referencedRelation: 'strings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'retailer_prices_retailer_id_fkey'
            columns: ['retailer_id']
            isOneToOne: false
            referencedRelation: 'retailers'
            referencedColumns: ['id']
          },
        ]
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
