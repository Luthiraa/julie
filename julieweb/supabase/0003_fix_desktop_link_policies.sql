
-- Allow authenticated users to insert their own links (fixes the POST error)
drop policy if exists "Users can insert their own links" on public.desktop_links;
create policy "Users can insert their own links"
on public.desktop_links
for insert
to authenticated
with check ( auth.uid() = user_id );

-- Secure function to retrieve and delete a link (allows anonymous polling without Service Key)
create or replace function get_and_consume_link(link_code text)
returns jsonb
language plpgsql
security definer
as $$
declare
  result_payload jsonb;
begin
  -- Select the payload
  select payload into result_payload
  from public.desktop_links
  where code = link_code;
  
  if result_payload is not null then
    -- Delete the link to consume it (one-time use)
    delete from public.desktop_links
    where code = link_code;
  end if;
  
  return result_payload;
end;
$$;

