// === 初始化區塊 ===
function initDashboard() {
    renderDashboard();

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.innerHTML = '🔄 讀取中...';
            refreshBtn.style.opacity = '0.7';
            setTimeout(() => {
                location.reload(); // 直接重新載入頁面最乾淨
            }, 500);
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}

// === 主渲染邏輯 ===
function renderDashboard() {
    try {
        if (typeof dashboardData === 'undefined') {
            throw new Error('找不到 dashboardData，請確認是否已執行 update.bat');
        }
        
        const data = dashboardData;
        const history = typeof historyData !== 'undefined' ? historyData : [];
        if (data.length === 0) return;

        // 把 "總和" 拉出來做為頂部 KPI
        const totalRow = data.find(r => r["經辦"] === "總和" || r["經辦"] === "總計");
        const details = data.filter(r => r["經辦"] !== "總和" && r["經辦"] !== "總計");

        if (totalRow) {
            renderSummaryCards(totalRow);
            analyzeHealthAndRender(totalRow, history);
        }
        renderTable(details, totalRow);
        updateTimestamp();

    } catch (error) {
        console.error('渲染失敗:', error);
        document.getElementById('lastUpdated').innerText = '載入失敗 (資料異常)';
        document.getElementById('lastUpdated').style.color = '#ef4444';
    }
}

// === 管線健康度分析邏輯 ===
function analyzeHealthAndRender(currentTotal, historyArray) {
    const banner = document.getElementById('healthBanner');
    const iconEl = document.getElementById('healthIcon');
    const titleEl = document.getElementById('healthTitle');
    const descEl = document.getElementById('healthDesc');
    const trendAEl = document.getElementById('trendA');
    const trendBEl = document.getElementById('trendB');

    // 當前數值
    const currentA = parseInt(currentTotal["已准待對保件數"] || "0");
    const currentB = parseInt(currentTotal["已對保待撥件數的SUM"] || "0");

    let deltaA = 0;
    let deltaB = 0;
    let comparisonTimeStr = "缺乏過去資料";

    // 尋找對比基準點 (尋找距離現在大約 2~12 小時前的紀錄，越接近 3 小時越好)
    if (historyArray && historyArray.length > 1) {
        const now = new Date();
        let targetEntry = null;
        let smallestDiff = Infinity;
        
        // 倒序尋找歷史
        for(let i=historyArray.length-2; i>=0; i--) {
            const entry = historyArray[i];
            const entryTime = new Date(entry.timestamp);
            const diffHours = (now - entryTime) / (1000 * 60 * 60);
            
            // 只要大於 1 小時就接受，特別記錄最接近 3 小時的
            if (diffHours >= 1) {
                const distTo3 = Math.abs(diffHours - 3);
                if (distTo3 < smallestDiff) {
                    smallestDiff = distTo3;
                    targetEntry = entry;
                }
            }
        }

        if (targetEntry) {
            deltaA = currentA - targetEntry.A;
            deltaB = currentB - targetEntry.B;
            
            const hoursAgo = Math.round((now - new Date(targetEntry.timestamp)) / (1000 * 60 * 60));
            comparisonTimeStr = `與約 ${hoursAgo} 小時前相比`;
        }
    }

    // 更新增減 UI
    const formatTrend = (v) => v > 0 ? `<span style="color:#f43f5e">▲ +${v}</span>` : (v < 0 ? `<span style="color:#34d399">▼ ${v}</span>` : `<span style="color:#94a3b8">- 0</span>`);
    trendAEl.innerHTML = formatTrend(deltaA);
    trendBEl.innerHTML = formatTrend(deltaB);

    // === 核心業務邏輯判定 (紅/黃/綠) ===
    let status = 'healthy'; // healthy, warning, danger
    let title = '對保與撥款產能平衡：綠燈';
    let desc = `${comparisonTimeStr}，目前案源穩定或業務消化動能強勁。`;

    if (currentA > 40 || (currentA > 30 && deltaA > 5)) {
        // 塞車警告：待對保過多，或短期內暴增
        status = 'warning';
        title = '案件堆積警示：黃燈 (對保塞車)';
        desc = `${comparisonTimeStr}，前線核准件激增，但對保速度跟不上，案件開始堆積在「待對保」階段！`;
    } else if (currentA < 30 && currentB < 25) {
        if (deltaB <= 0) {
            // 動能衰退：源頭少 + 漏斗尾端也少 + 沒有消化進度
            status = 'danger';
            title = '撥款動能衰退警報：紅燈';
            desc = `${comparisonTimeStr}，前端進件/核准不足，且業務手上待撥款案件過少。請注意未來撥款金額將出現斷層！`;
        } else {
            // 稍見起色：雖然源頭少，但 B 還在增加 (正在清舊案)
            status = 'warning';
            title = '案源偏緊：黃燈 (積極消化中)';
            desc = `${comparisonTimeStr}，雖「待對保」案源低於 30，但業務正積極推進後續案件 (待撥款 +${deltaB})。`;
        }
    } else if (currentA < 30 && currentB >= 25) {
         status = 'healthy';
         title = '業務消化極快：綠燈';
         desc = `${comparisonTimeStr}，雖然待對保案源低於 30，但業務已將多數案件推進至對保後階段 (待撥款充足)。`;
    }

    // 渲染樣式
    banner.className = `glass-panel health-banner status-${status}`;
    titleEl.innerText = title;
    descEl.innerText = desc;
    
    if (status === 'healthy') iconEl.innerText = '🟢';
    if (status === 'warning') iconEl.innerText = '🟡';
    if (status === 'danger') iconEl.innerText = '🔴';
}

