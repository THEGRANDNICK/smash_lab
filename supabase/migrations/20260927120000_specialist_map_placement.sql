-- Quick profiling via the feel map: the stringer drops a string onto the
-- map (hold <-> repulsion, soft <-> hard) plus two durability answers, and
-- the app derives the specialist dimensions from that (src/logic/mapPlacement.ts).
-- Hand-typed values in `dimensions` always take precedence.

alter table public.specialist_profiles
  add column if not exists map_placement jsonb;

alter table public.specialist_profiles
  drop constraint if exists specialist_profiles_map_placement_check;

alter table public.specialist_profiles
  add constraint specialist_profiles_map_placement_check
  check (
    map_placement is null
    or (
      jsonb_typeof(map_placement -> 'holdRepulsion') = 'number'
      and jsonb_typeof(map_placement -> 'softHard') = 'number'
      and (map_placement ->> 'holdRepulsion')::numeric between 0 and 1
      and (map_placement ->> 'softHard')::numeric between 0 and 1
    )
  );

comment on column public.specialist_profiles.map_placement is
  'Feel-map placement {holdRepulsion 0-1, softHard 0-1, durability? 1-5, mishit? robust|normal|sensitive}. Fills blank dimensions.';
