const captchas = { login:'', signup:'', forgot:'' };
function generateCaptcha(type) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    captchas[type] = code;
    document.getElementById(type + 'CaptchaText').textContent = code;
}
generateCaptcha('login');
generateCaptcha('signup');
generateCaptcha('forgot');

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===== PAGE NAVIGATION =====
function showPage(pageId) {
    document.querySelectorAll('.form-page').forEach(p => p.classList.remove('active'));
    setTimeout(() => document.getElementById(pageId).classList.add('active'), 50);
    document.querySelectorAll('.error-msg').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('input').forEach(i => i.classList.remove('error'));
}

function togglePass(inputId, btn) {
    const input = document.getElementById(inputId);
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.innerHTML = isPass
        ? '<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

// ===== HELPERS =====
function showError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (msg) el.querySelector('span').textContent = msg;
    el.classList.add('show');
}
function clearAllErrors(formId) {
    document.querySelectorAll('#' + formId + ' .error-msg').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('#' + formId + ' input').forEach(i => i.classList.remove('error'));
}
function shakeForm(formId) {
    const form = document.getElementById(formId);
    form.classList.add('shake');
    setTimeout(() => form.classList.remove('shake'), 400);
}
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function showToast(msg) {
    document.getElementById('toastMsg').textContent = msg;
    document.getElementById('toast').classList.add('show');
    setTimeout(() => document.getElementById('toast').classList.remove('show'), 3000);
}
function checkStrength(val) {
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const labels = ['','Weak','Medium','Strong','Very Strong'];
    const classes = ['','weak','medium','strong','very-strong'];
    for (let i = 1; i <= 4; i++) {
        const bar = document.getElementById('str' + i);
        bar.className = 'strength-bar';
        if (i <= score) bar.classList.add(classes[score]);
    }
    document.getElementById('strengthLabel').textContent = val.length > 0 ? labels[score] : '';
}

// ===== AUTH CHECK =====
async function checkAuthStatus() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/me', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            // Support both { admin: {...} } and flat { full_name, email }
            const admin = data.admin || data;
            showDashboard(admin.full_name, admin.email);
            loadDashboardData();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

// ===== SHOW DASHBOARD =====
function showDashboard(fullName, email) {
    document.getElementById('authWrapper').style.display = 'none';
    document.getElementById('dashboardWrapper').classList.add('active');
    document.body.style.alignItems = 'stretch';

    const displayName = fullName || (email ? email.split('@')[0] : 'Admin');
    const parts = displayName.trim().split(' ');
    const initials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();

    document.getElementById('dashName').textContent = displayName;
    document.getElementById('dashAvatar').textContent = initials || displayName.substring(0, 2).toUpperCase();

    if (window.innerWidth <= 768) {
        document.getElementById('menuToggle').style.display = 'flex';
    }
}

