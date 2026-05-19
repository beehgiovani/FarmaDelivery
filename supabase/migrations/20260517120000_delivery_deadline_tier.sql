do $$
begin
  if not exists (select 1 from pg_type where typname = 'DeliveryDeadlineTier') then
    create type "DeliveryDeadlineTier" as enum ('PERTO', 'MEDIO', 'LONGE');
  end if;
end $$;

alter table public."Delivery"
  add column if not exists "deadlineTier" "DeliveryDeadlineTier" not null default 'MEDIO';
