-- Rate limit por IP para POST /api/charge (PAY-06).
--
-- Por que una funcion de Postgres y no select-then-update desde TypeScript:
-- dos invocaciones serverless de Vercel pueden caer en instancias distintas
-- (Pitfall 11) y correr al mismo tiempo. Un select-then-update desde la app
-- leeria el mismo valor en ambas y lo pisaria: el atacante pasaria el limite
-- sin que el codigo se entere. La atomicidad la tiene que garantizar
-- Postgres con el "on conflict" de abajo, no la app.
create table rate_limit_charge (
  ip text not null,
  window_start timestamptz not null,
  intentos int not null default 1,
  primary key (ip, window_start)
);

-- Sin politicas: la tabla solo la toca el service_role desde el servidor,
-- igual que pedidos (20260820000000_pedidos.sql). Nadie la consulta desde
-- el cliente.
alter table rate_limit_charge enable row level security;

create or replace function increment_rate_limit(
  p_ip text,
  p_window_start timestamptz,
  p_max_age interval default interval '1 hour'
) returns int
language plpgsql
as $$
declare
  v_count int;
begin
  -- Limpieza oportunista en la misma llamada: sin esto la tabla crece sin
  -- techo y consume el free tier. Con esto no hace falta un cron aparte
  -- que se pueda quedar apagado sin que nadie lo note.
  delete from rate_limit_charge where window_start < now() - p_max_age;

  -- Insert-o-incrementa atomico: el "on conflict" sobre la primary key
  -- (ip, window_start) es lo que hace imposible que dos requests
  -- concurrentes lean el mismo contador y lo pisen.
  insert into rate_limit_charge (ip, window_start, intentos)
  values (p_ip, p_window_start, 1)
  on conflict (ip, window_start) do update
    set intentos = rate_limit_charge.intentos + 1
  returning intentos into v_count;

  return v_count;
end;
$$;
