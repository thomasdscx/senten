import { invoke } from '@tauri-apps/api/core'; export async function save(){ return invoke('save'); }
