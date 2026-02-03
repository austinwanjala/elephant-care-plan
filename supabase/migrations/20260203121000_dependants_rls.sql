-- RLS Policies for Dependants Table
ALTER TABLE public.dependants ENABLE ROW LEVEL SECURITY;

-- 1. Members can view their own dependants
CREATE POLICY "dependants_select_member" ON public.dependants
FOR SELECT TO authenticated
USING (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'staff')
);

-- 2. Members can insert their own dependants
CREATE POLICY "dependants_insert_member" ON public.dependants
FOR INSERT TO authenticated
WITH CHECK (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

-- 3. Members can update their own dependants
CREATE POLICY "dependants_update_member" ON public.dependants
FOR UPDATE TO authenticated
USING (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
)
WITH CHECK (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

-- 4. Members can delete their own dependants
CREATE POLICY "dependants_delete_member" ON public.dependants
FOR DELETE TO authenticated
USING (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);
