const API_BASE_URL = "https://faithsilas-koralink-agent-whatsapp-messages.hf.space";

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const fileName = document.getElementById('fileName');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const dropZone = document.getElementById('dropZone');
    const startDateEl = document.getElementById('startDate');
    const endDateEl = document.getElementById('endDate');
    const loading = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const dashboard = document.getElementById('dashboard');

    // Set default date range to cover all possible dates in sample
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    startDateEl.valueAsDate = oneYearAgo;
    endDateEl.valueAsDate = now;

    fileInput.addEventListener('change', updateFileStatus);
    analyzeBtn.addEventListener('click', startAnalysis);

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            fileName.textContent = files[0].name;
            analyzeBtn.disabled = false;
        }
    }, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function updateFileStatus() {
        if (fileInput.files.length > 0) {
            fileName.textContent = fileInput.files[0].name;
            analyzeBtn.disabled = false;
        }
    }

    async function startAnalysis() {
        const file = fileInput.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.txt')) {
            showError('Please upload a .txt WhatsApp export file');
            return;
        }

        if (file.size > 15 * 1024 * 1024) {
            showError('File too large. Maximum size is 15MB');
            return;
        }

        const startDate = new Date(startDateEl.value);
        const endDate = new Date(endDateEl.value);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            showError('Please select valid dates');
            return;
        }

        loading.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        dashboard.classList.add('hidden');
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Processing...';

        try {
            const text = await file.text();
            const lines = text.split('\n');
            const filteredLines = [];

            const dateRegex = /^(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})/;
            let currentDateStr = '';

            for (const line of lines) {
                const match = line.match(dateRegex);
                if (match) {
                    currentDateStr = match[1];
                    const msgDate = parseWhatsAppDate(currentDateStr);
                    if (msgDate >= startDate && msgDate <= endDate) {
                        filteredLines.push(line);
                    } else {
                        // Skip this message and any continuation lines
                        currentDateStr = '';
                    }
                } else if (currentDateStr) {
                    // Continuation line of a valid message
                    filteredLines.push(line);
                }
            }

            const filteredBlob = new Blob([filteredLines.join('\n')], { type: 'text/plain' });
            const formData = new FormData();
            formData.append('file', new File([filteredBlob], file.name, { type: 'text/plain' }));

            const response = await fetch(`${API_BASE_URL}/analyze`, {
                method: 'POST',
                body: formData,
                headers: { Accept: 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }

            const data = await response.json();
            renderDashboard(data, startDateEl.value, endDateEl.value);

            dashboard.classList.remove('hidden');
            dashboard.scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            console.error('Analysis error:', err);
            showError(`Analysis failed: ${err.message}`);
        } finally {
            loading.classList.add('hidden');
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze Chat';
        }
    }

    function parseWhatsAppDate(dateStr) {
        const parts = dateStr.split(/[/\-]/).map(Number);
        if (parts.length !== 3) return new Date(NaN);
        let [d, m, y] = parts;
        if (y < 100) y += 2000;
        return new Date(y, m - 1, d);
    }

    function formatDateForDisplay(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function renderDashboard(data, startDate, endDate) {
        const periodText = `${formatDateForDisplay(startDate)} → ${formatDateForDisplay(endDate)}`;
        document.getElementById('analysisPeriod').textContent = periodText;

        // ... (rest of renderDashboard same as before, just add this line at top)
        // Keep all existing rendering logic unchanged
        document.getElementById('execSummary').textContent = data.executive_summary || 'No summary available';

        const engagement = data.user_engagement || {};
        document.getElementById('totalMsgs').textContent = (engagement.total_messages || 0).toLocaleString();
        document.getElementById('uniqueUsers').textContent = (engagement.unique_users || 0).toLocaleString();

        const sentiment = data.sentiment_analysis || {};
        const positive = sentiment.positive || 0;
        const negative = sentiment.negative || 0;
        document.getElementById('posSent').textContent = `${positive}%`;
        document.getElementById('posBar').style.width = `${positive}%`;
        document.getElementById('negSent').textContent = `${negative}%`;
        document.getElementById('negBar').style.width = `${negative}%`;

        const issuesList = document.getElementById('issuesList');
        issuesList.innerHTML = '';
        if (data.key_issues?.length) {
            data.key_issues.forEach(issue => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${issue.issue}</span><span class="badge ${issue.severity}">${issue.count}</span>`;
                issuesList.appendChild(li);
            });
        } else {
            issuesList.innerHTML = '<li>No issues identified</li>';
        }

        const escList = document.getElementById('escalationsList');
        escList.innerHTML = data.urgent_escalations?.length 
            ? data.urgent_escalations.map(e => `<li>${e}</li>`).join('')
            : '<li>✅ No urgent escalations</li>';

        const posList = document.getElementById('positiveList');
        posList.innerHTML = data.positive_feedback?.length
            ? data.positive_feedback.slice(0,5).map(f => `<li>${f}</li>`).join('')
            : '<li>No positive feedback recorded</li>';

        const compList = document.getElementById('complaintsList');
        compList.innerHTML = data.most_common_complaints?.length
            ? data.most_common_complaints.slice(0,5).map(c => `<li>${c}</li>`).join('')
            : '<li>No common complaints identified</li>';

        const supervisor = data.supervisor_responsiveness || {};
        document.getElementById('supResponders').textContent = supervisor.responders?.join(', ') || 'N/A';
        document.getElementById('supQuality').textContent = supervisor.average_response_quality || 'N/A';
        document.getElementById('supUnresolved').textContent = supervisor.unresolved_issues || 0;

        const trendsBox = document.getElementById('weeklyTrends');
        trendsBox.innerHTML = data.weekly_trends?.length
            ? data.weekly_trends.map(t => `<div><strong>${t.week}:</strong> ${t.trend}</div>`).join('')
            : '<div>No trend data available</div>';

        const actionsList = document.getElementById('actionsList');
        actionsList.innerHTML = data.recommended_actions?.length
            ? data.recommended_actions.map(a => `<li>${a}</li>`).join('')
            : '<li>No recommendations generated</li>';

        renderActivityChart(engagement.activity_by_date || {});
        renderKeywordCloud(data.keyword_counts || {});
    }

    function renderActivityChart(activityData) {
        const chartContainer = document.getElementById('activityChart');
        chartContainer.innerHTML = '';
        const entries = Object.entries(activityData);
        if (!entries.length) {
            chartContainer.innerHTML = '<p style="color:var(--text-light)">No activity data</p>';
            return;
        }
        const sorted = entries.sort((a, b) => new Date(b[0]) - new Date(a[0])).slice(0, 7).reverse();
        const maxVal = Math.max(...sorted.map(([_, v]) => v));
        sorted.forEach(([date, count]) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'chart-bar-wrapper';
            const height = maxVal > 0 ? (count / maxVal) * 140 : 0;
            const shortDate = date.split('/').slice(0, 2).join('/');
            wrapper.innerHTML = `<div class="chart-bar" style="height:${Math.max(height,4)}px" title="${count} messages"></div><span class="chart-label">${shortDate}</span>`;
            chartContainer.appendChild(wrapper);
        });
    }

    function renderKeywordCloud(keywordCounts) {
        const cloud = document.getElementById('keywordCloud');
        cloud.innerHTML = '';
        const entries = Object.entries(keywordCounts);
        if (!entries.length) {
            cloud.innerHTML = '<p style="color:var(--text-light)">No keywords tracked</p>';
            return;
        }
        entries.sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([kw, cnt]) => {
            const tag = document.createElement('span');
            tag.className = 'keyword-tag';
            tag.innerHTML = `${kw}<span class="count">${cnt}</span>`;
            cloud.appendChild(tag);
        });
    }

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        loading.classList.add('hidden');
        dashboard.classList.add('hidden');
    }

    async function checkBackendHealth() {
        try {
            const res = await fetch(`${API_BASE_URL}/health`);
            if (res.ok) console.log('✅ Backend healthy');
        } catch (e) {
            console.warn('⚠️ Backend unreachable:', e.message);
        }
    }
    checkBackendHealth();
});
