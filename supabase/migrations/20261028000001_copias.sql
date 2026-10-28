-- 1.0: as copias do banco da loja (SQLite) no Storage. Sem schema de negocio
-- no Postgres: a fonte da verdade e o arquivo no computador da loja
-- (Memoria.md, 2026-10-05). Desenho e decisoes: plano da 1.0, fundacao, item 7.
--
-- Uma pasta por usuario de login: <auth.uid()>/atual.sqlite.gz (sobrescrita a
-- cada copia) e <auth.uid()>/dias/AAAA-MM-DD.sqlite.gz (a primeira do dia).
--
-- A loja le, cria e sobrescreve SO a atual. Nao ha politica de delete nem de
-- update nas diarias: com a credencial da loja vazada, o maximo que se estraga
-- e a atual; as diarias ficam. Limpeza de diarias antigas, se um dia for
-- preciso, e pelo painel.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('copias', 'copias', false, 52428800, array['application/gzip']);

create policy "loja le as proprias copias" on storage.objects
  for select to authenticated
  using (bucket_id = 'copias' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "loja cria copias na propria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'copias' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "loja sobrescreve so a atual" on storage.objects
  for update to authenticated
  using (bucket_id = 'copias' and name = (select auth.uid())::text || '/atual.sqlite.gz')
  with check (bucket_id = 'copias' and name = (select auth.uid())::text || '/atual.sqlite.gz');
