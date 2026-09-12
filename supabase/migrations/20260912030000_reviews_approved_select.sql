-- Approved reviews are public: the homepage testimonials render them (and AI
-- crawlers consume real, verified quotes). Everything else stays
-- service-role-only — public rows are restricted to status='approved', so the
-- moderation queue is never readable through the Data API.
create policy "reviews_read_approved" on public.reviews
  for select to anon using (status = 'approved');

create policy "reviews_read_approved_auth" on public.reviews
  for select to authenticated using (status = 'approved');

grant select on public.reviews to anon, authenticated;