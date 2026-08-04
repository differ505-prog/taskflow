import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
async function run() {
  const { data, error } = await supabase.from('shared_lists').select('*').limit(1);
  console.log("shared_lists:", error ? error.message : "Exists");
}
run();
