create table pedidos (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  -- Idempotencia: un cargo de Culqi no puede generar dos pedidos.
  culqi_charge_id text not null unique,
  codigo text not null unique,
  cliente_nombre text not null,
  cliente_telefono text not null,
  cliente_email text not null,
  delivery boolean not null default false,
  direccion text,
  lat double precision,
  lng double precision,
  items jsonb not null,
  total_centimos integer not null check (total_centimos > 0),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','en_preparacion','listo','entregado','cancelado'))
);

create index pedidos_created_at_idx on pedidos (created_at desc);

-- Sin politicas: la tabla solo se toca con la service_role desde el servidor.
-- El cliente nunca lee ni escribe pedidos directamente.
alter table pedidos enable row level security;
