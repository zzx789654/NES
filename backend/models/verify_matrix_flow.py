import io
from datetime import date
from services.nessus_parser import parse_nessus_csv

def test_matrix_data_parsing_verification():
    """
    直接驗證：測試 Nessus CSV 中的矩陣關鍵欄位（EPSS Score, VPR Score）
    確保數據流從 CSV 解析到 JSON 序列化的完整性。
    """
    # 模擬真實的 Nessus 匯出欄位
    csv_data = (
        "Plugin ID,CVE,Risk,Host,Name,EPSS Score,VPR Score\n"
        "1001,CVE-2023-1234,Critical,192.168.1.1,Vuln A,0.98765,9.8\n"
        "1002,CVE-2023-5678,High,192.168.1.2,Vuln B,0.12345,7.2\n"
        "1003,,Medium,192.168.1.3,Vuln C,,5.0\n" # 測試缺失 EPSS
    ).encode("utf-8")

    result = parse_nessus_csv(csv_data, "Verification Scan", date.today())
    vulns = result["vulnerabilities"]

    # 1. 驗證欄位映射 (Alias Matching)
    assert "epss" in vulns[0], "應包含 epss 欄位"
    assert "vpr" in vulns[0], "應包含 vpr 欄位"

    # 2. 驗證精度處理 (Rounding)
    # EPSS 應取 4 位，VPR 應取 1 位
    assert vulns[0]["epss"] == 0.9877
    assert vulns[0]["vpr"] == 9.8

    # 3. 驗證空值處理 (NaN handling)
    # pandas 的 NaN 必須轉換為 None，否則 FastAPI 序列化會噴 500
    assert vulns[2]["epss"] is None, "缺失的 EPSS 應轉為 None (JSON null)"
    assert vulns[2]["vpr"] == 5.0

    print("✅ Matrix Data Flow 驗證通過")