// === 渲染頂部摘要卡片 ===
function renderSummaryCards(totalRow) {
    const summaryContainer = document.getElementById('globalSummary');
    summaryContainer.innerHTML = '';

    const cards = [
        { title: "已進件待核准", count: totalRow["已進件待核准"] || "0", amount: totalRow["已進件待核准金額"] || "0", type: "review" },
        { title: "已准待對保", count: totalRow["已准待對保件數"] || "0", amount: totalRow["已准待對保金額"] || "0", type: "approve" },
        { title: "已對保待撥", count: totalRow["已對保待撥件數的SUM"] || "0", amount: totalRow["已對保待撥金額的SUM"] || "0", type: "ready" },
        { title: "已准待撥 (總存量)", count: totalRow["已准待撥件數"] || "0", amount: totalRow["已准待撥"] || "0", type: "total" }
    ];

    cards.forEach(c => {
        const cardHTML = `
            <div class="glass-panel stat-card" data-type="${c.type}">
                <div class="stat-title">${c.title}</div>
                <div class="stat-value-group">
                    <span class="kpi-count">${formatNumber(c.count)}</span>
                    <span class="kpi-unit">件</span>
                </div>
                <div class="kpi-amount">$${formatNumber(c.amount)} 萬</div>
            </div>
        `;
        summaryContainer.innerHTML += cardHTML;
    });
}

function renderTable(details, totalRow) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';
    details.forEach(row => tableBody.innerHTML += generateTableRow(row, false));
    if(totalRow) tableBody.innerHTML += generateTableRow(totalRow, true);
}

function generateTableRow(row, isTotal) {
    const cls = isTotal ? 'class="tr-total"' : '';
    const name = row["經辦"] || "未知";
    const tdInReview = formatCell(row["已進件待核准"], row["已進件待核准金額"]);
    const tdApprove = formatCell(row["已准待對保件數"], row["已准待對保金額"]);
    const tdReady = formatCell(row["已對保待撥件數的SUM"], row["已對保待撥金額的SUM"]);
    const tdTotal = formatCell(row["已准待撥件數"], row["已准待撥"]);

    return `
        <tr ${cls}>
            <td>${name}</td>
            <td>${tdInReview}</td>
            <td>${tdApprove}</td>
            <td>${tdReady}</td>
            <td class="highlight-col">${tdTotal}</td>
        </tr>
    `;
}

function formatCell(countStr, amountStr) {
    const count = parseInt(countStr) || 0;
    const amount = parseInt(amountStr) || 0;
    if (count === 0 && amount === 0) {
        return `<div class="val-group" style="opacity:0.3"><span class="val-count">-</span><span class="val-amount"></span></div>`;
    }
    return `<div class="val-group"><span class="val-count">${count} <small style="font-size:0.7em;color:#94a3b8">件</small></span><span class="val-amount">$${formatNumber(amount)} <small style="font-size:0.7em">萬</small></span></div>`;
}

function formatNumber(numStr) {
    const num = Number(String(numStr).replace(/,/g, ''));
    if (isNaN(num)) return "0";
    return num.toLocaleString('en-US');
}

function updateTimestamp() {
    const now = new Date();
    document.getElementById('lastUpdated').innerText = `目前預覽時間: ${now.toLocaleTimeString('zh-TW', { hour12: false })}`;
    document.getElementById('lastUpdated').style.color = '#94a3b8';
}
