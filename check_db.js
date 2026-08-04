const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const wife = users.users.find(u => u.email === 'xdstudiooffice@gmail.com');
  if (!wife) { console.log('Wife not found'); return; }
  console.log('Wife UID:', wife.id);
  
  const { data: joined } = await supabase.from('shared_list_members').select('*').eq('member_uid', wife.id);
  console.log('Joined lists:', joined?.length);
  console.log(joined);

  const { data: owned } = await supabase.from('shared_lists').select('*').eq('owner_uid', wife.id);
  console.log('Owned shared lists:', owned?.length);
}
run();
