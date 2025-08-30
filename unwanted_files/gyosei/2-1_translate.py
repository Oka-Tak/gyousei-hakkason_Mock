import pandas as pd
import numpy as np
import csv # Import the csv module

def convert_budget_csv_revised(input_file_path, output_file_path):
    """
    予算・執行サマリCSVファイルを、指定された新しいフォーマットに変換します。

    Args:
        input_file_path (str): 入力CSVファイルのパス。
        output_file_path (str): 出力CSVファイルのパス。
    """
    try:
        # CSVファイルを読み込み
        df = pd.read_csv(input_file_path)

        # ----------------------------------------------------------------------
        # データクレンジング
        # ----------------------------------------------------------------------
        # 予算額データが存在しない行（サマリ行など）を削除
        df.dropna(subset=['当初予算（合計）'], inplace=True)
        
        # 金額関連の列を特定
        amount_columns = [
            '当初予算（合計）', '補正予算（合計）', '前年度からの繰越し（合計）',
            '予備費等（合計）', '執行額（合計）', '翌年度への繰越し(合計）', '翌年度要求額（合計）'
        ]
        
        # 金額関連の列を数値型に変換（変換できない値は0とする）
        for col in amount_columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
            
        # 整数型に変換して表示を整える
        df[amount_columns] = df[amount_columns].astype(np.int64)

        # ----------------------------------------------------------------------
        # 列の選択と名前の変更
        # ----------------------------------------------------------------------
        
        # 出力用の列名を定義
        output_columns = [
            '予算事業ID', '予算年度', '事業年度', '事業名', '組織ID', '主な増減理由',
            'その他特記事項', '当初予算_合計', '補正額_合計',
            '前年度からの繰り越し_合計', '予備費等_合計', '執行額_合計',
            '翌年度への繰り越し_合計', '翌年度要求額_合計'
        ]
        
        # 元の列名と出力用の列名のマッピング
        # 完全一致しない列名のみ定義
        rename_map = {
            '当初予算（合計）': '当初予算_合計',
            '補正予算（合計）': '補正額_合計',
            '前年度からの繰越し（合計）': '前年度からの繰り越し_合計',
            '予備費等（合計）': '予備費等_合計',
            '執行額（合計）': '執行額_合計',
            '翌年度への繰越し(合計）': '翌年度への繰り越し_合計',
            '翌年度要求額（合計）': '翌年度要求額_合計'
        }
        df.rename(columns=rename_map, inplace=True)

        # 新しいER図に合わせて「組織ID」列を生成
        # 仮に、category_nameの最初の要素を組織名とし、organization_name.csvからIDをマッピング
        # 見つからない場合はNoneを割り当てる
        org_name_df = pd.read_csv('organization_name.csv')
        org_name_map = dict(zip(org_name_df['organization_name'], org_name_df['organization_id']))

        df['組織ID'] = df['事業名'].apply(lambda x: org_name_map.get(x.split('→')[0].strip(), None))
        # Noneを空文字列に変換してCSV出力時のnanを回避
        df['組織ID'] = df['組織ID'].fillna('').astype(str)

        # 指定された列のみを、指定された順序で抽出
        result_df = df[output_columns]

        # ----------------------------------------------------------------------
        # ファイルに出力
        # ----------------------------------------------------------------------
        # すべてのフィールドを引用符で囲み、引用符内の引用符を二重引用符でエスケープ
        result_df.to_csv(output_file_path, index=False, encoding='utf-8-sig', quoting=csv.QUOTE_ALL, doublequote=True)

        print(f"変換が完了しました。出力ファイル: {output_file_path}")

    except FileNotFoundError:
        print(f"エラー: 入力ファイルが見つかりません - {input_file_path}")
    except KeyError as e:
        print(f"エラー: CSVファイルに必要な列が存在しません - {e}")
    except Exception as e:
        print(f"エラーが発生しました: {e}")


# --- メイン処理 ---
if __name__ == '__main__':
    # 入力ファイルと出力ファイルの名前を設定
    input_csv = '2-1_RS_2024_予算・執行_サマリ _2 (version 1).csv'
    output_csv = 'converted_budget_summary_revised.csv'
    
    # 変換関数を呼び出し
    convert_budget_csv_revised(input_csv, output_csv)
