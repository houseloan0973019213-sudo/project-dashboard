const { google } = require('googleapis');
const fs = require('fs');

const CREDENTIALS_PATH = './credentials.json';
const SPREADSHEET_ID = '13-HlMIw1k5dWNenrKxrukwp4GjpC0wD3UcpHnKAeoaI';
const SHEET_NAME = '已准待撥(冠穎用)';
const OUTPUT_FILE = './data.js';
const HISTORY_FILE = './history_raw.json';

// 最多保留幾筆歷史紀錄 (一天抓2次的話，保留15天約30筆就夠了)
const MAX_HISTORY = 30;

async function fetchData() {
    try {
        console.log(`[${new Date().toLocaleString()}] 準備抓取最新資料...`);
        
        const auth = new google.auth.GoogleAuth({
            keyFile: CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:Z`,
        });

        const rows = response.data.values;

        if (!rows || rows.length === 0) {
            console.log('找不到資料。');
            return;
        }

        const headers = rows[0];
        const currentData = rows.slice(1).map(row => {
            const rowData = {};
            headers.forEach((header, index) => {
                rowData[header] = row[index] || '';
            });
            return rowData;
        });

        // ==========================================
        // 處理歷史紀錄 (History)
        // ==========================================
        let historyArray = [];
        if (fs.existsSync(HISTORY_FILE)) {
            try {
                historyArray = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
            } catch(e) {
                console.warn('讀取歷史檔失敗，建立全新紀錄。');
            }
        }

        // 把當前這筆「總和」結果抽出來存到歷史 (因為趨勢判定是看全局總和)
        const totalRow = currentData.find(r => r["經辦"] === "總和" || r["經辦"] === "總計");
        if (totalRow) {
            const historyEntry = {
                timestamp: new Date().toISOString(),
                A: parseInt(totalRow["已准待對保件數"] || "0"),
                A_amount: parseInt(totalRow["已准待對保金額"] || "0"),
                B: parseInt(totalRow["已對保待撥件數的SUM"] || "0"),
                B_amount: parseInt(totalRow["已對保待撥金額的SUM"] || "0")
            };
            
            // 推進陣列
            historyArray.push(historyEntry);
            
            // 限制長度
            if (historyArray.length > MAX_HISTORY) {
                historyArray = historyArray.slice(historyArray.length - MAX_HISTORY);
            }
            
            // 存回 JSON 免得遺失
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyArray, null, 2), 'utf-8');
        }

        // ==========================================
        // 輸出成 JS 變數，一次提供 最新資料 + 歷史資料 給前端
        // ==========================================
        const jsContent = `
const dashboardData = ${JSON.stringify(currentData, null, 2)};
const historyData = ${JSON.stringify(historyArray, null, 2)};
`;
        fs.writeFileSync(OUTPUT_FILE, jsContent, 'utf-8');
        console.log(`更新成功！資料筆數: ${currentData.length}, 歷史紀錄數: ${historyArray.length}`);

    } catch (error) {
        console.error('發生錯誤:', error.message);
    }
}

fetchData();
