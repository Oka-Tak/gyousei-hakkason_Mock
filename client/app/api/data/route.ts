import { NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';
import * as kuromoji from 'kuromoji';

// グローバルキャッシュ
let tokenizerCache: any = null;
let tokenizerReady: Promise<any> | null = null;


// Supabaseクライアントの初期化
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);


export async function GET() {
  try {
    // projectデータ取得（ASは使わず、JS側でリネーム）
    const { data: projects, error: projectError } = await supabase
      .from('project')
      .select('budget_year, project_year, organization_id, initial_budget_total, adjustment_total, carryover_from_previous_total, contingency_total');
    if (projectError) throw projectError;

    // organization, agency情報を取得
    const { data: organizations, error: orgError } = await supabase
      .from('organization')
      .select('*');
    if (orgError) throw orgError;

    const { data: agencies, error: agencyError } = await supabase
      .from('agency')
      .select('*');
    if (agencyError) throw agencyError;


    // organization, agencyをprojectに紐付け
    const orgMap = new Map<string, any>();
    if (organizations) organizations.forEach(o => orgMap.set(o.organization_id, o));
    const agencyMap = new Map<string, any>();
    if (agencies) agencies.forEach(a => agencyMap.set(a.agency_id, a));

    // kuromojiでname→yomi変換
    if (!tokenizerCache) {
      if (!tokenizerReady) {
        tokenizerReady = new Promise((resolve, reject) => {
          const builder = kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict/' });
          builder.build((err: any, tokenizer: any) => {
            if (err) {
              console.error('kuromoji build error:', err);
              resolve(null);
              return;
            }
            tokenizerCache = tokenizer;
            resolve(tokenizer);
          });
        });
      }
      await tokenizerReady;
    }
    const tokenizer = tokenizerCache;
    const nameKeys = ['agency_name', 'ministry_name', 'bureau_agency', 'department', 'division', 'office', 'section', 'group', 'team', 'project_name'];
    const rowsWithYomi = (projects || []).map((row: any) => {
      // 紐付け
      const org = orgMap.get(row.organization_id) || {};
      const agency = agencyMap.get(org.agency_id) || {};
      // 旧SQLのASに合わせてフィールド名を変換
      const newRow = {
        ...row,
        agency_id: agency.agency_id,
        agency_name: agency.agency_name,
        agency_order: agency.agency_order,
        ministry_name: agency.ministry_name || agency.agency_name, // ministry_nameがなければagency_nameを利用
        bureau_agency: org.bureau_office,
        department: org.department,
        division: org.division,
        office: org.unit,
        section: org.section,
        team: org.team,
        // 予算合計金額を計算
        total_budget:
          Number(row.initial_budget_total || 0) +
          Number(row.adjustment_total || 0) +
          Number(row.carryover_from_previous_total || 0) +
          Number(row.contingency_total || 0)
      };
      const yomiObj: Record<string, string> = {};
      nameKeys.forEach(key => {
        const val = newRow[key];
        if (val && typeof val === 'string' && tokenizer) {
          try {
            const tokens = tokenizer.tokenize(val);
            const hira = tokens.map((t: any) => t.reading ? t.reading.replace(/\p{Script=Katakana}/gu, (c: any) => String.fromCharCode(c.charCodeAt(0) - 0x60)) : t.surface_form).join('');
            yomiObj[key + '_yomi'] = hira;
          } catch (e) {
            yomiObj[key + '_yomi'] = '';
          }
        } else {
          yomiObj[key + '_yomi'] = '';
        }
      });
      return { ...newRow, ...yomiObj };
    });
    return NextResponse.json(rowsWithYomi);
  } catch (error) {
    console.error('Error fetching data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
