import { NextResponse } from 'next/server';
import { fetchMainData } from '@/server/dataService';

export async function GET() {
  try {
    const rows = await fetchMainData();
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
