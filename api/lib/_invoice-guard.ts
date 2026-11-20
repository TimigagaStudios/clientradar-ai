// Fail closed before destructive lead operations if invoice records are linked.
// This is not a transaction: a concurrent insert can still race a lead delete.
// Never silently delete or detach an invoice as a side effect of deleting leads.
export async function assertNoLinkedInvoices(supabase: any, leadId?: string): Promise<void> {
  let query = supabase.from('invoices').select('id');
  query = leadId ? query.eq('lead_id', leadId) : query.not('lead_id', 'is', null);
  const { data, error } = await query.limit(1);
  if (error) {
    // Only the explicitly absent table is safe to skip. Missing columns,
    // permissions and connection failures are not evidence of no invoices.
    if (error.code === '42P01') return;
    throw new Error('Could not check linked invoice records. No lead deletion was attempted at this step. Check database access and schema.');
  }
  if (!Array.isArray(data)) throw new Error('Could not check linked invoice records. Check database access before deleting leads.');
  if (data.length) throw new Error('Lead deletion blocked: linked invoice records exist. Review them before deleting the lead. Invoices were not deleted automatically; earlier steps may already have changed related records.');
}
