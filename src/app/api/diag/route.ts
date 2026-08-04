import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: any) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const wife = users.users.find(u => u.email === 'xdstudiooffice@gmail.com');
    if (!wife) return NextResponse.json({ error: 'wife not found' });
    
    const { data: joined } = await supabaseAdmin.from('shared_list_members').select('shared_list_id').eq('member_uid', wife.id);
    const { data: owned } = await supabaseAdmin.from('shared_lists').select('id, name').eq('owner_uid', wife.id);
    const { data: joined_lists } = await supabaseAdmin.from('shared_lists').select('id, name').in('id', joined?.map(j => j.shared_list_id) || []);
    
    return NextResponse.json({ wife: wife.id, joined: joined_lists, owned });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
