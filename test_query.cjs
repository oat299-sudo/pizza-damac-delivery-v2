const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = "https://hecmhlzgihjatutibwca.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlY21obHpnaWhqYXR1dGlid2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNTI4MTgsImV4cCI6MjA3OTcyODgxOH0.w60oUnFw3TQmQwrq4MUFKSk_CYpCUSabHpiy8jKbZF4";
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.from('store_settings').select('*').limit(1);
  console.log("Fetch store_settings:", { data, error });
}

run();
