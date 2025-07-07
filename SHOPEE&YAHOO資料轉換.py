import pandas as pd

# 讀取原始 Excel 檔案
file_path = r"C:\Users\EP1430\Downloads\250704 OMS 出貨資料.xlsx"  # 將此改為您的檔案路徑
df = pd.read_excel(file_path)

# 指定要保留的客戶代號
target_customers = ['56801904A', '56801904D', '27240313A']

# 篩選 Q欄 (第17欄, 索引為16)
filtered_df = df[df.iloc[:, 16].astype(str).isin(target_customers)]

# 建立新表格，對應欄位如下：
new_df = pd.DataFrame({
    "銷貨日期": "",                                     # 空白欄
    "客戶代號(固定)": filtered_df.iloc[:, 16],         # Q欄
    "部門代號(固定)": filtered_df.iloc[:, 17],         # R欄
    "通路訂單編號": filtered_df.apply(
        lambda row: row.iloc[4] if row.iloc[16] in ['56801904A', '56801904D'] else row.iloc[11],
        axis=1
    ),                                                 # E欄 或 L欄
    "備註": filtered_df.iloc[:, 3],                    # D欄
    "品號": filtered_df.iloc[:, 9],                    # J欄
    "數量": filtered_df.iloc[:, 13],                   # N欄
    "金額": filtered_df.iloc[:, 15],                   # P欄
    "通路訂單序號(要填)": "",                          # 初始化空白
    "庫別": filtered_df.iloc[:, 20],                  # U欄
    "發票地址一(固定)": filtered_df.iloc[:, 19],       # T欄
    "客戶全名(固定)": filtered_df.iloc[:, 18]          # S欄
})

# 為每個 (通路訂單編號 + 備註) 組合產生通路訂單序號
new_df["通路訂單序號(要填)"] = (
    new_df.groupby(["通路訂單編號", "備註"]).cumcount() + 1
)

# 匯出為 Excel 檔案
output_path = r"C:\Users\EP1430\Downloads\蝦皮&YAHOO轉檔.xlsx"
new_df.to_excel(output_path, index=False)

print("已完成匯出：", output_path)
