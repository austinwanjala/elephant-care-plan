ALTER TABLE public.members
ADD COLUMN marketer_id UUID NULL;

ALTER TABLE public.members
ADD CONSTRAINT members_marketer_id_fkey
FOREIGN KEY (marketer_id) REFERENCES public.marketers(id) ON DELETE SET NULL;