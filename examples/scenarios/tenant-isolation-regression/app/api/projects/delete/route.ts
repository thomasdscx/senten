import { createClient } from '@supabase/supabase-js';
export async function DELETE(){ const db=createClient('x','y'); await db.from('projects').delete().eq('id','demo'); return Response.json({ok:true}); }
