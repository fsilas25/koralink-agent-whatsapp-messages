/**
 * KoraLink WhatsApp Analytics AI - Frontend
 * Backend: https://huggingface.co/spaces/faithsilas/koralink-agent-whatsapp-messages
 */

// 🎯 API Configuration - Update this to match your HF Spaces URL
const API_BASE_URL = "https://faithsilas-koralink-agent-whatsapp-messages.hf.space";

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const fileName = document.getElementById('fileName');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const dropZone = document.getElementById('dropZone');
    const loading = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const dashboard = document.getElementById('dashboard');

    // File selection handler
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            fileName.textContent = file.name;
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze Chat';
        }
    });

    // Analyze button click
    analyzeBtn.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) return;

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.txt')) {
            showError('Please upload a .txt WhatsApp export file');
            return;
        }

        // Validate file size (max 15MB)
        if (file.size > 15 * 1024 * 1024) {
            showError('File too large. Maximum size is 15MB');
            return;
        }

        // Start analysis
        startAnalysis(file);
    });

    // Drag & Drop support
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            fileName.textContent = files[0].name;
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze Chat';
        }
    }, false);

    // Main analysis function
    async function startAnalysis(file) {
        // UI state
        loading.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        dashboard.classList.add('hidden');
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Processing...';

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE_URL}/analyze`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            renderDashboard(data);
            
            dashboard.classList.remove('hidden');
            // Scroll to results
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

    // Render dashboard with analytics data
    function renderDashboard(data) {
        // Executive Summary
        document.getElementById('execSummary').textContent = 
            data.executive_summary || 'No summary available';

        // Engagement Metrics
        const engagement = data.user_engagement || {};
        document.getElementById('totalMsgs').textContent = 
            (engagement.total_messages || 0).toLocaleString();
        document.getElementById('uniqueUsers').textContent = 
            (engagement.unique_users || 0).toLocaleString();

        // Sentiment Analysis
        const sentiment = data.sentiment_analysis || {};
        const positive = sentiment.positive || 0;
        const negative = sentiment.negative || 0;
        const neutral = sentiment.neutral || 0;

        document.getElementById('posSent').textContent = `${positive}%`;
        document.getElementById('posBar').style.width = `${positive}%`;
        document.getElementById('negSent').textContent = `${negative}%`;
        document.getElementById('negBar').style.width = `${negative}%`;

        // Key Issues
        const issuesList = document.getElementById('issuesList');
        issuesList.innerHTML = '';
        if (data.key_issues && data.key_issues.length > 0) {
            data.key_issues.forEach(issue => {
                const li = document.createElement('li');
                const severityClass = issue.severity?.toLowerCase() || 'medium';
                li.innerHTML = `
                    <span>${issue.issue}</span>
                    <span class="badge ${severityClass}">${issue.count}</span>
                `;
                issuesList.appendChild(li);
            });
        } else {
            issuesList.innerHTML = '<li>No issues identified</li>';
        }

        // Urgent Escalations
        const escList = document.getElementById('escalationsList');
        escList.innerHTML = '';
        if (data.urgent_escalations && data.urgent_escalations.length > 0) {
            data.urgent_escalations.forEach(esc => {
                const li = document.createElement('li');
                li.textContent = esc;
                escList.appendChild(li);
            });
        } else {
            escList.innerHTML = '<li>✅ No urgent escalations</li>';
        }

        // Positive Feedback
        const posList = document.getElementById('positiveList');
        posList.innerHTML = '';
        if (data.positive_feedback && data.positive_feedback.length > 0) {
            data.positive_feedback.slice(0, 5).forEach(fb => {
                const li = document.createElement('li');
                li.textContent = fb;
                posList.appendChild(li);
            });
            if (data.positive_feedback.length > 5) {
                const more = document.createElement('li');
                more.textContent = `+${data.positive_feedback.length - 5} more...`;
                more.style.color = 'var(--text-light)';
                more.style.fontStyle = 'italic';
                posList.appendChild(more);
            }
        } else {
            posList.innerHTML = '<li>No positive feedback recorded</li>';
        }

        // Common Complaints
        const compList = document.getElementById('complaintsList');
        compList.innerHTML = '';
        if (data.most_common_complaints && data.most_common_complaints.length > 0) {
            data.most_common_complaints.slice(0, 5).forEach(comp => {
                const li = document.createElement('li');
                li.textContent = comp;
                compList.appendChild(li);
            });
        } else {
            compList.innerHTML = '<li>No common complaints identified</li>';
        }

        // Supervisor Responsiveness
        const supervisor = data.supervisor_responsiveness || {};
        document.getElementById('supResponders').textContent = 
            supervisor.responders?.join(', ') || 'N/A';
        document.getElementById('supQuality').textContent = 
            supervisor.average_response_quality || 'N/A';
        document.getElementById('supUnresolved').textContent = 
            supervisor.unresolved_issues || 0;

        // Weekly Trends
        const trendsBox = document.getElementById('weeklyTrends');
        trendsBox.innerHTML = '';
        if (data.weekly_trends && data.weekly_trends.length > 0) {
            data.weekly_trends.forEach(trend => {
                const div = document.createElement('div');
                div.innerHTML = `<strong>${trend.week}:</strong> ${trend.trend}`;
                trendsBox.appendChild(div);
            });
        } else {
            trendsBox.innerHTML = '<div>No trend data available</div>';
        }

        // Recommended Actions
        const actionsList = document.getElementById('actionsList');
        actionsList.innerHTML = '';
        if (data.recommended_actions && data.recommended_actions.length > 0) {
            data.recommended_actions.forEach(action => {
                const li = document.createElement('li');
                li.textContent = action;
                actionsList.appendChild(li);
            });
        } else {
            actionsList.innerHTML = '<li>No recommendations generated</li>';
        }

        // Activity Chart
        renderActivityChart(engagement.activity_by_date || {});

        // Keyword Cloud (from backend keyword tracking)
        renderKeywordCloud(data.keyword_counts || {});
    }

    // Render activity bar chart
    function renderActivityChart(activityData) {
        const chartContainer = document.getElementById('activityChart');
        chartContainer.innerHTML = '';
        
        const entries = Object.entries(activityData);
        if (entries.length === 0) {
            chartContainer.innerHTML = '<p style="color:var(--text-light)">No activity data available</p>';
            return;
        }

        // Sort by date and take top 7
        const sorted = entries.sort((a, b) => new Date(b[0]) - new Date(a[0])).slice(0, 7).reverse();
        const maxVal = Math.max(...sorted.map(([_, val]) => val));

        sorted.forEach(([date, count]) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'chart-bar-wrapper';
            
            const height = maxVal > 0 ? (count / maxVal) * 140 : 0;
            const shortDate = date.split('/').slice(0, 2).join('/');
            
            wrapper.innerHTML = `
                <div class="chart-bar" style="height: ${Math.max(height, 4)}px" title="${count} messages"></div>
                <span class="chart-label">${shortDate}</span>
            `;
            chartContainer.appendChild(wrapper);
        });
    }

    // Render keyword frequency cloud
    function renderKeywordCloud(keywordCounts) {
        const cloud = document.getElementById('keywordCloud');
        cloud.innerHTML = '';
        
        const entries = Object.entries(keywordCounts);
        if (entries.length === 0) {
            cloud.innerHTML = '<p style="color:var(--text-light)">No keywords tracked</p>';
            return;
        }

        // Sort by frequency and show top 15
        entries.sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([keyword, count]) => {
            const tag = document.createElement('span');
            tag.className = 'keyword-tag';
            tag.innerHTML = `
                ${keyword}
                <span class="count">${count}</span>
            `;
            cloud.appendChild(tag);
        });
    }

    // Show error message
    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        loading.classList.add('hidden');
        dashboard.classList.add('hidden');
    }

    // Health check on load (optional)
    async function checkBackendHealth() {
        try {
            const response = await fetch(`${API_BASE_URL}/health`);
            if (response.ok) {
                const health = await response.json();
                console.log('✅ Backend healthy:', health);
            }
        } catch (err) {
            console.warn('⚠️ Could not reach backend:', err.message);
            // Don't block UI, just warn
        }
    }
    
    // Run health check
    checkBackendHealth();
});
