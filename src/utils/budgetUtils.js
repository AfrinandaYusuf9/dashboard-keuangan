import { supabase } from '../lib/supabaseClient'

const DEFAULT_POS = [
  { type: 'income', name: 'Gaji' },
  { type: 'expense', name: 'Pengeluaran Fix' },
  { type: 'expense', name: 'Kebutuhan Hidup' },
  { type: 'expense', name: 'Lain-lain' },
  { type: 'expense', name: 'Pemberian' },
  { type: 'expense', name: 'Tabungan' },
]

/**
 * Ensures that the standard budget items exist for a user in a specific month.
 * If not, it creates them. Returns the budget items.
 * @param {string} userId - The user ID
 * @param {string} monthYear - The month string in 'YYYY-MM-01' format
 */
export async function ensureBudgetExists(userId, monthYear) {
  // Query to check if they already exist
  const { data, error } = await supabase
    .from('budget_pos')
    .select(`
      id, user_id, month_year, type, name,
      budget_sub_items (id, name, budget_amount)
    `)
    .eq('month_year', monthYear)
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching budget_pos in ensureBudgetExists:', error)
    throw error
  }

  // If already populated, return them
  if (data && data.length > 0) {
    return data
  }

  // If not, seed them
  const toInsert = DEFAULT_POS.map(p => ({
    user_id: userId,
    month_year: monthYear,
    type: p.type,
    name: p.name,
  }))

  const { data: newPosData, error: insertError } = await supabase
    .from('budget_pos')
    .insert(toInsert)
    .select(`
      id, user_id, month_year, type, name,
      budget_sub_items (id, name, budget_amount)
    `)
    
  if (insertError) {
    console.error('Error seeding budget_pos in ensureBudgetExists:', insertError)
    throw insertError
  }

  return newPosData
}
