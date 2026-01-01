import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get min/max for all numeric fields
    const { data, error } = await supabase
      .from('pork_samples')
      .select(`
        minolta_chop_l,
        minolta_chop_a,
        minolta_chop_b,
        chop_color,
        chop_marbling,
        chop_firmness,
        ph
      `)
    
    if (error) throw error

    // Calculate min/max for each field
    const bounds = {
      minolta_chop_l: { min: Infinity, max: -Infinity },
      minolta_chop_a: { min: Infinity, max: -Infinity },
      minolta_chop_b: { min: Infinity, max: -Infinity },
      chop_color: { min: Infinity, max: -Infinity },
      chop_marbling: { min: Infinity, max: -Infinity },
      chop_firmness: { min: Infinity, max: -Infinity },
      ph: { min: Infinity, max: -Infinity },
    }

    data?.forEach(sample => {
      Object.keys(bounds).forEach(key => {
        const value = sample[key as keyof typeof sample]
        if (value !== null && value !== undefined) {
          const numValue = Number(value)
          if (!isNaN(numValue)) {
            bounds[key as keyof typeof bounds].min = Math.min(bounds[key as keyof typeof bounds].min, numValue)
            bounds[key as keyof typeof bounds].max = Math.max(bounds[key as keyof typeof bounds].max, numValue)
          }
        }
      })
    })

    // Round to reasonable precision
    Object.keys(bounds).forEach(key => {
      const field = bounds[key as keyof typeof bounds]
      field.min = Math.floor(field.min * 100) / 100
      field.max = Math.ceil(field.max * 100) / 100
    })

    return NextResponse.json(bounds)
  } catch (error) {
    console.error('Error fetching sample bounds:', error)
    return NextResponse.json({ error: 'Failed to fetch sample bounds' }, { status: 500 })
  }
}
