require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { createClient } = require('@supabase/supabase-js');

async function check() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'missing';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'missing';
  
  if (supabaseUrl === 'missing') {
      console.log('No Supabase config found locally');
      return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
const { data: addColData, error: addColErr } = await supabase.rpc('add_col_if_not_exists', { table_name: 'orders', column_name: 'delivery_order_ref', data_type: 'text' });
  if (addColErr) {
     console.log('Falling back to direct query using a function might not work. Lets just execute using supabase.query if possible? Supabase js doesnt have direct query... But maybe I can run it via a REST call or just test it first.');
  }

  const { data, error } = await supabase.from('orders').insert([{
        id: "TEST_" + Date.now(),
        customer_name: "Test",
        customer_phone: "",
        type: "dine-in",
        source: "store",
        status: "confirmed",
        items: [],
        total_amount: 100,
        net_amount: 100,
        created_at: new Date().toISOString(),
        table_number: "2"
  }]);
  
  console.log("Insert Test Result:", { data, error });
}

check();
