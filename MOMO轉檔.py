import pandas as pd

# 讀取原始 Excel 檔案
file_path = r"C:\Users\EP1430\Downloads\250704 OMS 出貨資料.xlsx"  # 請替換為實際檔案路徑
df = pd.read_excel(file_path)

# 指定要保留的客戶代號
target_customers = ['27365925', '27365925DS']

# 篩選 Q欄 (第17欄, 索引為16)
filtered_df = df[df.iloc[:, 16].astype(str).isin(target_customers)]

# 建立新表格，依照指定順序與邏輯
new_df = pd.DataFrame({
    "銷貨日期": "",                                     # 空白欄
    "客戶代號(固定)": filtered_df.iloc[:, 16],        # Q欄
    "部門代號(固定)": filtered_df.iloc[:, 17],        # R欄
    "通路訂單編號": filtered_df.iloc[:, 11],          # L欄
    "備註": filtered_df.iloc[:, 3],                   # D欄
    "品號": filtered_df.iloc[:, 9],                   # J欄
    "數量": filtered_df.iloc[:, 13],                  # N欄
    "金額": filtered_df.iloc[:, 15],                  # P欄
    "通路訂單序號(不填)": "",                         # 空白欄
    "庫別": filtered_df.iloc[:, 20],                  # U欄
    "發票地址一(固定)": filtered_df.iloc[:, 19],      # T欄
    "客戶全名(固定)": filtered_df.iloc[:, 18]         # S欄
})

# 匯出為 Excel 檔案
output_path = r"C:\Users\EP1430\Downloads\MOMO轉檔.xlsx"
new_df.to_excel(output_path, index=False)

print("已完成匯出：", output_path)

