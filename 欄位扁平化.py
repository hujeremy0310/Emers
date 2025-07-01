import pandas as pd

# 讀取 Excel 檔案
file_path = path = r"C:\Users\EP1430\Downloads\輔翼0619總庫存_Jeremy.xlsx"
sheet_name = "現有庫存查詢"

# 讀取工作表
df = pd.read_excel(file_path, sheet_name=sheet_name)

# 固定欄位（基本資訊）
fixed_cols = ['商品代號', '款式代號', '商品名稱', '含稅定價']

# 其餘欄位視為庫別欄位
warehouse_cols = [col for col in df.columns if col not in fixed_cols]

# 使用 melt 函數轉換為扁平格式（欄轉列）
df_melted = df.melt(
    id_vars=fixed_cols,
    value_vars=warehouse_cols,
    var_name="庫別",
    value_name="庫別數量"
)

# 篩選出非空且不為 0 的資料列
df_result = df_melted[df_melted["庫別數量"].notna() & (df_melted["庫別數量"] != 0)]

# 匯出結果成 Excel 檔案
output_path = "轉換後庫存資料.xlsx"
df_result.to_excel(output_path, index=False)

print("轉換完成，結果已存為：", output_path)