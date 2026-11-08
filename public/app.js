document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const taskInput = document.getElementById("task-input");
  const budgetInput = document.getElementById("budget-input");
  const capInput = document.getElementById("cap-input");
  const btnDiscover = document.getElementById("btn-discover");
  const btnRunAgent = document.getElementById("btn-run-agent");
  const btnPresetDemoA = document.getElementById("btn-preset-demo-a");
  const btnPresetDemoB = document.getElementById("btn-preset-demo-b");

  const statTotalBudget = document.getElementById("stat-total-budget");
  const statTotalBudgetAtomic = document.getElementById("stat-total-budget-atomic");
  const statTotalSpent = document.getElementById("stat-total-spent");
  const statTotalSpentAtomic = document.getElementById("stat-total-spent-atomic");
  const statRemainingBudget = document.getElementById("stat-remaining-budget");
  const statRemainingBudgetAtomic = document.getElementById("stat-remaining-budget-atomic");

  const discoveryBadge = document.getElementById("discovery-badge");
  const supplierList = document.getElementById("supplier-list");
  const executionSection = document.getElementById("execution-section");
  const decisionsStream = document.getElementById("decisions-stream");
  const runStatusBadge = document.getElementById("run-status-badge");
  const resultSection = document.getElementById("result-section");
  const resultSummary = document.getElementById("result-summary");
  const freeInsightsList = document.getElementById("free-insights-list");
  const paidInsightsList = document.getElementById("paid-insights-list");
  const resultSynthesisText = document.getElementById("result-synthesis-text");
  const ledgerTbody = document.getElementById("ledger-tbody");
  const ledgerCountBadge = document.getElementById("ledger-count-badge");

  // Presets
  btnPresetDemoA.addEventListener("click", () => {
    btnPresetDemoA.classList.add("active");
    btnPresetDemoB.classList.remove("active");
    taskInput.value = "Research Pharos Atlantic Testnet throughput, validator distribution, and systemic stability using live paid resources.";
    budgetInput.value = "0.010";
    capInput.value = "0.006";
    updateStatsHeader("0.010", "0.000", "0.010");
  });

  btnPresetDemoB.addEventListener("click", () => {
    btnPresetDemoB.classList.add("active");
    btnPresetDemoA.classList.remove("active");
    taskInput.value = "Inspect live premium intelligence with restrictive budget safeguards.";
    budgetInput.value = "0.003";
    capInput.value = "0.002"; // Below the $0.005 premium price -> will trigger honest budget refusal!
    updateStatsHeader("0.003", "0.000", "0.003");
  });

  function updateStatsHeader(budgetUsd, spentUsd, remainingUsd) {
    const parseAtomic = (usd) => Math.round(parseFloat(usd || "0") * 1000000);
    statTotalBudget.textContent = `$${parseFloat(budgetUsd).toFixed(3)} USDC`;
    statTotalBudgetAtomic.textContent = `${parseAtomic(budgetUsd).toLocaleString()} atomic units`;
    statTotalSpent.textContent = `$${parseFloat(spentUsd).toFixed(3)} USDC`;
    statTotalSpentAtomic.textContent = `${parseAtomic(spentUsd).toLocaleString()} atomic units`;
    statRemainingBudget.textContent = `$${parseFloat(remainingUsd).toFixed(3)} USDC`;
    statRemainingBudgetAtomic.textContent = `${parseAtomic(remainingUsd).toLocaleString()} atomic units`;
  }

  // 1. Dynamic Supplier Discovery
  btnDiscover.addEventListener("click", async () => {
    btnDiscover.disabled = true;
    btnDiscover.textContent = "Probing Endpoints...";
    discoveryBadge.textContent = "Probing (HTTP 402)...";
    supplierList.innerHTML = `<p class="placeholder-text">Connecting to candidate endpoints on Pharos Atlantic Testnet...</p>`;

    try {
      const res = await fetch("/api/discovery");
      const data = await res.json();

      if (!data.success || !data.endpoints) {
        throw new Error(data.error || "Failed to discover endpoints");
      }

      discoveryBadge.textContent = `${data.count} Verified Live`;
      discoveryBadge.className = "badge live-badge";

      supplierList.innerHTML = "";
      data.endpoints.forEach((ep) => {
        const item = document.createElement("div");
        item.className = "supplier-item";
        item.innerHTML = `
          <div class="supplier-item-header">
            <span class="supplier-item-title">${escapeHtml(ep.supplierName)}</span>
            <span class="supplier-item-price">${escapeHtml(ep.discoveredPriceUsd)}</span>
          </div>
          <div class="supplier-item-url">${escapeHtml(ep.url)}</div>
          <div class="supplier-item-desc">${escapeHtml(ep.description)}</div>
          <div style="margin-top:6px; font-size:11px; color:#64748b; font-family:monospace;">
            Network: ${escapeHtml(ep.discoveredNetwork)} · Scheme: exact · Atomic: ${escapeHtml(ep.discoveredPriceAtomic)} units
          </div>
        `;
        supplierList.appendChild(item);
      });
    } catch (err) {
      discoveryBadge.textContent = "Discovery Error";
      supplierList.innerHTML = `<p class="placeholder-text" style="color:#f43f5e;">Discovery failed: ${escapeHtml(err.message)}</p>`;
    } finally {
      btnDiscover.disabled = false;
      btnDiscover.textContent = "🔍 1. Discover Live Suppliers (402)";
    }
  });

  // 2. Execute Autonomous Task Run
  btnRunAgent.addEventListener("click", async () => {
    btnRunAgent.disabled = true;
    btnRunAgent.textContent = "Executing Purchases...";
    executionSection.style.display = "block";
    resultSection.style.display = "none";
    runStatusBadge.textContent = "Evaluating Decisions...";
    runStatusBadge.className = "badge";
    decisionsStream.innerHTML = `<p class="placeholder-text">Evaluating candidate prices against budget controls and generating safe idempotency keys...</p>`;

    const task = taskInput.value.trim();
    const totalBudgetUsd = budgetInput.value.trim();
    const maxPricePerCallUsd = capInput.value.trim();

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, totalBudgetUsd, maxPricePerCallUsd }),
      });

      const responseData = await res.json();
      if (!responseData.success || !responseData.result) {
        throw new Error(responseData.error || "Agent execution failed");
      }

      const result = responseData.result;

      // Update status stats
      statTotalSpent.textContent = `${result.totalSpentUsd} USDC`;
      statTotalSpentAtomic.textContent = `${parseInt(result.totalSpentAtomic).toLocaleString()} atomic units`;
      statRemainingBudget.textContent = `${result.remainingBudgetUsd} USDC`;
      statRemainingBudgetAtomic.textContent = `${parseInt(result.remainingBudgetAtomic).toLocaleString()} atomic units`;

      // Render decisions
      decisionsStream.innerHTML = "";
      result.ledgerEntries.forEach((entry) => {
        const card = document.createElement("div");
        const isApproved = entry.decision === "APPROVED";
        card.className = `decision-card ${isApproved ? "approved" : "rejected"}`;
        card.innerHTML = `
          <div class="decision-card-header">
            <span>${escapeHtml(entry.supplierName)} (${escapeHtml(entry.priceUsd)})</span>
            <span class="state-badge ${isApproved ? "settled" : "rejected"}">${escapeHtml(entry.state)}</span>
          </div>
          <div class="decision-card-reason">${escapeHtml(entry.decisionReason)}</div>
        `;
        decisionsStream.appendChild(card);
      });

      // Render Ledger Table
      ledgerTbody.innerHTML = "";
      ledgerCountBadge.textContent = `${result.ledgerEntries.length} Transactions`;

      result.ledgerEntries.forEach((entry) => {
        const row = document.createElement("tr");
        const isSettled = entry.state === "SETTLED" || entry.state === "DATA_RETRIEVED";
        const shortTx = entry.txHash ? `${entry.txHash.slice(0, 10)}...${entry.txHash.slice(-8)}` : "—";
        const txCell = entry.explorerUrl
          ? `<a href="${entry.explorerUrl}" target="_blank" rel="noopener noreferrer" class="tx-hash-link">${shortTx} ↗</a>`
          : shortTx;

        row.innerHTML = `
          <td style="font-family:monospace; font-size:11px;">${new Date(entry.timestamp).toLocaleTimeString()}</td>
          <td>
            <strong>${escapeHtml(entry.supplierName)}</strong>
            <div style="font-size:11px; color:#64748b; font-family:monospace;">${escapeHtml(entry.endpointUrl)}</div>
          </td>
          <td style="font-family:monospace;">${escapeHtml(entry.priceUsd)}</td>
          <td><span class="state-badge ${isSettled ? "settled" : "rejected"}">${escapeHtml(entry.state)}</span></td>
          <td>${txCell}</td>
          <td style="font-family:monospace; color:#06b6d4;">$${(parseInt(entry.runningTotalAtomic) / 1000000).toFixed(3)}</td>
          <td style="font-family:monospace;">$${(parseInt(entry.remainingBudgetAtomic) / 1000000).toFixed(3)}</td>
        `;
        ledgerTbody.appendChild(row);
      });

      // Render Final Synthesized Result
      resultSection.style.display = "block";
      runStatusBadge.textContent = result.status;
      runStatusBadge.className = result.status === "COMPLETED" ? "badge success-badge" : "badge";

      resultSummary.textContent = result.summary;
      if (result.status === "BUDGET_STOP") {
        resultSummary.style.background = "rgba(244, 63, 94, 0.1)";
        resultSummary.style.borderColor = "rgba(244, 63, 94, 0.3)";
        resultSummary.style.color = "#f43f5e";
      } else {
        resultSummary.style.background = "rgba(16, 185, 129, 0.08)";
        resultSummary.style.borderColor = "rgba(16, 185, 129, 0.3)";
        resultSummary.style.color = "#10b981";
      }

      freeInsightsList.innerHTML = "";
      result.finalReport.freeDataInsights.forEach((fi) => {
        const li = document.createElement("li");
        li.textContent = fi;
        freeInsightsList.appendChild(li);
      });

      paidInsightsList.innerHTML = "";
      if (result.finalReport.purchasedInsights.length === 0) {
        const li = document.createElement("li");
        li.textContent = "Zero paid resources purchased (all candidate requests halted by budget limit).";
        li.style.color = "#94a3b8";
        paidInsightsList.appendChild(li);
      } else {
        result.finalReport.purchasedInsights.forEach((pi) => {
          const li = document.createElement("li");
          li.textContent = pi;
          paidInsightsList.appendChild(li);
        });
      }

      resultSynthesisText.textContent = result.finalReport.synthesis;
    } catch (err) {
      alert(`Execution error: ${err.message}`);
    } finally {
      btnRunAgent.disabled = false;
      btnRunAgent.textContent = "⚡ 2. Execute Autonomous Purchase Run";
    }
  });

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Auto trigger discovery on load
  btnDiscover.click();
});
