create extension if not exists pgcrypto;

create table if not exists public."DeliveryProof" (
  "id" text primary key default gen_random_uuid()::text,
  "deliveryId" text not null references public."Delivery"("id"),
  "actorUserId" text references public."User"("id"),
  "fileName" text not null,
  "mimeType" text not null,
  "storagePath" text not null,
  "sizeBytes" integer not null,
  "sha256" text not null,
  "createdAt" timestamp(3) without time zone not null default current_timestamp
);

create index if not exists "DeliveryProof_deliveryId_createdAt_idx"
  on public."DeliveryProof"("deliveryId", "createdAt");

create index if not exists "DeliveryProof_actorUserId_createdAt_idx"
  on public."DeliveryProof"("actorUserId", "createdAt");

alter table public."DeliveryProof" enable row level security;

alter table public."DeliveryProof" replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'DeliveryProof'
  ) then
    alter publication supabase_realtime add table public."DeliveryProof";
  end if;
end $$;
