// Import utility needed for exposing non-alert message helper
import { appData, navigate } from './app.js'; 

// ----------------------------------------------------------------------
// 1. HELPER FUNCTIONS
// ----------------------------------------------------------------------

// Replaces alert/confirm for non-blocking UI notifications
export function showModalMessage(message, type = 'success') {
    const existingModal = document.getElementById('status-modal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div id="status-modal" class="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 transition-opacity duration-300 backdrop-blur-sm">
            <div class="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full transform transition-transform duration-300 scale-100">
                <div class="flex items-center space-x-3">
                    <div class="p-2 rounded-full ${type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}">
                        ${type === 'success' ? 
                            '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>' :
                            '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.332 16c-.77 1.333.192 3 1.732 3z" /></svg>'
                        }
                    </div>
                    <h3 class="text-xl font-bold text-gray-900">${type === 'success' ? 'Success' : 'Error'}</h3>
                </div>
                <p class="mt-4 text-base text-gray-600">${message}</p>
                <button onclick="document.getElementById('status-modal').remove()" class="mt-6 w-full py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors">Close</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ----------------------------------------------------------------------
// 2. NAV BAR RENDERER
// ----------------------------------------------------------------------

export const renderNavBar = (currentPage, userId) => {
    // In this anonymous-only version, we assume userId is always present after init, 
    // but keep the check just in case.
    if (!userId) {
        return `<nav class="bg-white sticky top-0 border-b border-gray-200 shadow-md z-10">
                    <div class="max-w-4xl mx-auto flex justify-between items-center p-3">
                        <div class="text-xl font-extrabold text-emerald-600">Jal-Mitra</div>
                    </div>
                </nav>`;
    }
    
    const navItems = ['Dashboard', 'OMLog', 'Quality', 'Faults', 'Analytics'];
    
    return `
        <nav class="bg-white sticky top-0 border-b border-gray-200 shadow-md z-10">
            <div class="max-w-4xl mx-auto flex justify-between items-center p-3">
                <div class="text-xl font-extrabold text-emerald-600">Jal-Mitra</div>
                <div class="flex items-center space-x-2 sm:space-x-4 overflow-x-auto whitespace-nowrap">
                    ${navItems.map(item => `
                        <button onclick="navigate('${item}')" 
                            class="text-sm px-2 py-2 transition-colors duration-200 
                            ${currentPage === item ? 'nav-active' : 'text-gray-500 hover:text-emerald-500'}">
                            ${item.replace(/([A-Z])/g, ' $1').trim()}
                        </button>
                    `).join('')}
                    <button onclick="handleLogout()" class="text-sm px-3 py-1 bg-red-100 text-red-600 font-semibold rounded-lg hover:bg-red-200 transition-colors">
                        Logout
                    </button>
                </div>
            </div>
        </nav>
    `;
};


// ----------------------------------------------------------------------
// 3. PAGE TEMPLATES
// ----------------------------------------------------------------------

const DashboardPage = () => {
    const getStatusColor = (status) => {
        switch (status) {
            case 'Operational': return 'bg-emerald-500';
            case 'Warning': return 'bg-amber-500';
            case 'Fault': return 'bg-red-500';
            default: return 'bg-gray-400';
        }
    };

    const getQualityColor = (compliance) => {
        switch (compliance) {
            case 'Compliant': return 'text-emerald-600 bg-emerald-100';
            case 'Non-Compliant': return 'text-red-600 bg-red-100';
            case 'Needs Check': return 'text-amber-600 bg-amber-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    return `
        <div class="p-4 sm:p-6 page-content">
            <h1 class="text-3xl font-bold text-gray-800 mb-6 border-b pb-2">System Health Dashboard</h1>

            <!-- User ID Display for Collaboration -->
            <div class="mb-6 bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                <span class="font-semibold">Your Session User ID:</span> ${appData.userId}
                <span class="block text-xs text-blue-600 mt-1">All data is saved under this ID.</span>
            </div>

            <!-- 1. Overall Status Card -->
            <div class="data-card mb-6 p-6 rounded-xl ${getStatusColor(appData.systemStatus)} text-white transition-all">
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-semibold mb-1">Overall System Status</h2>
                        <p class="text-4xl font-extrabold">${appData.systemStatus}</p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        <path d="M15 9l-3 3-3-3"></path>
                    </svg>
                </div>
            </div>

            <!-- 2. Key Metrics Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <!-- Water Quality Compliance -->
                <div class="data-card p-4 rounded-xl bg-white border border-gray-200">
                    <p class="text-sm font-medium text-gray-500">Water Quality</p>
                    <div class="text-2xl font-bold text-gray-800 mt-1">${appData.qualityCompliance}</div>
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${getQualityColor(appData.qualityCompliance)} mt-2 inline-block">
                        Last Check: ${appData.lastQualityCheck}
                    </span>
                </div>

                <!-- Pump Run Hours -->
                <div class="data-card p-4 rounded-xl bg-white border border-gray-200">
                    <p class="text-sm font-medium text-gray-500">Pump Running Status</p>
                    <div class="text-2xl font-bold text-gray-800 mt-1">${appData.lastPumpRun}</div>
                    <p class="text-xs text-gray-400 mt-2">Check O&M Log for details</p>
                </div>

                <!-- Pending Faults -->
                <div class="data-card p-4 rounded-xl bg-white border border-gray-200">
                    <p class="text-sm font-medium text-gray-500">Pending Faults</p>
                    <div class="text-2xl font-bold ${appData.pendingFaults > 0 ? 'text-red-600' : 'text-emerald-600'} mt-1">${appData.pendingFaults}</div>
                    <button onclick="navigate('Faults')" class="text-xs text-blue-500 hover:text-blue-700 mt-2">View Tracker →</button>
                </div>
            </div>

            <!-- 3. Latest Fault Summary -->
            <div class="mb-6 p-4 border-l-4 ${appData.lastFault.status === 'Reported' ? 'border-red-500 bg-red-50' : 'border-gray-400 bg-gray-50'} rounded-lg">
                <p class="font-semibold text-lg text-gray-800">Latest Maintenance Status</p>
                <p class="text-gray-600 mt-1">${appData.lastFault.description}</p>
                <p class="text-sm mt-2">Status: <span class="font-bold">${appData.lastFault.status}</span></p>
            </div>

            <!-- 4. Action Buttons -->
            <div class="grid grid-cols-2 gap-4">
                <button onclick="navigate('OMLog')" class="bg-indigo-600 text-white p-4 rounded-xl hover:bg-indigo-700 transition-all font-semibold">
                    Enter Daily O&M Log
                </button>
                <button onclick="navigate('Quality')" class="bg-yellow-600 text-white p-4 rounded-xl hover:bg-yellow-700 transition-all font-semibold">
                    Record Water Quality
                </button>
            </div>
        </div>
    `;
};

const OMLogPage = () => {
    const today = new Date().toISOString().split('T')[0];

    return `
        <div class="p-4 sm:p-6 page-content">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">Daily O&M Log Entry</h1>
            <p class="text-gray-600 mb-6 border-b pb-4">Record operational data for pump hours, consumption, and system checks.</p>
            
            <form id="om-log-form" onsubmit="event.preventDefault(); submitOMLog();" class="space-y-6">
                
                <!-- Date (Read-only today) -->
                <div class="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <label for="date" class="block text-sm font-medium text-blue-700">Date of Log</label>
                    <input type="date" id="date" name="date" value="${today}" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-3 bg-white" readonly>
                    <p class="text-xs text-blue-600 mt-1">Logs are automatically time-stamped with the current date/time.</p>
                </div>

                <!-- Pump Running Hours (Mandatory) -->
                <div>
                    <label for="pumpHours" class="block text-lg font-medium text-gray-700">Pump Running Hours Today (Hrs)</label>
                    <input type="number" id="pumpHours" name="pumpHours" min="0" step="0.1" required 
                        placeholder="e.g., 5.5" class="mt-1 block w-full rounded-xl border-gray-300 shadow-sm p-3 text-2xl font-bold focus:border-indigo-500 focus:ring-indigo-500 transition-all" />
                    <p class="text-sm text-gray-500 mt-1">Enter total motor operating hours for the day (e.g., from the hour meter).</p>
                </div>

                <!-- Energy Meter Reading (Optional) -->
                <div>
                    <label for="meterReading" class="block text-lg font-medium text-gray-700">Energy Meter Reading (kWh) - Optional</label>
                    <input type="number" id="meterReading" name="meterReading" min="0" step="0.01" 
                        placeholder="e.g., 450.75" class="mt-1 block w-full rounded-xl border-gray-300 shadow-sm p-3 text-xl focus:border-indigo-500 focus:ring-indigo-500 transition-all" />
                    <p class="text-sm text-gray-500 mt-1">Record the current cumulative reading for cost analysis later.</p>
                </div>

                <!-- Leakage Check (Critical Visual Inspection) -->
                <div>
                    <label class="block text-lg font-medium text-gray-700 mb-2">Leakage Observed?</label>
                    <div class="flex space-x-4">
                        <label class="flex items-center space-x-2 p-3 bg-white border border-gray-300 rounded-xl flex-1 cursor-pointer hover:bg-red-50 transition-colors">
                            <input type="radio" name="leakageObserved" value="Yes - Reported" required class="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500">
                            <span class="font-medium text-red-700">Yes (Urgent)</span>
                        </label>
                        <label class="flex items-center space-x-2 p-3 bg-white border border-gray-300 rounded-xl flex-1 cursor-pointer hover:bg-emerald-50 transition-colors">
                            <input type="radio" name="leakageObserved" value="No" checked class="h-4 w-4 text-emerald-600 border-gray-300 focus:ring-emerald-500">
                            <span class="font-medium text-emerald-700">No</span>
                        </label>
                    </div>
                    <p class="text-sm text-gray-500 mt-1">If 'Yes', please also log a detailed fault report in the **Faults** section.</p>
                </div>

                <!-- General Remarks -->
                <div>
                    <label for="remarks" class="block text-lg font-medium text-gray-700">Remarks (Tank Level, Valve Status, etc.)</label>
                    <textarea id="remarks" name="remarks" rows="3" placeholder="e.g., Tank level normal, all valves closed, water pressure good."
                        class="mt-1 block w-full rounded-xl border-gray-300 shadow-sm p-3 focus:border-indigo-500 focus:ring-indigo-500"></textarea>
                </div>

                <!-- Submit Button -->
                <button type="submit" 
                    class="w-full py-3 bg-indigo-600 text-white font-extrabold rounded-xl shadow-md hover:bg-indigo-700 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50">
                    <span class="flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Save Daily Log
                    </span>
                </button>
            </form>
        </div>
    `;
};

const QualityPage = () => {
    const today = new Date().toISOString().split('T')[0];

    return `
        <div class="p-4 sm:p-6 page-content">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">Water Quality Portal</h1>
            <p class="text-gray-600 mb-6 border-b pb-4">Record results from portable digital test kits (e.g., pH meter, Chlorine test).</p>
            
            <form id="quality-log-form" onsubmit="event.preventDefault(); submitWaterQualityLog();" class="space-y-6">
                
                <!-- Date (Read-only today) -->
                <div class="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                    <label for="date" class="block text-sm font-medium text-yellow-700">Date of Test</label>
                    <input type="date" id="date" name="date" value="${today}" 
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-3 bg-white" readonly>
                </div>

                <!-- Test Location (Tap, Tank, Source) -->
                <div>
                    <label for="location" class="block text-lg font-medium text-gray-700">Test Location</label>
                    <select id="location" name="location" required 
                        class="mt-1 block w-full rounded-xl border-gray-300 shadow-sm p-3 text-lg focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                        <option value="" disabled selected>Select test point...</option>
                        <option value="Source (Well/Bore)">Source (Well/Bore)</option>
                        <option value="Storage Tank">Storage Tank</option>
                        <option value="Household Tap (Random)">Household Tap (Random)</option>
                        <option value="School/Anganwadi Tap">School/Anganwadi Tap</option>
                    </select>
                </div>
                
                <!-- pH Level (Mandatory) -->
                <div>
                    <label for="pH" class="block text-lg font-medium text-gray-700">pH Level (0-14)</label>
                    <input type="number" id="pH" name="pH" min="0" max="14" step="0.1" required 
                        placeholder="Safe Range: 6.5 - 8.5" class="mt-1 block w-full rounded-xl border-gray-300 shadow-sm p-3 text-2xl font-bold focus:border-indigo-500 focus:ring-indigo-500 transition-all" />
                    <p class="text-sm text-gray-500 mt-1">Measures acidity or alkalinity.</p>
                </div>

                <!-- Chlorine Residual (Mandatory) -->
                <div>
                    <label for="chlorineLevel" class="block text-lg font-medium text-gray-700">Chlorine Residual (mg/L)</label>
                    <input type="number" id="chlorineLevel" name="chlorineLevel" min="0" step="0.01" required
                        placeholder="Safe Range: > 0.2 mg/L" class="mt-1 block w-full rounded-xl border-gray-300 shadow-sm p-3 text-2xl font-bold focus:border-indigo-500 focus:ring-indigo-500 transition-all" />
                    <p class="text-sm text-gray-500 mt-1">Ensures water is disinfected and safe from bacteria.</p>
                </div>

                <!-- TDS (Optional) -->
                <div>
                    <label for="tdsLevel" class="block text-lg font-medium text-gray-700">TDS (ppm) - Optional</label>
                    <input type="number" id="tdsLevel" name="tdsLevel" min="0" 
                        placeholder="Safe Range: < 500 ppm" class="mt-1 block w-full rounded-xl border-gray-300 shadow-sm p-3 text-xl focus:border-indigo-500 focus:ring-indigo-500 transition-all" />
                    <p class="text-sm text-gray-500 mt-1">Total Dissolved Solids (measures taste/saltiness).</p>
                </div>

                <!-- Submit Button -->
                <button type="submit" 
                    class="w-full py-3 bg-yellow-600 text-white font-extrabold rounded-xl shadow-md hover:bg-yellow-700 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-yellow-500 focus:ring-opacity-50">
                    <span class="flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Save Quality Report
                    </span>
                </button>
            </form>
        </div>
    `;
};

const FaultsPage = () => {
    
    const getStatusTag = (status) => {
        return `<span class="px-3 py-1 text-xs font-semibold rounded-full status-tag-${status.replace(/\s/g, '')}">${status}</span>`;
    };

    const getFaultListItem = (fault) => {
        const date = fault.timestamp ? new Date(fault.timestamp.toDate()).toLocaleDateString() : 'N/A';
        const faultIdShort = fault.id.substring(0, 8);

        return `
            <div class="data-card bg-white p-4 rounded-xl border border-gray-200 mb-4">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="text-lg font-bold text-gray-800">${fault.description}</h3>
                    ${getStatusTag(fault.status)}
                </div>
                <p class="text-sm text-gray-600 mb-2">Location: ${fault.location} | Priority: <span class="font-semibold text-${fault.priority === 'High' ? 'red' : fault.priority === 'Medium' ? 'amber' : 'green'}-600">${fault.priority}</span></p>
                <p class="text-xs text-gray-400">Reported on: ${date} by ${fault.reporterId.substring(0, 8)}...</p>

                <!-- Status Update Dropdown -->
                <div class="mt-3 pt-3 border-t border-gray-100 flex items-center space-x-2">
                    <label class="text-sm font-medium text-gray-700 whitespace-nowrap">Update Status:</label>
                    <select onchange="updateFaultStatus('${fault.id}', this.value)" 
                        class="block w-full text-sm rounded-md border-gray-300 shadow-sm p-1.5 bg-gray-50 focus:border-blue-500 focus:ring-blue-500">
                        <option value="Reported" ${fault.status === 'Reported' ? 'selected' : ''}>Reported</option>
                        <option value="Assigned" ${fault.status === 'Assigned' ? 'selected' : ''}>Assigned</option>
                        <option value="InProgress" ${fault.status === 'InProgress' ? 'selected' : ''}>In Progress</option>
                        <option value="Resolved" ${fault.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                    </select>
                </div>
            </div>
        `;
    };

    const pendingFaults = appData.faultsData.filter(f => f.status !== 'Resolved');
    const resolvedFaults = appData.faultsData.filter(f => f.status === 'Resolved');

    return `
        <div class="p-4 sm:p-6 page-content">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">Maintenance & Fault Tracker</h1>
            <p class="text-gray-600 mb-6 border-b pb-4">Report new issues quickly and track their resolution status.</p>

            <!-- REPORT FAULT FORM -->
            <div class="bg-red-50 p-4 rounded-xl shadow-lg mb-8">
                <h2 class="text-xl font-bold text-red-800 mb-3">Report a New Fault</h2>
                <form id="fault-report-form" onsubmit="event.preventDefault(); submitFaultReport();" class="space-y-4">
                    
                    <!-- Description -->
                    <div>
                        <label for="description" class="block text-sm font-medium text-gray-700">Detailed Description</label>
                        <textarea id="description" name="description" rows="2" required placeholder="e.g., Main pump is vibrating heavily and making a grinding noise."
                            class="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 focus:border-red-500 focus:ring-red-500"></textarea>
                    </div>

                    <!-- Location & Priority -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label for="location" class="block text-sm font-medium text-gray-700">Location</label>
                            <input type="text" id="location" name="location" required placeholder="e.g., Near Tank 1, Pipeline to School"
                                class="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 focus:border-red-500 focus:ring-red-500" />
                        </div>
                        <div>
                            <label for="priority" class="block text-sm font-medium text-gray-700">Priority</label>
                            <select id="priority" name="priority" required 
                                class="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 focus:border-red-500 focus:ring-red-500">
                                <option value="Low">Low (Aesthetic issue)</option>
                                <option value="Medium" selected>Medium (Minor leakage/fault)</option>
                                <option value="High">High (Pump failure / Major leakage)</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Reporter Contact -->
                    <div>
                        <label for="contact" class="block text-sm font-medium text-gray-700">Your Contact (Phone/Name)</label>
                        <input type="text" id="contact" name="contact" required placeholder="Name and Phone Number"
                            class="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 focus:border-red-500 focus:ring-red-500" />
                    </div>

                    <!-- Submit Button -->
                    <button type="submit" 
                        class="w-full py-2.5 bg-red-600 text-white font-extrabold rounded-lg shadow-md hover:bg-red-700 transition-colors">
                        <span class="flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"></path></svg>
                            Report Fault
                        </span>
                    </button>
                </form>
            </div>

            <!-- FAULT LIST -->
            <h2 class="text-2xl font-bold text-gray-800 mb-4">Pending Faults (${pendingFaults.length})</h2>
            <div class="space-y-4">
                ${pendingFaults.length > 0 ? pendingFaults.map(getFaultListItem).join('') : '<p class="text-gray-500 p-4 border rounded-xl bg-white">No outstanding maintenance issues currently reported. Great job!</p>'}
            </div>

            <!-- RESOLVED FAULTS TOGGLE -->
            <div class="mt-8">
                <h2 class="text-2xl font-bold text-gray-800 mb-4 border-t pt-4">Resolved Faults (${resolvedFaults.length})</h2>
                <details class="bg-gray-100 p-4 rounded-xl">
                    <summary class="font-semibold cursor-pointer text-gray-700">Show Resolved Issues</summary>
                    <div class="mt-4 space-y-4">
                        ${resolvedFaults.length > 0 ? resolvedFaults.map(getFaultListItem).join('') : '<p class="text-gray-500">No faults have been resolved yet.</p>'}
                    </div>
                </details>
            </div>
        </div>
    `;
};


const AnalyticsPage = () => {
    if (appData.omLogs.length === 0 && appData.qualityLogs.length === 0) {
         return `
            <div class="p-8 text-center page-content">
                <h1 class="text-3xl font-bold text-gray-800 mb-6 border-b pb-2">Predictive Insights & Analytics</h1>
                <div class="bg-gray-100 p-8 rounded-xl mt-6">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-indigo-400 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg>
                    <p class="text-lg font-semibold text-gray-700">Data required for analysis.</p>
                    <p class="text-gray-500 mt-2">Please log a few days of O&M Data and Water Quality checks to generate insights.</p>
                    <button onclick="navigate('OMLog')" class="mt-4 py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Start Logging Data</button>
                </div>
            </div>`;
    }

    return `
        <div class="p-4 sm:p-6 page-content">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">Predictive Insights & Analytics</h1>
            <p class="text-gray-600 mb-6 border-b pb-4">Turning raw O&M data into actionable insights for the Gram Panchayat.</p>

            <!-- Insight 1: Pump Efficiency -->
            <div class="data-card bg-white p-4 rounded-xl shadow-lg mb-8">
                <h2 class="text-xl font-bold text-indigo-700 mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Pump Usage & Efficiency Trend
                </h2>
                <div class="h-80">
                    <canvas id="efficiencyChart"></canvas>
                </div>
                <p class="text-sm text-gray-600 mt-4 border-t pt-3">
                    **Predictive Check:** Monitor the **kWh/Hr Efficiency** line. A sharp, sustained drop often indicates pump wear, motor damage, or increased friction—allowing **preventive maintenance** before a complete failure occurs.
                </p>
            </div>

            <!-- Insight 2: Water Quality Trend -->
            <div class="data-card bg-white p-4 rounded-xl shadow-lg mb-8">
                <h2 class="text-xl font-bold text-yellow-700 mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10a7 7 0 0114 0v4a7 7 0 01-14 0V10zM17 10v4M17 14h4m-4 0v-4m-4 4h-4m-4 0v-4" /></svg>
                    Water Quality Audit (pH & Chlorine)
                </h2>
                <div class="h-80">
                    <canvas id="qualityChart"></canvas>
                </div>
                <p class="text-sm text-gray-600 mt-4 border-t pt-3">
                    **Compliance Audit:** This chart tracks average pH and Chlorine Residual (Disinfectant). If Chlorine drops below 0.2 mg/L, the system is at risk of bacterial contamination, requiring immediate attention.
                </p>
            </div>
        </div>
    `;
};

// ----------------------------------------------------------------------
// 4. CHART.JS RENDER LOGIC (Exported for use in app.js)
// ----------------------------------------------------------------------

export function renderEfficiencyChart(labels, pumpHours, efficiency) {
    const ctx = document.getElementById('efficiencyChart');
    if (!ctx) return;
    new Chart(ctx, {
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Pump Hours (Hrs)',
                    data: pumpHours,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)', // Blue
                    yAxisID: 'y1',
                },
                {
                    type: 'line',
                    label: 'kWh / Hour Efficiency',
                    data: efficiency,
                    borderColor: 'rgb(234, 88, 12)', // Orange
                    borderWidth: 3,
                    fill: false,
                    yAxisID: 'y2',
                    tension: 0.4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Pump Hours (Hrs)' },
                },
                y2: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Efficiency (kWh/Hr)' },
                    min: 0,
                },
                x: {
                     title: { display: true, text: 'Date' }
                }
            },
            plugins: { legend: { position: 'top' } }
        }
    });
}

export function renderQualityChart(labels, phData, chlorineData) {
    const ctx = document.getElementById('qualityChart');
    if (!ctx) return;
    new Chart(ctx, {
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Average pH',
                    data: phData,
                    borderColor: 'rgb(5, 150, 105)', // Green
                    backgroundColor: 'rgba(5, 150, 105, 0.1)',
                    yAxisID: 'y1',
                    tension: 0.2,
                    fill: true,
                },
                {
                    type: 'bar',
                    label: 'Avg Chlorine Residual (mg/L)',
                    data: chlorineData,
                    backgroundColor: 'rgba(234, 179, 8, 0.8)', // Yellow
                    yAxisID: 'y2',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'pH Level' },
                    min: 6,
                    max: 9,
                },
                y2: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Chlorine (mg/L)' },
                    min: 0,
                    max: 1.0,
                },
                x: {
                     title: { display: true, text: 'Date' }
                }
            },
            plugins: { legend: { position: 'top' } }
        }
    });
}


// ----------------------------------------------------------------------
// 5. EXPORT COMPONENTS
// ----------------------------------------------------------------------

export const pageComponents = {
    'Dashboard': DashboardPage,
    'OMLog': OMLogPage,
    'Quality': QualityPage,
    'Faults': FaultsPage,
    'Analytics': AnalyticsPage,
};

// Global export for utility needed in app.js
window.showModalMessage = showModalMessage;