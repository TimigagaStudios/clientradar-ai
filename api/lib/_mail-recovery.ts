// Sending fails closed until the database can atomically record its outcome.
export async function ensureMailRecoveryReady(supabase: any) {
  const { data, error } = await supabase.rpc('cr_qa_mail_ready');
  if (error || data !== true) throw new Error('Mail recovery is not ready. No email was sent. Check database migration 010.');
}
