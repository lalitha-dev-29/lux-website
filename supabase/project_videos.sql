-- Extra videos for Projects (campaign films, demos, TikTok/Reel cuts).
--
-- Run once in the Supabase SQL Editor, AFTER projects.sql. Idempotent.
--   videos  jsonb array of { url, title } — each can be a YouTube/Vimeo link
--           or a direct video file (.mp4/.webm/.mov) uploaded from the admin.
-- The existing single "video_url" stays as the main film at the top of the page.
-- Video files are stored in the public content-images bucket under
-- projects/<id>/videos/, so no new storage policy is needed.

alter table public.projects
  add column if not exists videos jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_videos_is_array') then
    alter table public.projects
      add constraint projects_videos_is_array check (jsonb_typeof(videos) = 'array');
  end if;
end $$;

notify pgrst, 'reload schema';