// ===== LOAD DASHBOARD DATA =====
async function loadDashboardData() {
    try {
        const oppResponse = await fetch('http://127.0.0.1:5000/api/opportunities', { credentials: 'include' });
        if (oppResponse.ok) {
            const opportunities = await oppResponse.json();
            populateOpportunitiesGrid(opportunities);
        }

        const studentsResponse = await fetch('http://127.0.0.1:5000/api/students', { credentials: 'include' });
        if (studentsResponse.ok) {
            const students = await studentsResponse.json();
            displayStudentsTable(students);
        }

        const verifiersResponse = await fetch('http://127.0.0.1:5000/api/verifiers', { credentials: 'include' });
        if (verifiersResponse.ok) {
            const verifiers = await verifiersResponse.json();
            displayVerifiersTable(verifiers);
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

// ===== POPULATE OPPORTUNITIES GRID =====
function populateOpportunitiesGrid(opportunities) {
    const grid = document.querySelector('.opportunities-grid');
    if (!grid) return;

    // Clear ALL cards including hardcoded ones
    grid.innerHTML = '';

    if (opportunities.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:64px 24px;color:var(--qf-text-light);">
                <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:currentColor;fill:none;stroke-width:1.5;margin:0 auto 16px;display:block;opacity:0.4;">
                    <rect x="2" y="7" width="20" height="15" rx="2"/>
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                    <line x1="12" y1="12" x2="12" y2="16"/>
                    <line x1="10" y1="14" x2="14" y2="14"/>
                </svg>
                <h5 style="font-size:16px;font-weight:600;margin-bottom:8px;">No opportunities yet</h5>
                <p style="font-size:14px;">Click "Add New Opportunity" to create your first one.</p>
            </div>`;
        return;
    }

    opportunities.forEach(opp => {
        const skills = opp.skills ? opp.skills.split(',').map(s => s.trim()).filter(Boolean) : [];

        const card = document.createElement('div');
        card.className = 'opportunity-card';
        card.setAttribute('data-opp-id', opp.id);

        const headerHtml = `
            <div class="opportunity-card-header">
                <h5>${escapeHtml(opp.name)}</h5>
                <div class="opportunity-meta">
                    <span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${escapeHtml(opp.duration)}</span>
                    <span><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${escapeHtml(opp.start_date)}</span>
                </div>
            </div>
            <p class="opportunity-description">${escapeHtml(opp.description)}</p>`;

        const skillsHtml = `
            <div class="opportunity-skills">
                <div class="opportunity-skills-label">Skills You'll Gain</div>
                <div class="skills-tags">
                    ${skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}
                </div>
            </div>`;

        const applicantsCount = opp.max_applicants ? `${opp.max_applicants} applicants` : 'Open enrollment';
        const footerHtml = `
            <div class="opportunity-footer">
                <span class="applicants-count">${escapeHtml(applicantsCount)}</span>
                <button class="view-course-btn" style="width:auto;padding:8px 16px;">View Details</button>
            </div>`;

        card.innerHTML = headerHtml + skillsHtml + footerHtml;

        card.querySelector('.view-course-btn').addEventListener('click', function() {
            openOpportunityDetails(opp.name, {
                id: opp.id,
                duration: opp.duration,
                startDate: opp.start_date,
                description: opp.description,
                skills: skills,
                applicants: opp.max_applicants || 0,
                futureOpportunities: opp.future_opportunities,
                prerequisites: ''
            });
        });

        grid.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', checkAuthStatus);

// ===== LOGOUT =====
async function handleLogout() {
    try {
        await fetch('http://127.0.0.1:5000/api/logout', { method: 'POST', credentials: 'include' });
    } catch (error) {
        console.error('Logout error:', error);
    }
    document.getElementById('dashboardWrapper').classList.remove('active');
    document.getElementById('authWrapper').style.display = 'flex';
    document.body.style.alignItems = '';
    showToast('Signed out successfully');
    showPage('loginPage');
}

// ===== NAV ITEMS =====
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', function() {
        const page = this.getAttribute('data-page');
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
        const map = {
            dashboard:   ['dashboardSection',   'Dashboard'],
            learner:     ['learnerSection',      'Learner Management'],
            verifier:    ['verifierSection',     'Verifier Management'],
            collaborator:['collaboratorSection', 'Collaborator Management'],
            opportunity: ['opportunitySection',  'Opportunity Management'],
            reports:     ['reportsSection',      'Reports and Analytics'],
        };
        if (map[page]) {
            document.getElementById(map[page][0]).classList.add('active');
            document.getElementById('pageTitle').textContent = map[page][1];
        }
    });
});

// ===== TABS =====
function changeChartPeriod(period) {
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase() === period) btn.classList.add('active');
    });
    const chartData = {
        daily:     'M0,120 Q50,110 100,90 T200,70 T300,50 T400,40',
        weekly:    'M0,110 Q50,95 100,85 T200,65 T300,45 T400,35',
        monthly:   'M0,100 Q50,85 100,75 T200,55 T300,40 T400,30',
        quarterly: 'M0,90 Q50,75 100,65 T200,50 T300,35 T400,25',
        yearly:    'M0,80 Q50,65 100,55 T200,40 T300,30 T400,20'
    };
    const path = chartData[period];
    document.getElementById('linePath').setAttribute('d', path);
    document.getElementById('lineArea').setAttribute('d', path + ' L400,150 L0,150 Z');
}

// ===== NOTIFICATIONS =====
function toggleNotifications() {
    document.getElementById('notificationDropdown').classList.toggle('active');
}
function markAllRead() {
    document.querySelectorAll('.notif-item.unread').forEach(item => item.classList.remove('unread'));
    showToast('All notifications marked as read');
}
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('notificationDropdown');
    const btn = document.getElementById('notifBtn');
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

// ===== THEME TOGGLE =====
function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    const icon = document.getElementById('themeIcon');
    if (newTheme === 'dark') {
        icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    } else {
        icon.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
    }
}

// ===== SEARCH =====
function openSearch() {
    document.getElementById('searchContainer').classList.add('active');
    document.getElementById('searchInput').focus();
}
function closeSearch() {
    document.getElementById('searchContainer').classList.remove('active');
}
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeSearch();
        closeCourseModal();
        closeOpportunityModal();
        closeOpportunityDetailsModal();
        closeCollaboratorCoursesModal();
        closeQuickAddModal();
        closeBulkUploadModal();
        closeQuickAddVerifierModal();
        closeBulkUploadVerifierModal();
        closeVerifierDetailsModal();
    }
});
document.getElementById('searchContainer').addEventListener('click', function(e) {
    if (e.target === this) closeSearch();
});

// ===== COURSE MODAL =====
function openCourseDetails(courseName, stats) {
    document.getElementById('modalCourseTitle').textContent = courseName;
    document.getElementById('modalEnrolled').textContent = stats.enrolled;
    document.getElementById('modalCompleted').textContent = stats.completed;
    document.getElementById('modalInProgress').textContent = stats.inProgress;
    document.getElementById('modalHalfDone').textContent = stats.halfDone;
    document.getElementById('courseModal').classList.add('active');
}
function closeCourseModal() {
    document.getElementById('courseModal').classList.remove('active');
}
document.getElementById('courseModal').addEventListener('click', function(e) {
    if (e.target === this) closeCourseModal();
});

// ===== OPPORTUNITY DETAILS MODAL =====
function openOpportunityDetails(title, details) {
    document.getElementById('opportunityDetailTitle').textContent = title;
    document.getElementById('opportunityDetailDuration').textContent = details.duration;
    document.getElementById('opportunityDetailStartDate').textContent = details.startDate;
    document.getElementById('opportunityDetailApplicants').textContent = details.applicants;
    document.getElementById('opportunityDetailDescription').textContent = details.description;
    document.getElementById('opportunityDetailFuture').textContent = details.futureOpportunities;
    document.getElementById('opportunityDetailPrereqs').textContent = details.prerequisites;

    const modal = document.getElementById('opportunityDetailsModal');
    if (details.id) modal.setAttribute('data-opp-id', details.id);

    const skillsContainer = document.getElementById('opportunityDetailSkills');
    skillsContainer.innerHTML = '';
    details.skills.forEach(skill => {
        const tag = document.createElement('span');
        tag.className = 'skill-tag';
        tag.textContent = skill;
        skillsContainer.appendChild(tag);
    });

    modal.classList.add('active');
}
function closeOpportunityDetailsModal() {
    document.getElementById('opportunityDetailsModal').classList.remove('active');
}
async function deleteOpportunityFromModal() {
    const modal = document.getElementById('opportunityDetailsModal');
    const oppId = modal.getAttribute('data-opp-id');
    if (!oppId || !confirm('Are you sure you want to delete this opportunity?')) return;
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/opportunities/${oppId}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (response.ok) {
            showToast('Opportunity deleted successfully');
            closeOpportunityDetailsModal();
            loadDashboardData();
        } else {
            showToast('Failed to delete opportunity');
        }
    } catch (error) {
        showToast('Error deleting opportunity');
    }
}
function applyToOpportunity() {
    showToast('Application submitted successfully!');
    closeOpportunityDetailsModal();
}
document.getElementById('opportunityDetailsModal').addEventListener('click', function(e) {
    if (e.target === this) closeOpportunityDetailsModal();
});

// ===== COLLABORATOR COURSES MODAL =====
function openCollaboratorCourses(name, role) {
    document.getElementById('collaboratorName').textContent = name + "'s Submitted Courses";
    document.getElementById('collaboratorRole').textContent = 'Role: ' + role;
    document.getElementById('collaboratorCoursesModal').classList.add('active');
}
function closeCollaboratorCoursesModal() {
    document.getElementById('collaboratorCoursesModal').classList.remove('active');
}
function approveCourse(courseName) { showToast(courseName + ' has been approved!'); }
function rejectCourse(courseName) { showToast(courseName + ' has been rejected.'); }
function viewCourseDetails(courseName) { showToast('Viewing details for ' + courseName); }
document.getElementById('collaboratorCoursesModal').addEventListener('click', function(e) {
    if (e.target === this) closeCollaboratorCoursesModal();
});

// ===== OPPORTUNITY MODAL (CREATE) =====
function openOpportunityModal() {
    document.getElementById('opportunityModal').classList.add('active');
}
function closeOpportunityModal() {
    document.getElementById('opportunityModal').classList.remove('active');
}
document.getElementById('opportunityModal').addEventListener('click', function(e) {
    if (e.target === this) closeOpportunityModal();
});
document.getElementById('opportunityForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name               = document.getElementById('oppName').value.trim();
    const duration           = document.getElementById('oppDuration').value.trim();
    const startDate          = document.getElementById('oppStartDate').value;
    const description        = document.getElementById('oppDescription').value.trim();
    const skillsRaw          = document.getElementById('oppSkills').value.trim();
    const category           = document.getElementById('oppCategory').value;
    const futureOpportunities= document.getElementById('oppFuture').value.trim();
    const maxApplicants      = document.getElementById('oppMaxApplicants').value.trim();

    if (!name || !duration || !startDate || !description || !skillsRaw || !category || !futureOpportunities) {
        showToast('Please fill all required fields');
        return;
    }
    try {
        const response = await fetch('http://127.0.0.1:5000/api/opportunities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                name, duration,
                start_date: startDate,
                description,
                skills: skillsRaw,
                category,
                future_opportunities: futureOpportunities,
                max_applicants: maxApplicants ? parseInt(maxApplicants) : null
            })
        });
        const data = await response.json();
        if (response.ok) {
            showToast('Opportunity created successfully!');
            closeOpportunityModal();
            this.reset();
            loadDashboardData();
        } else {
            showToast(data.error || 'Failed to create opportunity');
        }
    } catch (error) {
        showToast('Network error. Please try again.');
    }
});

// ===== QUICK ADD STUDENT MODAL =====
function openQuickAddModal() {
    document.getElementById('quickAddModal').classList.add('active');
}
function closeQuickAddModal() {
    document.getElementById('quickAddModal').classList.remove('active');
}
document.getElementById('quickAddModal').addEventListener('click', function(e) {
    if (e.target === this) closeQuickAddModal();
});
document.getElementById('quickAddForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name     = document.getElementById('quickAddName')?.value.trim();
    const email    = document.getElementById('quickAddEmail')?.value.trim().toLowerCase();
    const schoolId = document.getElementById('quickAddSchoolId')?.value.trim();

    if (!name || !email) { showToast('Please fill in all required fields'); return; }
    if (!email.includes('@')) { showToast('Please enter a valid email'); return; }

    try {
        const response = await fetch('http://127.0.0.1:5000/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ full_name: name, email, school_id: schoolId })
        });
        const data = await response.json();
        if (response.ok) {
            showToast('Student added successfully!');
            closeQuickAddModal();
            this.reset();
            loadStudentsList();
        } else {
            showToast(data.error || 'Failed to add student');
        }
    } catch (error) {
        showToast('Network error. Please try again.');
    }
});

// ===== BULK UPLOAD STUDENTS =====
function openBulkUploadModal() {
    document.getElementById('bulkUploadModal').classList.add('active');
}
function closeBulkUploadModal() {
    document.getElementById('bulkUploadModal').classList.remove('active');
}
document.getElementById('bulkUploadModal').addEventListener('click', function(e) {
    if (e.target === this) closeBulkUploadModal();
});
document.getElementById('bulkUploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('csvFileInput');
    if (fileInput.files.length === 0) { showToast('Please select a CSV file'); return; }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async function(event) {
        try {
            const lines = event.target.result.split('\n').filter(l => l.trim());
            if (lines.length < 2) { showToast('CSV must have at least a header and one row'); return; }

            let successCount = 0, failCount = 0;
            for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].split(',').map(p => p.trim());
                const firstName = parts[0], lastName = parts[1], email = parts[2] || '', schoolId = parts[3] || '';
                if (!email || !firstName) continue;
                try {
                    const res = await fetch('http://127.0.0.1:5000/api/students', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ full_name: `${firstName} ${lastName}`.trim(), email, school_id: schoolId })
                    });
                    res.ok ? successCount++ : failCount++;
                } catch { failCount++; }
            }
            showToast(`Bulk upload: ${successCount} added, ${failCount} failed`);
            closeBulkUploadModal();
            this.reset();
            document.getElementById('fileName').textContent = '';
            loadStudentsList();
        } catch (error) {
            showToast('Error processing CSV file');
        }
    };
    reader.readAsText(file);
});
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) document.getElementById('fileName').textContent = '✓ Selected: ' + file.name;
}
function downloadSampleCSV() {
    const csv = 'First Name,Last Name,Email\nJohn,Doe,john.doe@example.com\nJane,Smith,jane.smith@example.com';
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], {type:'text/csv'})), download: 'sample_students.csv' });
    a.click();
}

// ===== QUICK ADD VERIFIER MODAL =====
function openQuickAddVerifierModal() {
    document.getElementById('quickAddVerifierModal').classList.add('active');
}
function closeQuickAddVerifierModal() {
    document.getElementById('quickAddVerifierModal').classList.remove('active');
}
document.getElementById('quickAddVerifierModal').addEventListener('click', function(e) {
    if (e.target === this) closeQuickAddVerifierModal();
});
document.getElementById('quickAddVerifierForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name    = document.getElementById('quickAddVerifierName')?.value.trim();
    const email   = document.getElementById('quickAddVerifierEmail')?.value.trim().toLowerCase();
    const subject = document.getElementById('quickAddVerifierSubject')?.value.trim();

    if (!name || !email) { showToast('Please fill in all required fields'); return; }
    if (!email.includes('@')) { showToast('Please enter a valid email'); return; }

    try {
        const response = await fetch('http://127.0.0.1:5000/api/verifiers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ full_name: name, email, subject })
        });
        const data = await response.json();
        if (response.ok) {
            showToast('Verifier added successfully!');
            closeQuickAddVerifierModal();
            this.reset();
            loadVerifiersList();
        } else {
            showToast(data.error || 'Failed to add verifier');
        }
    } catch (error) {
        showToast('Network error. Please try again.');
    }
});

// ===== BULK UPLOAD VERIFIERS =====
function openBulkUploadVerifierModal() {
    document.getElementById('bulkUploadVerifierModal').classList.add('active');
}
function closeBulkUploadVerifierModal() {
    document.getElementById('bulkUploadVerifierModal').classList.remove('active');
}
document.getElementById('bulkUploadVerifierModal').addEventListener('click', function(e) {
    if (e.target === this) closeBulkUploadVerifierModal();
});
document.getElementById('bulkUploadVerifierForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('csvVerifierFileInput');
    if (fileInput.files.length === 0) { showToast('Please select a CSV file'); return; }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async function(event) {
        try {
            const lines = event.target.result.split('\n').filter(l => l.trim());
            if (lines.length < 2) { showToast('CSV must have at least a header and one row'); return; }

            let successCount = 0, failCount = 0;
            for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].split(',').map(p => p.trim());
                const firstName = parts[0], lastName = parts[1], email = parts[2] || '', subject = parts[3] || '';
                if (!email || !firstName) continue;
                try {
                    const res = await fetch('http://127.0.0.1:5000/api/verifiers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ full_name: `${firstName} ${lastName}`.trim(), email, subject })
                    });
                    res.ok ? successCount++ : failCount++;
                } catch { failCount++; }
            }
            showToast(`Bulk upload: ${successCount} added, ${failCount} failed`);
            closeBulkUploadVerifierModal();
            this.reset();
            document.getElementById('verifierFileName').textContent = '';
            loadVerifiersList();
        } catch (error) {
            showToast('Error processing CSV file');
        }
    };
    reader.readAsText(file);
});
function handleVerifierFileSelect(event) {
    const file = event.target.files[0];
    if (file) document.getElementById('verifierFileName').textContent = '✓ Selected: ' + file.name;
}
function downloadSampleVerifierCSV() {
    const csv = 'First Name,Last Name,Email,Subject\nDr. John,Doe,john.doe@qf.edu.qa,Mathematics\nProf. Jane,Smith,jane.smith@qf.edu.qa,Physics';
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], {type:'text/csv'})), download: 'sample_verifiers.csv' });
    a.click();
}

// ===== VERIFIER DETAILS MODAL =====
function openVerifierDetails(name, stats) {
    document.getElementById('verifierName').textContent = name;
    document.getElementById('verifierTotalStudents').textContent = stats.totalStudents;
    document.getElementById('verifierCertified').textContent = stats.certified;
    document.getElementById('verifierInProgress').textContent = stats.inProgress;
    const container = document.getElementById('subjectsContainer');
    container.innerHTML = '';
    stats.subjects.forEach(subject => {
        const div = document.createElement('div');
        div.className = 'subject-item';
        div.innerHTML = `<span class="subject-name">${subject.name}</span><span class="subject-students">${subject.students} students</span>`;
        container.appendChild(div);
    });
    document.getElementById('verifierDetailsModal').classList.add('active');
}
function closeVerifierDetailsModal() {
    document.getElementById('verifierDetailsModal').classList.remove('active');
}
document.getElementById('verifierDetailsModal').addEventListener('click', function(e) {
    if (e.target === this) closeVerifierDetailsModal();
});

// ===== STUDENT FILTERS =====
function filterStudents() {
    loadStudentsList(
        document.getElementById('statusFilter').value,
        document.getElementById('dateFrom').value,
        document.getElementById('dateTo').value
    );
}
async function loadStudentsList(status = 'all', dateFrom = '', dateTo = '') {
    try {
        let url = 'http://127.0.0.1:5000/api/students?status=' + status;
        if (dateFrom) url += '&date_from=' + dateFrom;
        if (dateTo) url += '&date_to=' + dateTo;
        const response = await fetch(url, { credentials: 'include' });
        if (response.ok) displayStudentsTable(await response.json());
    } catch (error) {
        console.error('Failed to load students:', error);
    }
}
function displayStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--qf-text-light);">No students found</td></tr>';
        return;
    }
    students.forEach(student => {
        const row = document.createElement('tr');
        row.setAttribute('data-status', student.status);
        row.innerHTML = `
            <td>${escapeHtml(student.full_name)}</td>
            <td>${escapeHtml(student.email)}</td>
            <td><span class="status-dot ${student.status}"></span>${student.status}</td>
            <td>${student.school_id ? escapeHtml(student.school_id) : 'N/A'}</td>
            <td>
                <button class="action-btn small" onclick="updateStudentStatus(${student.id}, 'active')">Activate</button>
                <button class="action-btn small danger" onclick="deleteStudent(${student.id})">Remove</button>
            </td>`;
        tbody.appendChild(row);
    });
}
async function updateStudentStatus(studentId, status) {
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/students/${studentId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status })
        });
        if (response.ok) { showToast('Student status updated'); loadStudentsList(); }
        else showToast('Failed to update student status');
    } catch { showToast('Error updating student status'); }
}
async function deleteStudent(studentId) {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/students/${studentId}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (response.ok) { showToast('Student deleted successfully'); loadStudentsList(); }
        else showToast('Failed to delete student');
    } catch { showToast('Error deleting student'); }
}

// ===== VERIFIER FILTERS =====
function filterVerifiers() {
    loadVerifiersList(
        document.getElementById('verifierStatusFilter').value,
        document.getElementById('verifierDateFrom').value,
        document.getElementById('verifierDateTo').value
    );
}
async function loadVerifiersList(status = 'all', dateFrom = '', dateTo = '') {
    try {
        let url = 'http://127.0.0.1:5000/api/verifiers?status=' + status;
        if (dateFrom) url += '&date_from=' + dateFrom;
        if (dateTo) url += '&date_to=' + dateTo;
        const response = await fetch(url, { credentials: 'include' });
        if (response.ok) displayVerifiersTable(await response.json());
    } catch (error) {
        console.error('Failed to load verifiers:', error);
    }
}
function displayVerifiersTable(verifiers) {
    const tbody = document.getElementById('verifiersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (verifiers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--qf-text-light);">No verifiers found</td></tr>';
        return;
    }
    verifiers.forEach(verifier => {
        const row = document.createElement('tr');
        row.setAttribute('data-status', verifier.status);
        row.innerHTML = `
            <td>${escapeHtml(verifier.full_name)}</td>
            <td>${escapeHtml(verifier.email)}</td>
            <td>${verifier.subject ? escapeHtml(verifier.subject) : 'General'}</td>
            <td><span class="status-dot ${verifier.status}"></span>${verifier.status}</td>
            <td>
                <button class="action-btn small" onclick="updateVerifierStatus(${verifier.id}, 'active')">Activate</button>
                <button class="action-btn small danger" onclick="deleteVerifier(${verifier.id})">Remove</button>
            </td>`;
        tbody.appendChild(row);
    });
}
async function updateVerifierStatus(verifierId, status) {
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/verifiers/${verifierId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status })
        });
        if (response.ok) { showToast('Verifier status updated'); loadVerifiersList(); }
        else showToast('Failed to update verifier status');
    } catch { showToast('Error updating verifier status'); }
}
async function deleteVerifier(verifierId) {
    if (!confirm('Are you sure you want to delete this verifier?')) return;
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/verifiers/${verifierId}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (response.ok) { showToast('Verifier deleted successfully'); loadVerifiersList(); }
        else showToast('Failed to delete verifier');
    } catch { showToast('Error deleting verifier'); }
}

// ===== LOGIN =====
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    clearAllErrors('loginForm');
    let valid = true;

    const email      = document.getElementById('loginEmail').value.trim();
    const password   = document.getElementById('loginPassword').value.trim();
    const captchaInput = document.getElementById('loginCaptchaInput').value.trim();
    const rememberMe = document.querySelector('#loginForm input[type="checkbox"]').checked;

    if (!email || !isValidEmail(email)) {
        showError('loginEmailErr'); document.getElementById('loginEmail').classList.add('error'); valid = false;
    }
    if (!password) {
        showError('loginPasswordErr', 'Please enter your password'); document.getElementById('loginPassword').classList.add('error'); valid = false;
    }
    if (!captchaInput) {
        showError('loginCaptchaErr', 'Please enter the captcha code'); valid = false;
    } else if (captchaInput !== captchas.login) {
        showError('loginCaptchaErr', 'Captcha does not match. Please try again.'); valid = false;
        generateCaptcha('login');
    }
    if (!valid) { shakeForm('loginForm'); return; }

    try {
        const response = await fetch('http://127.0.0.1:5000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password, remember_me: rememberMe })
        });
        const data = await response.json();
        if (response.ok) {
            showToast('Login successful! Redirecting...');
            setTimeout(() => {
                showDashboard(data.admin.full_name, data.admin.email);
                loadDashboardData();
            }, 1200);
        } else {
            showError('loginPasswordErr', data.error || 'Login failed');
            shakeForm('loginForm');
        }
    } catch (error) {
        showError('loginPasswordErr', 'Network error. Please try again.');
        shakeForm('loginForm');
        generateCaptcha('login');
    }
});

// ===== SIGNUP =====
document.getElementById('signupForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    clearAllErrors('signupForm');
    let valid = true;

    const name            = document.getElementById('signupName').value.trim();
    const email           = document.getElementById('signupEmail').value.trim();
    const password        = document.getElementById('signupPassword').value.trim();
    const confirmPassword = document.getElementById('signupConfirmPassword').value.trim();
    const captchaInput    = document.getElementById('signupCaptchaInput').value.trim();

    if (!name) { showError('signupNameErr'); document.getElementById('signupName').classList.add('error'); valid = false; }
    if (!email || !isValidEmail(email)) { showError('signupEmailErr'); document.getElementById('signupEmail').classList.add('error'); valid = false; }
    if (!password || password.length < 8) { showError('signupPasswordErr'); document.getElementById('signupPassword').classList.add('error'); valid = false; }
    if (!confirmPassword || password !== confirmPassword) { showError('signupConfirmPasswordErr'); document.getElementById('signupConfirmPassword').classList.add('error'); valid = false; }
    if (!captchaInput) {
        showError('signupCaptchaErr', 'Please enter the captcha code'); valid = false;
    } else if (captchaInput !== captchas.signup) {
        showError('signupCaptchaErr', 'Captcha does not match.'); valid = false;
        generateCaptcha('signup');
    }
    if (!valid) { shakeForm('signupForm'); return; }

    try {
        const response = await fetch('http://127.0.0.1:5000/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: name, email, password, confirm_password: confirmPassword })
        });
        const data = await response.json();
        if (response.ok) {
            showToast('Account created successfully!');
            generateCaptcha('signup');
            this.reset();
            checkStrength('');
            setTimeout(() => showPage('loginPage'), 1500);
        } else {
            showError('signupEmailErr', data.error || 'Signup failed');
            shakeForm('signupForm');
        }
    } catch (error) {
        showError('signupEmailErr', 'Network error. Please try again.');
        shakeForm('signupForm');
    }
});

// ===== FORGOT PASSWORD =====
document.getElementById('forgotForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    clearAllErrors('forgotForm');
    let valid = true;

    const email        = document.getElementById('forgotEmail').value.trim();
    const captchaInput = document.getElementById('forgotCaptchaInput').value.trim();

    if (!email || !isValidEmail(email)) { showError('forgotEmailErr'); document.getElementById('forgotEmail').classList.add('error'); valid = false; }
    if (!captchaInput) {
        showError('forgotCaptchaErr', 'Please enter the captcha code'); valid = false;
    } else if (captchaInput !== captchas.forgot) {
        showError('forgotCaptchaErr', 'Captcha does not match.'); valid = false;
        generateCaptcha('forgot');
    }
    if (!valid) { shakeForm('forgotForm'); return; }

    try {
        const response = await fetch('http://127.0.0.1:5000/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        if (response.ok) {
            showToast(data.message || 'Reset link sent!');
            generateCaptcha('forgot');
            this.reset();
        } else {
            showError('forgotEmailErr', data.error || 'Failed to send reset link');
            shakeForm('forgotForm');
        }
    } catch (error) {
        showError('forgotEmailErr', 'Network error. Please try again.');
        shakeForm('forgotForm');
    }
});

// Clear errors on input
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
        this.classList.remove('error');
        const err = this.closest('.form-group')?.querySelector('.error-msg');
        if (err) err.classList.remove('show');
    });
});

// Responsive sidebar
window.addEventListener('resize', () => {
    const toggle = document.getElementById('menuToggle');
    if (toggle) toggle.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
});
