// Next.js API Route: ダミー実装（ビルドエラー回避用）
import { NextResponse } from 'next/server';

export async function GET() {
	return NextResponse.json({ message: 'OK' });
}
