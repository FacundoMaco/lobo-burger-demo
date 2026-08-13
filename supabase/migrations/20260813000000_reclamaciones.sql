create table reclamaciones (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  tipo text not null check (tipo in ('reclamo','queja')),
  sede text not null check (sede in ('Surquillo','SJM')),
  consumidor_nombre text not null,
  consumidor_domicilio text not null,
  consumidor_documento text not null,
  consumidor_telefono text not null,
  consumidor_email text not null,
  es_menor_edad boolean not null default false,
  representante_nombre text,
  bien_descripcion text not null,
  monto_reclamado numeric,
  detalle text not null,
  pedido_concreto text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','respondido'))
);

alter table reclamaciones enable row level security;

create policy "anon puede insertar reclamos"
  on reclamaciones for insert
  to anon
  with check (true);
