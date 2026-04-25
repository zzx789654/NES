// SecVision Mock API — simulates REST backend with localStorage persistence

const MockAPI = (() => {
  // ─── Vulnerability Scan Data ───────────────────────────────────────────────
  const SCAN_LIBRARY = {
    'scan-2024q3': {
      id: 'scan-2024q3', name: 'Q3 2024 全站弱點掃描', date: '2024-09-15',
      hosts: ['192.168.1.10','192.168.1.11','192.168.1.20','192.168.1.30','192.168.1.100','10.0.0.5','10.0.0.10','172.16.0.1'],
      vulns: [
        { id:'v001', plugin_id:'10863', cve:'-', cvss:'4.3', risk:'Medium', host:'192.168.1.10', protocol:'tcp', port:'443', name:'SSL Certificate Signed Using Weak Hash Algorithm', synopsis:'SSL 憑證使用弱雜湊演算法', description:'遠端主機的 SSL 憑證使用 MD5 或 SHA-1 等弱雜湊演算法簽署，可能遭受偽造攻擊。', solution:'向憑證授權中心申請使用 SHA-256 或更強的演算法重新簽發憑證。', plugin_output:'Subject: CN=webserver.corp.local\nIssuer: SHA1withRSA' },
        { id:'v002', plugin_id:'20007', cve:'-', cvss:'5.0', risk:'Medium', host:'192.168.1.10', protocol:'tcp', port:'443', name:'SSL Version 2 and 3 Protocol Detection', synopsis:'偵測到 SSLv2/v3 協定', description:'遠端服務接受 SSLv2/v3 連線，這些協定已知存在多個設計缺陷。', solution:'停用 SSLv2 和 SSLv3，僅使用 TLSv1.2 或 TLSv1.3。', plugin_output:'SSLv3 is enabled on port 443' },
        { id:'v003', plugin_id:'57582', cve:'CVE-2014-0160', cvss:'10.0', risk:'Critical', host:'192.168.1.10', protocol:'tcp', port:'443', name:'OpenSSL Heartbleed Information Disclosure', synopsis:'OpenSSL Heartbleed 資訊洩漏', description:'OpenSSL 1.0.1 – 1.0.1f 版本的 heartbeat 擴充功能存在缺陷，允許攻擊者讀取記憶體中的敏感資料。', solution:'升級 OpenSSL 至 1.0.1g 或更高版本，並重新生成所有私密金鑰與憑證。', plugin_output:'Detected version: OpenSSL 1.0.1e' },
        { id:'v004', plugin_id:'65821', cve:'CVE-2023-21912', cvss:'7.5', risk:'High', host:'192.168.1.11', protocol:'tcp', port:'3306', name:'MySQL Server Unauthenticated Access', synopsis:'MySQL 允許未認證存取', description:'遠端 MySQL 服務允許未經認證的遠端連線，可能導致資料庫內容洩漏。', solution:'設定 MySQL 僅監聽本機介面，並強制所有帳號使用強密碼。', plugin_output:'MySQL version: 8.0.28' },
        { id:'v005', plugin_id:'97833', cve:'CVE-2017-0144', cvss:'9.8', risk:'Critical', host:'192.168.1.20', protocol:'tcp', port:'445', name:'MS17-010: EternalBlue SMB Remote Code Execution', synopsis:'SMB EternalBlue 遠端程式碼執行', description:'Windows SMB 伺服器中存在遠端程式碼執行漏洞，WannaCry 等勒索病毒廣泛利用此漏洞。', solution:'套用 Microsoft 安全更新 MS17-010，並停用 SMBv1 協定。', plugin_output:'OS: Windows Server 2012 R2\nSMBv1 is enabled' },
        { id:'v006', plugin_id:'99759', cve:'-', cvss:'2.6', risk:'Low', host:'192.168.1.10', protocol:'tcp', port:'22', name:'SSH Weak Algorithms Supported', synopsis:'SSH 支援弱加密演算法', description:'遠端 SSH 服務支援被認為較弱的加密演算法，包括 arcfour、blowfish-cbc 等。', solution:'修改 SSH 設定檔，停用弱加密演算法，僅使用 AES-GCM 等強演算法。', plugin_output:'Supported ciphers: arcfour, blowfish-cbc, aes128-cbc' },
        { id:'v007', plugin_id:'100938', cve:'CVE-2023-44487', cvss:'7.5', risk:'High', host:'192.168.1.30', protocol:'tcp', port:'80', name:'HTTP/2 Rapid Reset Attack', synopsis:'HTTP/2 快速重置攻擊（DoS）', description:'HTTP/2 協定中存在漏洞，攻擊者可透過快速重置 stream 導致服務拒絕。', solution:'升級網頁伺服器至修補版本，或部署 WAF 防護規則。', plugin_output:'Apache httpd 2.4.51 detected' },
        { id:'v008', plugin_id:'110723', cve:'CVE-2021-44228', cvss:'10.0', risk:'Critical', host:'192.168.1.20', protocol:'tcp', port:'8080', name:'Apache Log4j Remote Code Execution (Log4Shell)', synopsis:'Log4Shell 遠端程式碼執行', description:'Apache Log4j 2.x 存在 JNDI 注入漏洞，攻擊者可透過特製的日誌訊息觸發遠端程式碼執行。', solution:'升級 Log4j 至 2.17.1 (Java 8)、2.12.4 (Java 7) 或 2.3.2 (Java 6) 或以上版本。', plugin_output:'Detected Log4j version: 2.14.1\nPath: /opt/app/lib/log4j-core-2.14.1.jar' },
        { id:'v009', plugin_id:'120453', cve:'CVE-2023-0464', cvss:'5.9', risk:'Medium', host:'10.0.0.5', protocol:'tcp', port:'443', name:'OpenSSL Certificate Chain Validation Vulnerability', synopsis:'OpenSSL 憑證鏈驗證漏洞', description:'OpenSSL 在處理大型 X.509 憑證鏈時存在記憶體消耗問題，可能導致服務拒絕。', solution:'升級 OpenSSL 至 3.1.1、3.0.9、1.1.1u 或以上版本。', plugin_output:'OpenSSL 3.0.2 detected' },
        { id:'v010', plugin_id:'125313', cve:'CVE-2023-0215', cvss:'7.5', risk:'High', host:'10.0.0.10', protocol:'tcp', port:'25', name:'Postfix SMTP Use-After-Free Vulnerability', synopsis:'Postfix SMTP 釋放後使用漏洞', description:'OpenSSL BIO_new_NDEF 函式中的 use-after-free 錯誤可能允許攻擊者造成服務崩潰。', solution:'升級 Postfix 並更新 OpenSSL 至修補版本。', plugin_output:'Postfix 3.5.8 with OpenSSL 1.0.2k detected' },
        { id:'v011', plugin_id:'133023', cve:'-', cvss:'4.3', risk:'Medium', host:'172.16.0.1', protocol:'tcp', port:'443', name:'TLS Version 1.0 Protocol Detection', synopsis:'偵測到 TLSv1.0 協定', description:'遠端服務接受使用 TLS 1.0 的連線，PCI DSS 及多項標準已要求停用此版本。', solution:'停用 TLS 1.0 和 1.1，僅允許 TLS 1.2 和 1.3。', plugin_output:'TLSv1.0 is enabled on port 443' },
        { id:'v012', plugin_id:'141752', cve:'-', cvss:'2.1', risk:'Low', host:'192.168.1.100', protocol:'tcp', port:'443', name:'HTTP Strict Transport Security (HSTS) Missing', synopsis:'缺少 HSTS 標頭', description:'Web 伺服器未設定 Strict-Transport-Security 回應標頭，可能允許降級攻擊。', solution:'在 Web 伺服器設定中加入 Strict-Transport-Security 標頭。', plugin_output:'HTTPS server at 192.168.1.100:443 does not return HSTS header' },
        { id:'v013', plugin_id:'149334', cve:'CVE-2023-2454', cvss:'7.2', risk:'High', host:'192.168.1.11', protocol:'tcp', port:'5432', name:'PostgreSQL Privilege Escalation', synopsis:'PostgreSQL 權限提升漏洞', description:'PostgreSQL 中 CREATE SCHEMA 及 CREATE TABLE 命令存在安全繞過問題，允許具有 CREATE 權限的使用者提升至超級使用者。', solution:'升級 PostgreSQL 至 15.3、14.8、13.11、12.15 或 11.20。', plugin_output:'PostgreSQL 14.5 detected' },
        { id:'v014', plugin_id:'153543', cve:'CVE-2022-42889', cvss:'9.8', risk:'Medium', host:'192.168.1.20', protocol:'tcp', port:'8080', name:'Apache Commons Text RCE (Text4Shell)', synopsis:'Apache Commons Text 遠端程式碼執行', description:'Apache Commons Text 1.5 至 1.9 版本存在 RCE 漏洞，類似 Log4Shell，透過字串插值觸發。', solution:'升級 Apache Commons Text 至 1.10.0 或以上版本。', plugin_output:'commons-text-1.9.jar detected in classpath' },
        { id:'v015', plugin_id:'160561', cve:'CVE-2022-22965', cvss:'9.8', risk:'Critical', host:'10.0.0.5', protocol:'tcp', port:'443', name:'Spring Framework RCE (Spring4Shell)', synopsis:'Spring4Shell 遠端程式碼執行', description:'Spring Framework 中存在遠端程式碼執行漏洞，攻擊者可在 JDK 9+ 環境中利用 ClassLoader 寫入惡意程式碼。', solution:'升級 Spring Framework 至 5.3.18+ 或 5.2.20+，Spring Boot 升級至 2.6.6+ 或 2.5.12+。', plugin_output:'Spring Framework 5.3.16 detected' },
        { id:'v016', plugin_id:'162327', cve:'CVE-2017-7494', cvss:'9.8', risk:'High', host:'192.168.1.30', protocol:'tcp', port:'139', name:'Samba SambaCry Remote Code Execution', synopsis:'Samba SambaCry 遠端程式碼執行', description:'Samba 3.5.0 至 4.6.4 版本中可載入惡意共享程式庫，允許遠端程式碼執行，俗稱 SambaCry。', solution:'升級 Samba 至 4.6.4/4.5.10/4.4.14 或應用官方修補程式。', plugin_output:'Samba 4.5.2 detected' },
        { id:'v017', plugin_id:'170617', cve:'CVE-2022-0778', cvss:'7.5', risk:'Medium', host:'10.0.0.10', protocol:'tcp', port:'443', name:'OpenSSL BN_mod_sqrt() Infinite Loop DoS', synopsis:'OpenSSL 無限迴圈 DoS 漏洞', description:'OpenSSL BN_mod_sqrt() 函數在解析含有無效顯式橢圓曲線參數的憑證時可能陷入無限迴圈。', solution:'升級 OpenSSL 至 3.0.2、1.1.1n 或 1.0.2zd。', plugin_output:'OpenSSL 1.1.1m affected' },
        { id:'v018', plugin_id:'174003', cve:'-', cvss:'1.5', risk:'Low', host:'192.168.1.100', protocol:'tcp', port:'22', name:'SSH Server CBC Mode Ciphers Enabled', synopsis:'SSH 伺服器啟用 CBC 模式加密', description:'遠端 SSH 服務設定為允許 CBC 模式加密，可能遭受注入明文攻擊。', solution:'停用 CBC 加密模式，改用 CTR 或 GCM 模式。', plugin_output:'Supported CBC ciphers: aes128-cbc, aes192-cbc, aes256-cbc' },
        { id:'v019', plugin_id:'177954', cve:'CVE-2023-20269', cvss:'9.1', risk:'High', host:'172.16.0.1', protocol:'tcp', port:'4500', name:'Cisco ASA/FTD VPN Unauthorized Access', synopsis:'Cisco ASA VPN 未授權存取', description:'Cisco ASA 及 Firepower 威脅防禦軟體中存在漏洞，允許未認證攻擊者對 VPN 進行暴力破解攻擊。', solution:'套用 Cisco 安全公告 cisco-sa-asaftd-ravpn-auth-8LyfCkeC 中的修補程式。', plugin_output:'Cisco ASA version 9.16.1 detected' },
        { id:'v020', plugin_id:'181533', cve:'CVE-2023-25690', cvss:'9.8', risk:'Medium', host:'192.168.1.10', protocol:'tcp', port:'80', name:'Apache HTTP Server Request Smuggling', synopsis:'Apache HTTP Server 請求走私', description:'Apache HTTP Server 2.4.0 至 2.4.55 版本中，使用 mod_proxy 時存在 HTTP 請求走私漏洞。', solution:'升級 Apache HTTP Server 至 2.4.56 或以上版本。', plugin_output:'Apache httpd 2.4.55 detected' }
      ]
    },
    'scan-2024q4': {
      id: 'scan-2024q4', name: 'Q4 2024 全站弱點掃描', date: '2024-12-20',
      hosts: ['192.168.1.10','192.168.1.11','192.168.1.20','192.168.1.30','192.168.1.100','10.0.0.5','10.0.0.10','172.16.0.1'],
      vulns: [
        // Resolved: v003(Heartbleed), v005(EternalBlue), v008(Log4Shell), v015(Spring4Shell), v016(SambaCry)
        { id:'v001', plugin_id:'10863', cve:'-', cvss:'4.3', risk:'Medium', host:'192.168.1.10', protocol:'tcp', port:'443', name:'SSL Certificate Signed Using Weak Hash Algorithm', synopsis:'SSL 憑證使用弱雜湊演算法', description:'遠端主機的 SSL 憑證使用 MD5 或 SHA-1 等弱雜湊演算法簽署，可能遭受偽造攻擊。', solution:'向憑證授權中心申請使用 SHA-256 或更強的演算法重新簽發憑證。', plugin_output:'Subject: CN=webserver.corp.local\nIssuer: SHA1withRSA' },
        { id:'v002', plugin_id:'20007', cve:'-', cvss:'5.0', risk:'Medium', host:'192.168.1.10', protocol:'tcp', port:'443', name:'SSL Version 2 and 3 Protocol Detection', synopsis:'偵測到 SSLv2/v3 協定', description:'遠端服務接受 SSLv2/v3 連線，這些協定已知存在多個設計缺陷。', solution:'停用 SSLv2 和 SSLv3，僅使用 TLSv1.2 或 TLSv1.3。', plugin_output:'SSLv3 is enabled on port 443' },
        { id:'v004', plugin_id:'65821', cve:'CVE-2023-21912', cvss:'7.5', risk:'High', host:'192.168.1.11', protocol:'tcp', port:'3306', name:'MySQL Server Unauthenticated Access', synopsis:'MySQL 允許未認證存取', description:'遠端 MySQL 服務允許未經認證的遠端連線。', solution:'設定 MySQL 僅監聽本機介面，並強制所有帳號使用強密碼。', plugin_output:'MySQL version: 8.0.28' },
        { id:'v006', plugin_id:'99759', cve:'-', cvss:'2.6', risk:'Low', host:'192.168.1.10', protocol:'tcp', port:'22', name:'SSH Weak Algorithms Supported', synopsis:'SSH 支援弱加密演算法', description:'遠端 SSH 服務支援被認為較弱的加密演算法。', solution:'修改 SSH 設定檔，僅使用強演算法。', plugin_output:'Supported ciphers: arcfour, blowfish-cbc, aes128-cbc' },
        { id:'v007', plugin_id:'100938', cve:'CVE-2023-44487', cvss:'7.5', risk:'High', host:'192.168.1.30', protocol:'tcp', port:'80', name:'HTTP/2 Rapid Reset Attack', synopsis:'HTTP/2 快速重置攻擊（DoS）', description:'HTTP/2 協定中存在漏洞，攻擊者可透過快速重置 stream 導致服務拒絕。', solution:'升級網頁伺服器至修補版本。', plugin_output:'Apache httpd 2.4.51 detected' },
        { id:'v009', plugin_id:'120453', cve:'CVE-2023-0464', cvss:'5.9', risk:'Medium', host:'10.0.0.5', protocol:'tcp', port:'443', name:'OpenSSL Certificate Chain Validation Vulnerability', synopsis:'OpenSSL 憑證鏈驗證漏洞', description:'OpenSSL 在處理大型 X.509 憑證鏈時存在記憶體消耗問題。', solution:'升級 OpenSSL 至 3.1.1 或以上版本。', plugin_output:'OpenSSL 3.0.2 detected' },
        { id:'v010', plugin_id:'125313', cve:'CVE-2023-0215', cvss:'7.5', risk:'High', host:'10.0.0.10', protocol:'tcp', port:'25', name:'Postfix SMTP Use-After-Free Vulnerability', synopsis:'Postfix SMTP 釋放後使用漏洞', description:'OpenSSL BIO_new_NDEF 函式中的 use-after-free 錯誤。', solution:'升級 Postfix 並更新 OpenSSL 至修補版本。', plugin_output:'Postfix 3.5.8 with OpenSSL 1.0.2k detected' },
        { id:'v011', plugin_id:'133023', cve:'-', cvss:'4.3', risk:'Medium', host:'172.16.0.1', protocol:'tcp', port:'443', name:'TLS Version 1.0 Protocol Detection', synopsis:'偵測到 TLSv1.0 協定', description:'遠端服務接受使用 TLS 1.0 的連線。', solution:'停用 TLS 1.0 和 1.1，僅允許 TLS 1.2 和 1.3。', plugin_output:'TLSv1.0 is enabled on port 443' },
        { id:'v012', plugin_id:'141752', cve:'-', cvss:'2.1', risk:'Low', host:'192.168.1.100', protocol:'tcp', port:'443', name:'HTTP Strict Transport Security (HSTS) Missing', synopsis:'缺少 HSTS 標頭', description:'Web 伺服器未設定 Strict-Transport-Security 回應標頭。', solution:'加入 Strict-Transport-Security 標頭。', plugin_output:'Does not return HSTS header' },
        { id:'v013', plugin_id:'149334', cve:'CVE-2023-2454', cvss:'7.2', risk:'High', host:'192.168.1.11', protocol:'tcp', port:'5432', name:'PostgreSQL Privilege Escalation', synopsis:'PostgreSQL 權限提升漏洞', description:'PostgreSQL 存在安全繞過問題，允許具有 CREATE 權限的使用者提升至超級使用者。', solution:'升級 PostgreSQL 至 15.3 或以上版本。', plugin_output:'PostgreSQL 14.5 detected' },
        { id:'v014', plugin_id:'153543', cve:'CVE-2022-42889', cvss:'9.8', risk:'Medium', host:'192.168.1.20', protocol:'tcp', port:'8080', name:'Apache Commons Text RCE (Text4Shell)', synopsis:'Apache Commons Text RCE', description:'Apache Commons Text 1.5 至 1.9 版本存在 RCE 漏洞。', solution:'升級至 1.10.0。', plugin_output:'commons-text-1.9.jar detected' },
        { id:'v017', plugin_id:'170617', cve:'CVE-2022-0778', cvss:'7.5', risk:'Medium', host:'10.0.0.10', protocol:'tcp', port:'443', name:'OpenSSL BN_mod_sqrt() Infinite Loop DoS', synopsis:'OpenSSL 無限迴圈 DoS', description:'OpenSSL BN_mod_sqrt() 函數存在無限迴圈問題。', solution:'升級至 3.0.2 或以上。', plugin_output:'OpenSSL 1.1.1m affected' },
        { id:'v018', plugin_id:'174003', cve:'-', cvss:'1.5', risk:'Low', host:'192.168.1.100', protocol:'tcp', port:'22', name:'SSH Server CBC Mode Ciphers Enabled', synopsis:'SSH CBC 模式加密', description:'遠端 SSH 服務設定為允許 CBC 模式加密。', solution:'停用 CBC 加密模式。', plugin_output:'Supported CBC ciphers enabled' },
        { id:'v019', plugin_id:'177954', cve:'CVE-2023-20269', cvss:'9.1', risk:'High', host:'172.16.0.1', protocol:'tcp', port:'4500', name:'Cisco ASA/FTD VPN Unauthorized Access', synopsis:'Cisco ASA VPN 未授權存取', description:'允許未認證攻擊者對 VPN 進行暴力破解攻擊。', solution:'套用 Cisco 官方修補程式。', plugin_output:'Cisco ASA version 9.16.1 detected' },
        { id:'v020', plugin_id:'181533', cve:'CVE-2023-25690', cvss:'9.8', risk:'Medium', host:'192.168.1.10', protocol:'tcp', port:'80', name:'Apache HTTP Server Request Smuggling', synopsis:'Apache 請求走私', description:'Apache 2.4.0 至 2.4.55 使用 mod_proxy 時存在請求走私漏洞。', solution:'升級至 2.4.56。', plugin_output:'Apache httpd 2.4.55 detected' },
        // New in Q4:
        { id:'v021', plugin_id:'183429', cve:'CVE-2024-3400', cvss:'10.0', risk:'Critical', host:'172.16.0.1', protocol:'tcp', port:'443', name:'PAN-OS GlobalProtect OS Command Injection', synopsis:'PAN-OS GlobalProtect 命令注入 (CVSS 10)', description:'Palo Alto Networks PAN-OS GlobalProtect 功能中存在命令注入漏洞，允許未認證攻擊者以 root 執行任意程式碼。', solution:'升級 PAN-OS 至 11.1.2-h3、11.0.4-h1、10.2.9-h1 或以上版本。', plugin_output:'PAN-OS 10.2.4 detected on GlobalProtect portal' },
        { id:'v022', plugin_id:'185771', cve:'CVE-2024-21762', cvss:'9.6', risk:'Critical', host:'172.16.0.1', protocol:'tcp', port:'4443', name:'Fortinet FortiOS Out-of-Bounds Write RCE', synopsis:'Fortinet SSL VPN 越界寫入 RCE', description:'Fortinet FortiOS SSL VPN 中存在越界寫入漏洞，允許未認證遠端攻擊者透過特製的 HTTP 請求執行任意程式碼。', solution:'升級 FortiOS 至 7.4.3、7.2.7、7.0.14、6.4.15 或以上版本。', plugin_output:'FortiOS 7.2.5 detected' }
      ]
    },
    'scan-2025q1': {
      id: 'scan-2025q1', name: 'Q1 2025 全站弱點掃描', date: '2025-03-10',
      hosts: ['192.168.1.10','192.168.1.11','192.168.1.20','192.168.1.30','192.168.1.50','192.168.1.100','10.0.0.5','10.0.0.10','172.16.0.1'],
      vulns: [
        // Resolved: v004(MySQL), v013(PostgreSQL), v019(Cisco ASA)
        { id:'v001', plugin_id:'10863', cve:'-', cvss:'4.3', risk:'Medium', host:'192.168.1.10', protocol:'tcp', port:'443', name:'SSL Certificate Signed Using Weak Hash Algorithm', synopsis:'SSL 憑證使用弱雜湊演算法', description:'遠端主機的 SSL 憑證使用弱雜湊演算法簽署。', solution:'申請使用 SHA-256 或更強的演算法重新簽發憑證。', plugin_output:'Subject: CN=webserver.corp.local' },
        { id:'v002', plugin_id:'20007', cve:'-', cvss:'5.0', risk:'Medium', host:'192.168.1.10', protocol:'tcp', port:'443', name:'SSL Version 2 and 3 Protocol Detection', synopsis:'偵測到 SSLv2/v3 協定', description:'遠端服務接受 SSLv2/v3 連線。', solution:'停用 SSLv2 和 SSLv3。', plugin_output:'SSLv3 is enabled on port 443' },
        { id:'v006', plugin_id:'99759', cve:'-', cvss:'2.6', risk:'Low', host:'192.168.1.10', protocol:'tcp', port:'22', name:'SSH Weak Algorithms Supported', synopsis:'SSH 支援弱加密演算法', description:'遠端 SSH 服務支援較弱的加密演算法。', solution:'僅使用 AES-GCM 等強演算法。', plugin_output:'Supported ciphers: arcfour, blowfish-cbc' },
        { id:'v007', plugin_id:'100938', cve:'CVE-2023-44487', cvss:'7.5', risk:'High', host:'192.168.1.30', protocol:'tcp', port:'80', name:'HTTP/2 Rapid Reset Attack', synopsis:'HTTP/2 快速重置攻擊', description:'HTTP/2 協定中存在漏洞，允許 DoS 攻擊。', solution:'升級網頁伺服器至修補版本。', plugin_output:'Apache httpd 2.4.51 detected' },
        { id:'v009', plugin_id:'120453', cve:'CVE-2023-0464', cvss:'5.9', risk:'Medium', host:'10.0.0.5', protocol:'tcp', port:'443', name:'OpenSSL Certificate Chain Validation Vulnerability', synopsis:'OpenSSL 憑證鏈驗證漏洞', description:'記憶體消耗問題可能導致服務拒絕。', solution:'升級 OpenSSL。', plugin_output:'OpenSSL 3.0.2 detected' },
        { id:'v010', plugin_id:'125313', cve:'CVE-2023-0215', cvss:'7.5', risk:'High', host:'10.0.0.10', protocol:'tcp', port:'25', name:'Postfix SMTP Use-After-Free Vulnerability', synopsis:'Postfix SMTP 釋放後使用', description:'use-after-free 可能導致服務崩潰。', solution:'升級 Postfix 並更新 OpenSSL。', plugin_output:'Postfix 3.5.8 detected' },
        { id:'v011', plugin_id:'133023', cve:'-', cvss:'4.3', risk:'Medium', host:'172.16.0.1', protocol:'tcp', port:'443', name:'TLS Version 1.0 Protocol Detection', synopsis:'偵測到 TLSv1.0', description:'仍在使用已廢棄的 TLS 1.0。', solution:'停用 TLS 1.0。', plugin_output:'TLSv1.0 is enabled' },
        { id:'v012', plugin_id:'141752', cve:'-', cvss:'2.1', risk:'Low', host:'192.168.1.100', protocol:'tcp', port:'443', name:'HTTP Strict Transport Security (HSTS) Missing', synopsis:'缺少 HSTS 標頭', description:'缺少 HSTS 標頭。', solution:'加入 HSTS 標頭。', plugin_output:'No HSTS header' },
        { id:'v014', plugin_id:'153543', cve:'CVE-2022-42889', cvss:'9.8', risk:'Medium', host:'192.168.1.20', protocol:'tcp', port:'8080', name:'Apache Commons Text RCE (Text4Shell)', synopsis:'Text4Shell RCE', description:'透過字串插值觸發 RCE。', solution:'升級至 1.10.0。', plugin_output:'commons-text-1.9.jar detected' },
        { id:'v017', plugin_id:'170617', cve:'CVE-2022-0778', cvss:'7.5', risk:'Medium', host:'10.0.0.10', protocol:'tcp', port:'443', name:'OpenSSL BN_mod_sqrt() Infinite Loop DoS', synopsis:'OpenSSL 無限迴圈', description:'可能陷入無限迴圈。', solution:'升級 OpenSSL。', plugin_output:'OpenSSL 1.1.1m affected' },
        { id:'v018', plugin_id:'174003', cve:'-', cvss:'1.5', risk:'Low', host:'192.168.1.100', protocol:'tcp', port:'22', name:'SSH Server CBC Mode Ciphers Enabled', synopsis:'SSH CBC 模式', description:'允許 CBC 模式加密。', solution:'停用 CBC 模式。', plugin_output:'CBC ciphers enabled' },
        { id:'v020', plugin_id:'181533', cve:'CVE-2023-25690', cvss:'9.8', risk:'Medium', host:'192.168.1.10', protocol:'tcp', port:'80', name:'Apache HTTP Server Request Smuggling', synopsis:'Apache 請求走私', description:'使用 mod_proxy 時存在請求走私。', solution:'升級至 2.4.56。', plugin_output:'Apache httpd 2.4.55 detected' },
        { id:'v021', plugin_id:'183429', cve:'CVE-2024-3400', cvss:'10.0', risk:'Critical', host:'172.16.0.1', protocol:'tcp', port:'443', name:'PAN-OS GlobalProtect OS Command Injection', synopsis:'PAN-OS 命令注入', description:'未修補的 CVE-2024-3400。', solution:'升級 PAN-OS。', plugin_output:'PAN-OS 10.2.4 detected' },
        { id:'v022', plugin_id:'185771', cve:'CVE-2024-21762', cvss:'9.6', risk:'Critical', host:'172.16.0.1', protocol:'tcp', port:'4443', name:'Fortinet FortiOS Out-of-Bounds Write RCE', synopsis:'Fortinet SSL VPN RCE', description:'越界寫入允許遠端執行。', solution:'升級 FortiOS。', plugin_output:'FortiOS 7.2.5 detected' },
        // New in Q1 2025:
        { id:'v023', plugin_id:'187234', cve:'CVE-2024-6387', cvss:'8.1', risk:'High', host:'192.168.1.20', protocol:'tcp', port:'22', name:'OpenSSH regreSSHion Race Condition RCE', synopsis:'OpenSSH regreSSHion RCE（競態條件）', description:'OpenSSH 伺服器中的競態條件漏洞（signal handler race condition），允許未認證遠端攻擊者執行任意程式碼。', solution:'升級 OpenSSH 至 9.8p1 或以上版本。', plugin_output:'OpenSSH 8.9p1 detected' },
        { id:'v024', plugin_id:'189012', cve:'CVE-2024-23897', cvss:'9.8', risk:'Critical', host:'192.168.1.50', protocol:'tcp', port:'8080', name:'Jenkins CLI Arbitrary File Read / RCE', synopsis:'Jenkins CLI 任意檔案讀取 / RCE', description:'Jenkins 2.441 及更早版本中，CLI 命令解析器允許讀取任意檔案，可能導致 RCE。', solution:'升級 Jenkins 至 2.442 (LTS: 2.426.3) 或以上版本並停用 CLI。', plugin_output:'Jenkins 2.440.1 LTS detected at /jenkins' },
        { id:'v025', plugin_id:'190445', cve:'CVE-2025-0282', cvss:'9.0', risk:'Critical', host:'192.168.1.50', protocol:'tcp', port:'443', name:'Ivanti Connect Secure Stack-Based Buffer Overflow', synopsis:'Ivanti Connect Secure 堆疊緩衝區溢位', description:'Ivanti Connect Secure 22.7R2.4 及更早版本存在堆疊型緩衝區溢位，允許未認證遠端攻擊者執行任意程式碼。', solution:'套用 Ivanti 安全更新並執行 ICT 完整性掃描。', plugin_output:'Ivanti Connect Secure 22.7R2.3 detected' }
      ]
    }
  };

  // ─── ISO 27001 Records ─────────────────────────────────────────────────────
  const DEFAULT_ISO = {
    ncr: [
      { id:'ncr-001', no:'NCR-2024-001', title:'未定期更新防毒軟體病毒碼', clause:'A.8.7', severity:'Major', status:'已關閉', owner:'資安部', created:'2024-06-10', updated:'2024-07-15', description:'稽核發現 3 台工作站防毒軟體病毒碼超過 30 天未更新。', rootCause:'缺乏自動更新機制及定期查核流程。', history:[{date:'2024-06-10',action:'開立 NCR',by:'稽核員 Wang'},{date:'2024-06-20',action:'根本原因分析完成',by:'資安部 Chen'},{date:'2024-07-15',action:'矯正措施完成，NCR 關閉',by:'稽核員 Wang'}] },
      { id:'ncr-002', no:'NCR-2024-002', title:'特殊帳號密碼未定期更換', clause:'A.5.16', severity:'Major', status:'處理中', owner:'IT部', created:'2024-09-01', updated:'2024-11-20', description:'系統管理員帳號密碼超過 90 天未更換，違反密碼政策。', rootCause:'密碼政策未強制執行於特殊帳號。', history:[{date:'2024-09-01',action:'開立 NCR',by:'稽核員 Lee'},{date:'2024-10-05',action:'矯正措施計劃提交',by:'IT部 Lin'}] },
      { id:'ncr-003', no:'NCR-2024-003', title:'備份資料未加密儲存', clause:'A.8.24', severity:'Minor', status:'待處理', owner:'IT部', created:'2024-11-15', updated:'2024-11-15', description:'異地備份磁帶以明文形式儲存，未進行加密保護。', rootCause:'備份流程設計未考量加密需求。', history:[{date:'2024-11-15',action:'開立 NCR',by:'稽核員 Wang'}] },
    ],
    capa: [
      { id:'capa-001', no:'CAPA-2024-001', title:'建立自動化病毒碼更新機制', type:'矯正', relatedNCR:'NCR-2024-001', status:'已完成', owner:'IT部', dueDate:'2024-07-10', created:'2024-06-15', description:'部署集中式病毒碼更新伺服器，並設定每日自動推送更新至所有端點。', effectiveness:'已驗證所有端點病毒碼更新正常，稽核通過。', history:[{date:'2024-06-15',action:'CAPA 開立'},{ date:'2024-07-08',action:'實施完成'},{date:'2024-07-15',action:'有效性驗證通過'}] },
      { id:'capa-002', no:'CAPA-2024-002', title:'強制實施特殊帳號密碼政策', type:'矯正', relatedNCR:'NCR-2024-002', status:'進行中', owner:'IT部', dueDate:'2025-01-31', created:'2024-10-05', description:'修改 AD 群組原則，對所有特殊帳號強制執行 90 天密碼到期政策及複雜度要求。', effectiveness:'-', history:[{date:'2024-10-05',action:'CAPA 開立'},{date:'2024-11-20',action:'群組原則設定進行中'}] },
      { id:'capa-003', no:'CAPA-2024-003', title:'全員資安意識教育訓練', type:'預防', relatedNCR:'-', status:'已完成', owner:'資安部', dueDate:'2024-10-30', created:'2024-08-01', description:'針對社交工程攻擊、釣魚郵件等威脅進行全員線上教育訓練。', effectiveness:'完訓率 98%，釣魚郵件點擊率由 15% 降至 3%。', history:[{date:'2024-08-01',action:'計畫制定'},{date:'2024-09-15',action:'訓練課程發布'},{date:'2024-10-30',action:'訓練完成，效果評估'}] },
    ],
    assets: [
      { id:'asset-001', assetId:'AST-001', name:'核心資料庫伺服器', type:'硬體', owner:'IT部', location:'資料中心 A 區', classification:'極機密', status:'使用中', value:'高', created:'2023-01-15' },
      { id:'asset-002', assetId:'AST-002', name:'ERP 系統', type:'軟體', owner:'財務部', location:'資料中心 A 區', classification:'機密', status:'使用中', value:'高', created:'2023-01-15' },
      { id:'asset-003', assetId:'AST-003', name:'客戶個資資料庫', type:'資訊', owner:'行銷部', location:'雲端 (AWS ap-northeast-1)', classification:'極機密', status:'使用中', value:'極高', created:'2023-03-20' },
      { id:'asset-004', assetId:'AST-004', name:'備份磁帶', type:'硬體', owner:'IT部', location:'異地備份中心', classification:'機密', status:'使用中', value:'高', created:'2023-01-15' },
      { id:'asset-005', assetId:'AST-005', name:'VPN 閘道器', type:'網路設備', owner:'IT部', location:'資料中心 A 區', classification:'內部使用', status:'使用中', value:'中', created:'2023-06-01' },
    ],
    risk: [
      { id:'risk-001', riskId:'RSK-001', title:'外部駭客入侵攻擊', category:'技術', likelihood:'高', impact:'極高', riskLevel:'極高', controls:'防火牆、IPS、WAF、滲透測試', treatment:'降低', residualRisk:'中', owner:'資安部', reviewDate:'2025-06-01', status:'監控中' },
      { id:'risk-002', riskId:'RSK-002', title:'員工不當操作導致資料洩漏', category:'人員', likelihood:'中', impact:'高', riskLevel:'高', controls:'教育訓練、DLP 系統、存取控制', treatment:'降低', residualRisk:'低', owner:'人資部', reviewDate:'2025-06-01', status:'監控中' },
      { id:'risk-003', riskId:'RSK-003', title:'勒索病毒加密重要資料', category:'技術', likelihood:'中', impact:'極高', riskLevel:'高', controls:'備份機制、端點防護、EDR', treatment:'降低', residualRisk:'低', owner:'IT部', reviewDate:'2025-06-01', status:'監控中' },
      { id:'risk-004', riskId:'RSK-004', title:'供應商系統存取不當', category:'第三方', likelihood:'低', impact:'高', riskLevel:'中', controls:'供應商稽核、最小權限原則', treatment:'降低', residualRisk:'低', owner:'採購部', reviewDate:'2025-06-01', status:'監控中' },
    ],
    audit: [
      { id:'audit-001', auditId:'AUD-2024-001', title:'2024 年內部稽核 - 存取控制', type:'內部稽核', scope:'A.5.15, A.5.16, A.8.2, A.8.3', auditor:'王稽核員', auditDate:'2024-06-05', status:'已完成', findings:'3 項不符合事項，8 項觀察事項', ncrs:'NCR-2024-001, NCR-2024-002', summary:'整體存取控制架構符合規範，但特殊帳號管理及端點保護需要加強。' },
      { id:'audit-002', auditId:'AUD-2024-002', title:'2024 年外部稽核 - 認證稽核', type:'外部稽核', scope:'ISO 27001:2022 全章節', auditor:'TÜV 稽核員', auditDate:'2024-11-12', status:'已完成', findings:'2 項輕微不符合，15 項改善機會', ncrs:'NCR-2024-003', summary:'通過 ISO 27001:2022 認證稽核，持續保有認證資格。備份加密及供應商管理有改善空間。' },
    ],
    supplier: [
      { id:'sup-001', supplierId:'SUP-001', name:'CloudTech Solutions Ltd.', service:'雲端基礎設施 (AWS 代理)', riskLevel:'高', status:'已核准', certifications:'ISO 27001, SOC2 Type II', lastAudit:'2024-08-15', nextAudit:'2025-08-15', contact:'John Chen / john@cloudtech.com', notes:'主要雲端服務供應商，每年進行安全稽核。' },
      { id:'sup-002', supplierId:'SUP-002', name:'SecureDev Corp.', service:'應用程式開發外包', riskLevel:'高', status:'已核准', certifications:'ISO 27001', lastAudit:'2024-05-20', nextAudit:'2025-05-20', contact:'Mary Liu / mary@securedev.com', notes:'開發人員可存取原始碼及測試環境，需嚴格管控。' },
      { id:'sup-003', supplierId:'SUP-003', name:'CleanSpace Service', service:'辦公室清潔服務', riskLevel:'低', status:'已核准', certifications:'-', lastAudit:'2024-01-10', nextAudit:'2025-01-10', contact:'Robert Wang / rw@cleanspace.com', notes:'人員進出受管控區域需簽署保密協定。' },
    ]
  };

  // ─── NIST Data ──────────────────────────────────────────────────────────────
  const NIST_CSF_DATA = {
    functions: [
      { id:'GV', name:'Govern', label:'治理', score:72, color:'#7c6af5',
        categories:[
          { id:'GV.OC', name:'組織情境', score:85, controls:['GV.OC-01 任務與目標已記錄','GV.OC-02 利害關係人需求已識別','GV.OC-03 法規需求已確認','GV.OC-04 風險承受度已定義'] },
          { id:'GV.RM', name:'風險管理策略', score:70, controls:['GV.RM-01 風險管理流程已建立','GV.RM-02 風險評鑑方法已定義','GV.RM-03 風險容忍度已核准','GV.RM-04 策略性風險已登錄'] },
          { id:'GV.RR', name:'角色與責任', score:80, controls:['GV.RR-01 領導階層責任已定義','GV.RR-02 CISO 角色已設立','GV.RR-03 資安責任已分配'] },
          { id:'GV.PO', name:'政策', score:65, controls:['GV.PO-01 資安政策已核准','GV.PO-02 政策已傳達全員','GV.PO-03 政策定期審查'] },
          { id:'GV.OV', name:'監督', score:60, controls:['GV.OV-01 資安績效已審查','GV.OV-02 稽核結果已追蹤'] },
          { id:'GV.SC', name:'供應鏈風險', score:55, controls:['GV.SC-01 供應鏈安全需求已定義','GV.SC-02 供應商評估已執行','GV.SC-03 合約安全條款已納入'] },
        ]
      },
      { id:'ID', name:'Identify', label:'識別', score:78, color:'#3b82f6',
        categories:[
          { id:'ID.AM', name:'資產管理', score:82, controls:['ID.AM-01 IT 資產清冊已維護','ID.AM-02 軟體資產已管理','ID.AM-03 網路流量已記錄','ID.AM-04 外部系統已識別'] },
          { id:'ID.RA', name:'風險評鑑', score:75, controls:['ID.RA-01 弱點已識別','ID.RA-02 威脅情報已蒐集','ID.RA-03 威脅已識別','ID.RA-04 風險已評估','ID.RA-05 威脅已優先排序'] },
          { id:'ID.IM', name:'改善', score:68, controls:['ID.IM-01 改善計畫已建立','ID.IM-02 經驗教訓已記錄'] },
        ]
      },
      { id:'PR', name:'Protect', label:'保護', score:65, color:'#22c55e',
        categories:[
          { id:'PR.AA', name:'身份驗證', score:75, controls:['PR.AA-01 使用者身份已管理','PR.AA-02 服務身份已管理','PR.AA-03 使用者已認證','PR.AA-04 憑證已管理','PR.AA-05 存取權限已管理'] },
          { id:'PR.AT', name:'意識與訓練', score:70, controls:['PR.AT-01 全員已受訓','PR.AT-02 特殊角色已訓練'] },
          { id:'PR.DS', name:'資料安全', score:58, controls:['PR.DS-01 靜態資料已保護','PR.DS-02 傳輸中資料已保護','PR.DS-10 正在使用中資料已保護','PR.DS-11 備份已維護'] },
          { id:'PR.PS', name:'平台安全', score:62, controls:['PR.PS-01 設定基準已建立','PR.PS-02 軟體已維護','PR.PS-03 硬體已維護','PR.PS-04 日誌已產生'] },
          { id:'PR.IR', name:'技術基礎設施韌性', score:55, controls:['PR.IR-01 網路完整性已保護','PR.IR-02 存取授權已管理'] },
        ]
      },
      { id:'DE', name:'Detect', label:'偵測', score:60, color:'#f59e0b',
        categories:[
          { id:'DE.CM', name:'持續監控', score:65, controls:['DE.CM-01 網路已監控','DE.CM-02 實體環境已監控','DE.CM-03 人員活動已監控','DE.CM-06 外部服務活動已監控','DE.CM-09 運算硬體已監控'] },
          { id:'DE.AE', name:'異常事件分析', score:52, controls:['DE.AE-02 異常活動已分析','DE.AE-03 事件資料已相關聯','DE.AE-04 事件影響已評估','DE.AE-06 資訊已分享','DE.AE-07 網路威脅情報已使用','DE.AE-08 事件已宣告'] },
        ]
      },
      { id:'RS', name:'Respond', label:'回應', score:58, color:'#ef4444',
        categories:[
          { id:'RS.MA', name:'事件管理', score:65, controls:['RS.MA-01 事件已宣告','RS.MA-02 事件已分級','RS.MA-03 事件已升級','RS.MA-04 事件已回應','RS.MA-05 事件已宣告結束'] },
          { id:'RS.AN', name:'事件分析', score:55, controls:['RS.AN-03 事件已調查','RS.AN-06 關係已分析','RS.AN-07 IoC 已確認','RS.AN-08 鑑識活動已執行'] },
          { id:'RS.CO', name:'事件報告溝通', score:60, controls:['RS.CO-02 內部利害關係人已通知','RS.CO-03 外部利害關係人已告知'] },
          { id:'RS.MI', name:'事件緩解', score:55, controls:['RS.MI-01 事件已遏制','RS.MI-02 事件已根除'] },
          { id:'RS.IM', name:'改善', score:50, controls:['RS.IM-01 回應計畫已更新','RS.IM-02 回應策略已更新'] },
        ]
      },
      { id:'RC', name:'Recover', label:'復原', score:55, color:'#8b5cf6',
        categories:[
          { id:'RC.RP', name:'復原計畫執行', score:60, controls:['RC.RP-01 復原計畫已執行','RC.RP-02 恢復完整性已驗證','RC.RP-03 恢復資源已使用','RC.RP-04 受影響組織已恢復','RC.RP-05 完整性已還原','RC.RP-06 事件終止已宣告'] },
          { id:'RC.CO', name:'復原溝通', score:50, controls:['RC.CO-03 復原進度已溝通','RC.CO-04 公共關係已管理'] },
          { id:'RC.IM', name:'改善', score:52, controls:['RC.IM-01 復原計畫已更新','RC.IM-02 復原策略已更新'] },
        ]
      },
    ]
  };

  const NIST_800_53_DATA = {
    families: [
      { id:'AC', name:'Access Control 存取控制', score:72, controls:14 },
      { id:'AT', name:'Awareness & Training 意識與訓練', score:80, controls:6 },
      { id:'AU', name:'Audit & Accountability 稽核與責任', score:65, controls:12 },
      { id:'CA', name:'Assessment & Authorization 評鑑與授權', score:70, controls:9 },
      { id:'CM', name:'Configuration Management 設定管理', score:58, controls:12 },
      { id:'CP', name:'Contingency Planning 應變計畫', score:62, controls:13 },
      { id:'IA', name:'Identification & Authentication 識別與驗證', score:78, controls:13 },
      { id:'IR', name:'Incident Response 事件回應', score:55, controls:10 },
      { id:'MA', name:'Maintenance 維護', score:68, controls:6 },
      { id:'MP', name:'Media Protection 媒體保護', score:74, controls:8 },
      { id:'PE', name:'Physical Protection 實體保護', score:82, controls:22 },
      { id:'PL', name:'Planning 規劃', score:65, controls:10 },
      { id:'RA', name:'Risk Assessment 風險評鑑', score:70, controls:10 },
      { id:'SA', name:'System Acquisition 系統採購', score:60, controls:23 },
      { id:'SC', name:'System Communications 系統通訊', score:63, controls:51 },
      { id:'SI', name:'System Integrity 系統完整性', score:67, controls:23 },
      { id:'SR', name:'Supply Chain Risk 供應鏈風險', score:52, controls:12 },
    ]
  };

  // ─── OWASP Data ─────────────────────────────────────────────────────────────
  const OWASP_DATA = {
    'web-2021': {
      title: 'OWASP Top 10 Web Application (2021)',
      risks: [
        { id:'A01', rank:'A01', name:'Broken Access Control 存取控制失效', severity:'Critical', cwe:['CWE-200','CWE-201','CWE-352'], prevalence:'94%', description:'存取控制強制執行政策，使用者無法在其預定權限之外行動。存取控制失效通常導致未授權資訊洩漏、修改或刪除所有資料，或在使用者權限之外執行業務功能。', examples:['違反最小權限原則','可透過修改 URL 繞過存取控制','允許以主鍵形式查看或編輯他人帳號','存取 API 時缺乏 POST、PUT 和 DELETE 的存取控制'], mitigations:['實施最小權限原則','拒絕預設存取','集中實施存取控制機制','記錄存取控制失敗事件并在適當時候提醒管理員'], status:'風險接受' },
        { id:'A02', rank:'A02', name:'Cryptographic Failures 加密失敗', severity:'High', cwe:['CWE-259','CWE-327','CWE-331'], prevalence:'96%', description:'加密失敗（以前稱為敏感資料暴露）通常會導致敏感資料洩漏或系統被入侵。需要確定傳輸和儲存中的資料保護需求。', examples:['以明文傳輸密碼、信用卡號或健康記錄','使用 MD5 或 SHA1 等弱雜湊算法儲存密碼','使用弱加密密鑰或沒有適當初始化向量'], mitigations:['識別並分類系統處理的敏感資料','對靜態敏感資料加密','確保使用最新的強加密算法','禁用敏感資料快取'], status:'處理中' },
        { id:'A03', rank:'A03', name:'Injection 注入', severity:'High', cwe:['CWE-79','CWE-89','CWE-73'], prevalence:'94%', description:'當不受信任的資料作為命令或查詢的一部分發送到解釋器時，就會發生注入。攻擊者的惡意資料可以誘使解釋器在沒有適當授權的情況下執行非預期命令或訪問資料。', examples:['SQL 注入','OS 命令注入','LDAP 注入','跨站腳本 (XSS)'], mitigations:['使用參數化查詢','使用 ORM 框架','驗證、過濾或轉義所有使用者提供的資料','使用 LIMIT 限制 SQL 查詢返回的記錄數'], status:'已緩解' },
        { id:'A04', rank:'A04', name:'Insecure Design 不安全設計', severity:'High', cwe:['CWE-209','CWE-256','CWE-501'], prevalence:'新增', description:'不安全設計是一個廣泛的類別，代表不同的弱點，表現為缺失或無效的控制設計。不安全設計不是所有其他 Top 10 風險類別的根源。', examples:['業務邏輯繞過','缺乏速率限制導致憑證填充攻擊','訂票系統允許超額訂票'], mitigations:['建立並使用安全設計模式','使用威脅建模分析','將安全語言和控制整合到使用者故事中','在設計中整合安全考量（Shift Left）'], status:'待處理' },
        { id:'A05', rank:'A05', name:'Security Misconfiguration 安全設定失誤', severity:'High', cwe:['CWE-16','CWE-611'], prevalence:'90%', description:'90% 的應用程序測試某種形式的錯誤配置。隨著更多轉向高度可配置軟體，這一類別的上升也就不足為奇了。', examples:['雲端服務存取控制設定不當','預設帳號和密碼仍然啟用','錯誤處理向用戶顯示堆棧追蹤','目錄列表未禁用','不必要的功能已啟用（例如端口、服務）'], mitigations:['可重複的強化流程','最小化平台','定期審查雲端服務的配置','分段架構','發送安全指令給客戶端'], status:'處理中' },
        { id:'A06', rank:'A06', name:'Vulnerable & Outdated Components 易受攻擊的元件', severity:'Medium', cwe:['CWE-1104'], prevalence:'新增', description:'如果您不知道您使用的所有元件的版本（客戶端和服務器端），這個問題就是您的問題。此外，如果軟體易受攻擊、不受支持或已過時，就會面臨風險。', examples:['不了解所有使用元件的版本','未及時更新作業系統、Web/應用程式伺服器、資料庫','不定期掃描已知漏洞'], mitigations:['刪除不使用的依賴項、功能、元件和文件','持續盤點客戶端和服務器端元件的版本','從官方來源訂閱安全公告','僅通過官方渠道獲取元件'], status:'處理中' },
        { id:'A07', rank:'A07', name:'Auth & Identity Failures 識別與驗證失敗', severity:'Medium', cwe:['CWE-297','CWE-287','CWE-384'], prevalence:'通用', description:'確認用戶身份、驗證和會話管理對於防止與驗證相關的攻擊至關重要。如果應用程式允許暴力破解或其他自動化攻擊，就可能存在驗證弱點。', examples:['允許憑證填充攻擊','允許暴力破解','允許弱密碼','使用 URL 或 Cookie 中的明文會話 ID'], mitigations:['在可能的地方實施多因素驗證','不使用預設憑證','實施密碼強度檢查','限制失敗登錄嘗試次數','使用服務器側安全隨機的會話管理器'], status:'已緩解' },
        { id:'A08', rank:'A08', name:'Software & Data Integrity Failures 軟體和資料完整性失敗', severity:'High', cwe:['CWE-829','CWE-494','CWE-502'], prevalence:'新增', description:'軟體和資料完整性失敗與無法防止完整性違規的程式碼和基礎架構有關。這涵蓋了應用程式依賴來自不受信任來源的插件、庫或模塊的情況。', examples:['使用未簽名或未加密序列化','CI/CD 管道安全性不足','不安全的反序列化','自動更新未驗證完整性'], mitigations:['使用數字簽名驗證軟體或資料','確保函式庫來自受信任倉庫','審查 CI/CD 管道配置變更','確保未序列化資料沒有來自不受信任的客戶端'], status:'待處理' },
        { id:'A09', rank:'A09', name:'Security Logging Failures 安全日誌失敗', severity:'Medium', cwe:['CWE-778','CWE-117','CWE-223'], prevalence:'通用', description:'沒有日誌記錄和監控，無法檢測到入侵。日誌和監控不足加上事件響應缺失或無效，使攻擊者能夠進一步攻擊系統、維持持久性並轉向更多系統。', examples:['可稽核事件未被記錄','警告和錯誤沒有生成日誌','日誌沒有監控可疑活動','日誌僅存儲在本地','有效的警報閾值和響應升級過程缺失'], mitigations:['確保所有登錄、存取控制失敗和服務器側輸入驗證失敗都可以被記錄','確保日誌格式可以被集中日誌管理解決方案使用','確保建立了適當的監控和告警'], status:'處理中' },
        { id:'A10', rank:'A10', name:'SSRF 服務器端請求偽造', severity:'Medium', cwe:['CWE-918'], prevalence:'新增', description:'SSRF 漏洞在現代 Web 應用程式獲取遠端資源時出現。它允許攻擊者誘使應用程式將精心製作的請求發送到意外的目標，即使受防火牆、VPN 或其他網路訪問控制列表保護。', examples:['雲端環境中存取內部元資料服務','強制請求到 169.254.169.254 等特殊位址','掃描內部服務和連接埠'], mitigations:['從允許清單驗證和清理所有客戶端提供的輸入資料','強制 URL 架構、連接埠和目標使用允許清單','不要向客戶端發送原始回應','禁用 HTTP 重定向'], status:'待處理' },
      ]
    },
    'api-2023': {
      title: 'OWASP API Security Top 10 (2023)',
      risks: [
        { id:'API1', rank:'API1:2023', name:'Broken Object Level Authorization 物件層級授權失效', severity:'Critical', cwe:['CWE-639'], prevalence:'通用', description:'API 傾向暴露處理物件標識符的端點，這在存取控制方面產生了廣泛的攻擊面。需要在每個存取資料來源的功能中進行物件層級授權檢查。', examples:['攻擊者以合法用戶身份驗證並檢索另一用戶的訂單','修改 GET /api/v1/orders/{orderId} 中的 orderId 存取他人訂單'], mitigations:['實施適當的授權機制','使用用戶策略和層次結構','使用隨機且難以猜測的 ID (UUID)'], status:'處理中' },
        { id:'API2', rank:'API2:2023', name:'Broken Authentication 驗證失效', severity:'Critical', cwe:['CWE-287'], prevalence:'通用', description:'驗證機制通常被錯誤實現，允許攻擊者危及驗證 token 或利用實現缺陷冒充其他用戶的身份。', examples:['JWT 簽名未驗證','密碼重置令牌未過期','沒有速率限制的登錄'], mitigations:['確保已知所有可能的 API 身份驗證流程','閱讀驗證機制文件並理解和評估使用場景'], status:'已緩解' },
        { id:'API3', rank:'API3:2023', name:'Broken Object Property Level Authorization 屬性層級授權失效', severity:'High', cwe:['CWE-213','CWE-915'], prevalence:'通用', description:'此類別結合了 API3:2019 過度資料暴露和 API6:2019 大量分配，側重於根本原因：缺乏或不適當的物件屬性層級授權驗證。', examples:['API 傳回超出需求的屬性','PATCH 請求接受不應修改的屬性'], mitigations:['基於呼叫者需求的 API 回應塑形','僅回傳最小需要的資料欄位'], status:'待處理' },
        { id:'API4', rank:'API4:2023', name:'Unrestricted Resource Consumption 無限制資源消耗', severity:'High', cwe:['CWE-770','CWE-400'], prevalence:'通用', description:'滿足 API 請求需要頻寬、CPU、記憶體和儲存等資源。其他資源，如電子郵件/簡訊/電話或生物識別驗證，通過 API 集成由服務提供商提供，並按請求付費。', examples:['不限制文件上傳大小','沒有速率限制','缺乏每個用戶的資源限額'], mitigations:['定義所有服務的正確資源限制','限制最大上傳大小','使用速率限制','基於 API 用戶的執行逾時限制'], status:'處理中' },
        { id:'API5', rank:'API5:2023', name:'Broken Function Level Authorization 功能層級授權失效', severity:'High', cwe:['CWE-285'], prevalence:'通用', description:'複雜的存取控制策略（包含不同的層次結構、組和角色）以及管理和普通功能之間不清晰的分離往往導致授權缺陷。', examples:['普通用戶可以存取管理 API 端點','非管理員用戶可以執行刪除操作'], mitigations:['預設拒絕所有存取','只允許特定角色存取管理功能','確保後端 API 路由需要正確的功能和授權'], status:'待處理' },
        { id:'API6', rank:'API6:2023', name:'Unrestricted Access to Sensitive Business Flows 業務流程存取不當', severity:'Medium', cwe:['CWE-284'], prevalence:'新增', description:'易受攻擊的 API 暴露業務流程，如果過度使用可能會損害業務。API 提供底層實施，讓攻擊者可以完全理解業務流程並識別弱點。', examples:['機器人程序的大量購票','自動化刷量評論'], mitigations:['識別可能傷害業務的流程','實施彈性機制（CAPTCHA、裝置指紋）'], status:'風險接受' },
        { id:'API7', rank:'API7:2023', name:'Server Side Request Forgery 服務器端請求偽造', severity:'Medium', cwe:['CWE-918'], prevalence:'新增', description:'當 API 在未驗證使用者提供的 URI 的情況下獲取遠端資源時，就會出現 SSRF 缺陷。這使攻擊者能夠強制應用程式向意外目的地傳送請求。', examples:['API 接受 URL 參數並獲取該 URL 的內容'], mitigations:['隔離獲取遠端資源的機制','使用允許清單限制目標'], status:'處理中' },
        { id:'API8', rank:'API8:2023', name:'Security Misconfiguration 安全設定失誤', severity:'High', cwe:['CWE-2','CWE-16'], prevalence:'通用', description:'API 和支援它們的系統通常包含複雜的配置，旨在使 API 更加可定制。如果設定不當可能危及安全。', examples:['不必要的 HTTP 方法啟用','CORS 政策過於寬鬆','缺少安全 HTTP 標頭'], mitigations:['自動化環境設定稽核','安全強化標準基準'], status:'處理中' },
        { id:'API9', rank:'API9:2023', name:'Improper Inventory Management 不當清單管理', severity:'Medium', cwe:['CWE-1059'], prevalence:'通用', description:'API 往往比傳統 Web 應用程式暴露更多端點，使適當的文件和記錄更加重要。適當的目錄和遺失的廢棄 API 端點對於識別和保護也很重要。', examples:['舊版 API 仍對外開放','文件未更新','缺少 API 目錄'], mitigations:['清點所有 API 主機','為每個環境生成文件','停用不再使用的 API 版本'], status:'待處理' },
        { id:'API10', rank:'API10:2023', name:'Unsafe API Consumption 不安全的 API 使用', severity:'Medium', cwe:['CWE-285','CWE-918'], prevalence:'新增', description:'開發人員傾向於信任從第三方 API 接收的資料。這對於知名提供商來說尤其如此。因此，開發人員通常採用較弱的安全標準，例如在輸入驗證和輸出編碼方面。', examples:['不驗證第三方 API 回應','信任第三方提供者的傳輸安全'], mitigations:['評估第三方 API 的安全控制','驗證所有從第三方 API 收到的資料'], status:'待處理' },
      ]
    },
    'asvs': {
      title: 'OWASP ASVS 4.0',
      levels: ['L1', 'L2', 'L3'],
      chapters: [
        { id:'V1', name:'Architecture, Design & Threat Modeling 架構、設計與威脅建模', l1:70, l2:55, l3:30, requirements:['1.1 安全軟體開發生命週期需求','1.2 驗證架構需求','1.3 會話管理架構需求','1.4 存取控制架構需求','1.5 輸入輸出架構需求'] },
        { id:'V2', name:'Authentication 驗證', l1:85, l2:72, l3:45, requirements:['2.1 密碼安全需求','2.2 一般身份驗證需求','2.3 驗證器生命週期需求','2.4 憑證儲存需求','2.5 憑證恢復需求','2.6 查閱密鑰驗證器需求'] },
        { id:'V3', name:'Session Management 會話管理', l1:80, l2:65, l3:40, requirements:['3.1 基本會話管理安全需求','3.2 會話繫結需求','3.3 會話登出和逾時需求','3.4 基於 Cookie 的會話管理需求','3.5 基於 Token 的會話管理需求'] },
        { id:'V4', name:'Access Control 存取控制', l1:75, l2:60, l3:35, requirements:['4.1 一般存取控制設計','4.2 操作層級存取控制','4.3 其他存取控制注意事項'] },
        { id:'V5', name:'Validation & Encoding 驗證、清理和編碼', l1:78, l2:62, l3:38, requirements:['5.1 輸入驗證需求','5.2 清理和沙盒需求','5.3 輸出編碼和注入防範需求','5.4 記憶體、字串和非受管代碼需求','5.5 反序列化防範需求'] },
        { id:'V6', name:'Stored Cryptography 密碼學', l1:60, l2:48, l3:25, requirements:['6.1 資料分類需求','6.2 演算法需求','6.3 隨機值需求','6.4 密鑰管理需求'] },
        { id:'V7', name:'Error Handling & Logging 錯誤處理與日誌記錄', l1:72, l2:58, l3:32, requirements:['7.1 日誌內容需求','7.2 日誌處理需求','7.3 日誌保護需求','7.4 錯誤處理需求'] },
        { id:'V8', name:'Data Protection 資料保護', l1:68, l2:52, l3:28, requirements:['8.1 一般資料保護','8.2 客戶端資料保護','8.3 敏感個人資料'] },
        { id:'V9', name:'Communications 通訊', l1:82, l2:70, l3:45, requirements:['9.1 客戶端通訊安全需求','9.2 服務器通訊安全需求'] },
        { id:'V13', name:'API & Web Service 介面和網路服務安全', l1:74, l2:58, l3:30, requirements:['13.1 通用網路服務安全需求','13.2 RESTful 網路服務需求','13.3 SOAP 網路服務需求','13.4 GraphQL 需求'] },
      ]
    }
  };

  // ─── Dashboard Stats ────────────────────────────────────────────────────────
  function getDashboardStats() {
    const latestScan = SCAN_LIBRARY['scan-2025q1'];
    const prevScan   = SCAN_LIBRARY['scan-2024q4'];
    const vulns      = latestScan.vulns;
    const isoRecords = _loadISO();
    const pending    = (isoRecords.ncr || []).filter(r => r.status !== '已關閉').length
                     + (isoRecords.capa || []).filter(r => r.status !== '已完成').length;

    const bySev = { Critical:0, High:0, Medium:0, Low:0, Info:0 };
    vulns.forEach(v => { bySev[v.risk] = (bySev[v.risk]||0)+1; });

    const prevBySev = { Critical:0, High:0, Medium:0, Low:0, Info:0 };
    prevScan.vulns.forEach(v => { prevBySev[v.risk] = (prevBySev[v.risk]||0)+1; });

    const nistAvg = Math.round(NIST_CSF_DATA.functions.reduce((s,f) => s+f.score,0) / NIST_CSF_DATA.functions.length);
    const owaspMitigated = OWASP_DATA['web-2021'].risks.filter(r => r.status === '已緩解').length;

    return {
      totalVulns: vulns.length,
      prevVulns: prevScan.vulns.length,
      severityCounts: bySev,
      prevSeverityCounts: prevBySev,
      isoPending: pending,
      nistCompliance: nistAvg,
      owaspMitigated,
      owaspTotal: OWASP_DATA['web-2021'].risks.length,
      recentActivity: [
        { date:'2025-03-10', type:'scan',    text:'完成 Q1 2025 全站弱點掃描，發現 3 個新弱點' },
        { date:'2025-02-20', type:'iso',     text:'NCR-2024-003 備份加密措施已完成矯正' },
        { date:'2025-02-15', type:'nist',    text:'NIST CSF 評估完成，整體合規率 64%' },
        { date:'2025-01-28', type:'owasp',   text:'A03 注入風險已完成緩解措施' },
        { date:'2025-01-15', type:'iso',     text:'CAPA-2024-002 密碼政策強制執行中' },
        { date:'2024-12-20', type:'scan',    text:'完成 Q4 2024 全站弱點掃描，修復 5 個重大弱點' },
        { date:'2024-11-12', type:'iso',     text:'通過 ISO 27001:2022 外部稽核認證' },
      ],
      trendData: {
        labels: ['2024 Q1','2024 Q2','2024 Q3','2024 Q4','2025 Q1'],
        critical: [4,3,4,2,3],
        high: [6,5,5,5,3],
        medium: [8,9,8,7,7],
        low: [4,3,3,3,3],
        nist: [52,55,58,61,64],
      }
    };
  }

  // ─── localStorage helpers ───────────────────────────────────────────────────
  function _loadISO() {
    try {
      const raw = localStorage.getItem('secvision_iso');
      return raw ? JSON.parse(raw) : DEFAULT_ISO;
    } catch { return DEFAULT_ISO; }
  }
  function _saveISO(data) {
    localStorage.setItem('secvision_iso', JSON.stringify(data));
  }
  function _loadOWASP() {
    try {
      const raw = localStorage.getItem('secvision_owasp');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function _saveOWASP(data) {
    localStorage.setItem('secvision_owasp', JSON.stringify(data));
  }

  // init localStorage on first load
  if (!localStorage.getItem('secvision_iso')) _saveISO(DEFAULT_ISO);

  // merge saved OWASP statuses
  const _owaspSaved = _loadOWASP() || {};
  Object.keys(OWASP_DATA).forEach(ver => {
    const risks = OWASP_DATA[ver].risks;
    if (!risks) return;
    risks.forEach(r => {
      const key = ver + '|' + r.id;
      if (_owaspSaved[key]) r.status = _owaspSaved[key];
    });
  });

  // ─── EPSS / VPR enrichment ──────────────────────────────────────────────────
  // Realistic scores per plugin_id; fallback by risk level
  const EPSS_VPR_MAP = {
    '57582':  { epss:0.974, vpr:9.9 },  // Heartbleed
    '97833':  { epss:0.975, vpr:9.8 },  // EternalBlue
    '110723': { epss:0.976, vpr:10.0 }, // Log4Shell
    '160561': { epss:0.520, vpr:9.5 },  // Spring4Shell
    '183429': { epss:0.960, vpr:10.0 }, // PAN-OS CVE-2024-3400
    '185771': { epss:0.921, vpr:9.6 },  // Fortinet CVE-2024-21762
    '189012': { epss:0.878, vpr:9.4 },  // Jenkins CLI
    '190445': { epss:0.850, vpr:9.0 },  // Ivanti
    '187234': { epss:0.710, vpr:8.5 },  // regreSSHion
    '65821':  { epss:0.180, vpr:7.5 },  // MySQL unauth
    '149334': { epss:0.160, vpr:7.2 },  // PostgreSQL priv esc
    '100938': { epss:0.140, vpr:7.5 },  // HTTP/2 Rapid Reset
    '162327': { epss:0.350, vpr:8.0 },  // SambaCry
    '177954': { epss:0.220, vpr:7.8 },  // Cisco ASA
    '125313': { epss:0.190, vpr:6.8 },  // Postfix UAF
    '153543': { epss:0.290, vpr:6.5 },  // Text4Shell
    '181533': { epss:0.120, vpr:6.2 },  // Apache smuggling
    '20007':  { epss:0.052, vpr:5.0 },  // SSLv3
    '10863':  { epss:0.031, vpr:4.3 },  // Weak hash cert
    '133023': { epss:0.038, vpr:4.0 },  // TLS 1.0
    '120453': { epss:0.045, vpr:4.8 },  // OpenSSL cert chain
    '170617': { epss:0.068, vpr:5.2 },  // OpenSSL BN_mod_sqrt
    '99759':  { epss:0.008, vpr:2.6 },  // SSH weak algos
    '141752': { epss:0.003, vpr:2.1 },  // HSTS missing
    '174003': { epss:0.004, vpr:1.8 },  // SSH CBC
  };
  const RISK_EPSS_FALLBACK = { Critical:[0.50,0.97], High:[0.10,0.50], Medium:[0.01,0.15], Low:[0.001,0.05], Info:[0.001,0.01] };
  const RISK_VPR_FALLBACK  = { Critical:[8.0,10.0], High:[6.0,8.0], Medium:[3.0,6.0], Low:[1.0,3.0], Info:[0.1,1.0] };

  function _rng(seed) { // deterministic pseudo-random
    let s = seed; s ^= s<<13; s ^= s>>17; s ^= s<<5; return (s>>>0) / 0xFFFFFFFF;
  }
  function enrichVulns(vulns) {
    return vulns.map(v => {
      if (v.epss !== undefined) return v;
      const m = EPSS_VPR_MAP[v.plugin_id];
      if (m) return { ...v, epss: m.epss, vpr: m.vpr };
      const seed = parseInt(v.plugin_id||'0', 10) + (v.host||'').charCodeAt(0);
      const r = _rng(seed);
      const [eMin,eMax] = RISK_EPSS_FALLBACK[v.risk] || [0.001,0.05];
      const [pMin,pMax] = RISK_VPR_FALLBACK[v.risk]  || [1.0,3.0];
      return { ...v, epss: parseFloat((eMin + r*(eMax-eMin)).toFixed(4)), vpr: parseFloat((pMin + r*(pMax-pMin)).toFixed(1)) };
    });
  }

  // ─── CVE JSON parser (NVD format) ──────────────────────────────────────────
  function parseCVEJson(text) {
    try {
      const data = JSON.parse(text);
      // Support NVD CVE API 2.0 format: { vulnerabilities: [{cve:{...}}] }
      const items = data.vulnerabilities || data.CVE_Items || [];
      return items.map((item, i) => {
        const cve = item.cve || item;
        const cveId = cve.id || cve.CVE_data_meta?.ID || 'CVE-????-????';
        const desc = (cve.descriptions||[]).find(d=>d.lang==='en')?.value
                  || (cve.description?.description_data||[])[0]?.value || '';
        const metrics = cve.metrics || {};
        const cvssV3 = metrics.cvssMetricV31?.[0]?.cvssData || metrics.cvssMetricV30?.[0]?.cvssData || null;
        const cvssV2 = metrics.cvssMetricV2?.[0]?.cvssData || null;
        const cvssScore = cvssV3?.baseScore || cvssV2?.baseScore || null;
        const severity  = cvssV3?.baseSeverity || cvssV2?.baseSeverity || null;
        const riskMap   = { CRITICAL:'Critical', HIGH:'High', MEDIUM:'Medium', LOW:'Low' };
        const risk = riskMap[severity?.toUpperCase()] || 'Medium';
        const pubDate = (cve.published || cve.publishedDate || '').slice(0,10);
        const epss = cve.epss || null;
        return {
          id: 'cve-'+(i+1), plugin_id: cveId, cve: cveId,
          cvss: cvssScore ? String(cvssScore) : '—',
          risk, host:'—', protocol:'—', port:'—',
          name: desc.length>120 ? desc.slice(0,118)+'…' : desc,
          synopsis: desc, description: desc, solution: '',
          plugin_output: `Published: ${pubDate}\nCVSS: ${cvssScore} (${severity||'—'})`,
          epss: epss || null, vpr: null,
        };
      }).filter(r => r.plugin_id !== 'CVE-????-????');
    } catch (e) {
      return null;
    }
  }

  // ─── IP Groups (localStorage) ───────────────────────────────────────────────
  function _loadIPGroups() {
    try { return JSON.parse(localStorage.getItem('secvision_ipgroups')||'{}'); } catch { return {}; }
  }
  function _saveIPGroups(g) { localStorage.setItem('secvision_ipgroups', JSON.stringify(g)); }

  // ─── Public API ─────────────────────────────────────────────────────────────
  return {
    // Scans
    getScans: () => Object.values(SCAN_LIBRARY).map(s => ({
      id: s.id, name: s.name, date: s.date, hostCount: s.hosts.length, vulnCount: s.vulns.length,
      critical: s.vulns.filter(v=>v.risk==='Critical').length,
      high:     s.vulns.filter(v=>v.risk==='High').length,
    })).sort((a,b) => a.date.localeCompare(b.date)),

    getScanDetail: (id) => {
      const s = SCAN_LIBRARY[id] || null;
      if (!s) return null;
      return { ...s, vulns: enrichVulns(s.vulns) };
    },

    getDiff: (id1, id2) => {
      const s1 = SCAN_LIBRARY[id1], s2 = SCAN_LIBRARY[id2];
      if (!s1 || !s2) return null;
      const v1 = enrichVulns(s1.vulns), v2 = enrichVulns(s2.vulns);
      const key = v => `${v.plugin_id}|${v.host}|${v.port}`;
      const map1 = {}, map2 = {};
      v1.forEach(v => map1[key(v)] = v);
      v2.forEach(v => map2[key(v)] = v);
      const allKeys = new Set([...Object.keys(map1), ...Object.keys(map2)]);
      const result = [];
      allKeys.forEach(k => {
        if (map1[k] && map2[k]) result.push({ status:'unchanged', v1:map1[k], v2:map2[k], ...map2[k] });
        else if (map1[k] && !map2[k]) result.push({ status:'resolved', v1:map1[k], v2:null, ...map1[k] });
        else result.push({ status:'new', v1:null, v2:map2[k], ...map2[k] });
      });
      return result.sort((a,b) => {
        const o = {new:0,unchanged:1,resolved:2};
        if (o[a.status] !== o[b.status]) return o[a.status]-o[b.status];
        const sev = {Critical:0,High:1,Medium:2,Low:3,Info:4};
        return (sev[a.risk]||99) - (sev[b.risk]||99);
      });
    },

    getIPHistory: (ip) => {
      return Object.values(SCAN_LIBRARY)
        .sort((a,b) => a.date.localeCompare(b.date))
        .map(scan => ({
          scanId: scan.id, scanName: scan.name, date: scan.date,
          vulns: enrichVulns(scan.vulns.filter(v => v.host === ip))
        }));
    },

    getAllHosts: () => {
      const hosts = new Set();
      Object.values(SCAN_LIBRARY).forEach(s => s.vulns.forEach(v => hosts.add(v.host)));
      return [...hosts].sort();
    },

    // ISO
    getISORecords: (type) => (_loadISO()[type] || []),

    addISORecord: (type, data) => {
      const iso = _loadISO();
      if (!iso[type]) iso[type] = [];
      const rec = { ...data, id: type+'-'+Date.now(), created: new Date().toISOString().slice(0,10), updated: new Date().toISOString().slice(0,10), history: [{ date: new Date().toISOString().slice(0,10), action:'新增記錄', by:'目前使用者' }] };
      iso[type].push(rec);
      _saveISO(iso);
      return rec;
    },

    updateISORecord: (type, id, data) => {
      const iso = _loadISO();
      const idx = (iso[type]||[]).findIndex(r => r.id === id);
      if (idx < 0) return null;
      const old = iso[type][idx];
      iso[type][idx] = { ...old, ...data, id, updated: new Date().toISOString().slice(0,10),
        history: [...(old.history||[]), { date: new Date().toISOString().slice(0,10), action:'更新記錄', by:'目前使用者' }] };
      _saveISO(iso);
      return iso[type][idx];
    },

    deleteISORecord: (type, id) => {
      const iso = _loadISO();
      if (!iso[type]) return;
      iso[type] = iso[type].filter(r => r.id !== id);
      _saveISO(iso);
    },

    // NIST
    getNISTCSF: () => NIST_CSF_DATA,
    getNIST80053: () => NIST_800_53_DATA,

    // OWASP
    getOWASPData: (version) => OWASP_DATA[version] || null,
    updateOWASPStatus: (version, riskId, status) => {
      const saved = _loadOWASP() || {};
      saved[version+'|'+riskId] = status;
      _saveOWASP(saved);
      const risk = (OWASP_DATA[version]?.risks||[]).find(r=>r.id===riskId);
      if (risk) risk.status = status;
    },

    // Dashboard
    getDashboardStats,

    // Utility: parse Nessus CSV
    parseNessusCSV: (text) => {
      const lines = text.trim().split('\n');
      if (lines.length < 2) return [];
      const header = lines[0].split(',').map(h => h.replace(/"/g,'').trim());
      return lines.slice(1).map((line, idx) => {
        const vals = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') { inQ = !inQ; continue; }
          if (c === ',' && !inQ) { vals.push(cur.trim()); cur=''; continue; }
          cur += c;
        }
        vals.push(cur.trim());
        const obj = { id: 'csv-'+(idx+1) };
        header.forEach((h,i) => {
          const map = {
            'Plugin ID':'plugin_id','CVE':'cve','CVSS v2.0 Base Score':'cvss',
            'Risk':'risk','Host':'host','Protocol':'protocol','Port':'port',
            'Name':'name','Synopsis':'synopsis','Description':'description',
            'Solution':'solution','Plugin Output':'plugin_output',
            'EPSS Score':'epss','VPR Score':'vpr',
            'EPSS':'epss','VPR':'vpr',
          };
          const key = map[h] || h.toLowerCase().replace(/\s+/g,'_');
          obj[key] = vals[i] || '';
        });
        if (!obj.risk || obj.risk === 'None') obj.risk = 'Info';
        if (obj.epss) obj.epss = parseFloat(obj.epss) || null;
        if (obj.vpr)  obj.vpr  = parseFloat(obj.vpr)  || null;
        return obj;
      }).filter(r => r.plugin_id)
        .map(v => enrichVulns([v])[0]);
    },

    // Utility: parse NVD CVE JSON
    parseCVEJson,

    // IP Groups
    getIPGroups: () => _loadIPGroups(),
    saveIPGroup: (name, ips) => {
      const g = _loadIPGroups();
      g[name] = ips;
      _saveIPGroups(g);
    },
    deleteIPGroup: (name) => {
      const g = _loadIPGroups();
      delete g[name];
      _saveIPGroups(g);
    },

    enrichVulns,
  };
})();

window.MockAPI = MockAPI;
