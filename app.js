import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, updateDoc, onSnapshot, collection, query, limit, orderBy, addDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import { pageComponents, renderNavBar, renderEfficiencyChart, renderQualityChart, showModalMessage } from './components.js';

// ----------------------------------------------------------------------
// 1. GLOBAL STATE & FIREBASE SETUP
// ----------------------------------------------------------------------

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-jal-mitra';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app, db, auth;
// Set a temporary non-null userId during development if auth fails, so data logic doesn't crash
let userId = 'loading-user'; 
let isAuthReady = false;
let currentPage = 'Dashboard';
let unsubscribeDashboard = null; 
let unsubscribeFaults = null; 
let unsubscribeAnalytics = null; 

// Shared state for data across the application
export let appData = {
    systemStatus: 'Loading...',
    lastPumpRun: 'N/A',
    lastQualityCheck: 'N/A',
    pendingFaults: 0,
    qualityCompliance: 'Unknown',
    lastFault: { id: 'N/A', description: 'No recent faults', status: 'Resolved' },
    // Data storage for Analytics and FaultsPage
    faultsData: [],
    omLogs: [],
    qualityLogs: [],
};

// Expose state and functions globally for HTML components (mandatory for single HTML file integration)
window.appData = appData;
window.navigate = navigate;
window.handleLogout = handleLogout;
window.submitOMLog = submitOMLog;
window.submitWaterQualityLog = submitWaterQualityLog;
window.submitFaultReport = submitFaultReport;
window.updateFaultStatus = updateFaultStatus;


// Helper for getting collection path (Private data)
const getCollectionPath = (collectionName) => {
    // Note: If userId is null, this path will be invalid for Firestore rules, 
    // but the app must still render. Data operations will show permissions errors.
    return `/artifacts/${appId}/users/${userId || 'unauthenticated'}/${collectionName}`;
};

// ----------------------------------------------------------------------
// 2. INITIALIZATION & AUTHENTICATION
// ----------------------------------------------------------------------

async function initializeAppAndAuth() {
    try {
        if (Object.keys(firebaseConfig).length === 0) {
            throw new Error("Firebase configuration is missing.");
        }
        
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        getAnalytics(app);

        // This promise handles the entire authentication lifecycle
        return new Promise(async (resolve) => {
            const handleAuth = async (user) => {
                let initialCheck = !isAuthReady;
                isAuthReady = true;

                if (user) {
                    userId = user.uid;
                } else {
                    userId = null;
                }
                
                if (initialCheck) {
                    // 1. Attempt anonymous sign-in if no user is found on initial load
                    if (!userId) {
                        try {
                            // This is the call that might fail if the provider is disabled
                            await signInAnonymously(auth);
                        } catch (e) {
                            console.error("Authentication Error: Anonymous sign-in failed. Please check Firebase Auth settings (auth/operation-not-allowed).", e);
                            userId = 'development-fallback'; // Use a non-null ID to allow UI to render
                        }
                    }
                    
                    // 2. Start listeners and render the app after the first auth state check
                    if (userId && userId !== 'development-fallback') {
                        setupDashboardListener();
                    } else if (userId === 'development-fallback') {
                        // User is intentionally unauthenticated but we need to render
                        showModalMessage("Authentication Failed (Firebase Config Error). Running in DEVELOPMENT FALLBACK MODE. Data will NOT persist.", 'error');
                    }
                    renderApp(); 
                    resolve();

                } else if (user && currentPage !== 'Dashboard') {
                    // State changed after initial check (e.g., successful sign-in)
                    navigate('Dashboard');
                }
            };
            
            // Set up the listener
            onAuthStateChanged(auth, handleAuth);

            // Attempt custom token sign-in first if provided 
            if (initialAuthToken) {
                try {
                    await signInWithCustomToken(auth, initialAuthToken);
                } catch (e) {
                    console.warn("Custom token sign-in failed.", e);
                }
            }
        });

    } catch (error) {
        console.error("Firebase Initialization Error:", error);
        document.getElementById('app').innerHTML = `<div class="p-8 text-center text-red-600">FATAL ERROR: Could not start application securely. ${error.message}</div>`;
        return Promise.reject(error);
    }
}

// ----------------------------------------------------------------------
// 3. NAVIGATION & RENDER
// ----------------------------------------------------------------------

function renderApp() {
    const appContainer = document.getElementById('app');
    if (!isAuthReady) return; 

    // Set the user ID in the appData for display in the dashboard
    appData.userId = userId || 'N/A (Unauthenticated)';
    
    const pageContent = pageComponents[currentPage] ? pageComponents[currentPage]() : `
        <div class="p-8 text-center text-red-500">Page not found for: ${currentPage}</div>
    `;

    appContainer.innerHTML = `
        ${renderNavBar(currentPage, userId)}
        ${pageContent}
        <footer class="text-center text-xs text-gray-400 p-4 border-t">
            B.Tech CSE Final Year Project | PS: Rural Water O&M Monitoring | Jal Jeevan Mission Theme
        </footer>
    `;

    // Special rendering logic for Analytics page
    if (currentPage === 'Analytics' && appData.omLogs.length > 0) {
        // Need to wait briefly for Canvas elements to exist before rendering charts
        setTimeout(() => {
            // Data aggregation logic (from previous monolithic file)
            const omByDate = appData.omLogs.reduce((acc, log) => {
                const date = log.logDate;
                if (!acc[date]) { acc[date] = { pumpHours: 0, meterReading: log.meterReading, count: 0 }; }
                acc[date].pumpHours += log.pumpHours;
                acc[date].meterReading = log.meterReading; // Keep latest reading for efficiency calc
                return acc;
            }, {});

            const sortedDates = Object.keys(omByDate).sort();
            const pumpHoursData = [];
            const efficiencyData = [];
            let lastMeterReading = null;

            sortedDates.forEach((date, index) => {
                const dailyData = omByDate[date];
                pumpHoursData.push(dailyData.pumpHours);

                let dailyEfficiency = null;
                if (index > 0 && lastMeterReading !== null && dailyData.meterReading > 0) {
                    const consumption = dailyData.meterReading - lastMeterReading;
                    if (dailyData.pumpHours > 0) {
                        dailyEfficiency = parseFloat((consumption / dailyData.pumpHours).toFixed(2));
                    }
                }
                efficiencyData.push(dailyEfficiency);
                lastMeterReading = dailyData.meterReading > 0 ? dailyData.meterReading : lastMeterReading;
            });

            // Quality data aggregation
            const qualityByDate = appData.qualityLogs.reduce((acc, log) => {
                const date = log.logDate;
                if (!acc[date]) { acc[date] = { phValues: [], chlorineValues: [] }; }
                acc[date].phValues.push(log.pH);
                acc[date].chlorineValues.push(log.chlorineLevel);
                return acc;
            }, {});
            
            const qualityDates = Object.keys(qualityByDate).sort();
            const phData = [];
            const chlorineData = [];

            qualityDates.forEach(date => {
                const dailyData = qualityByDate[date];
                const avgPH = dailyData.phValues.reduce((a, b) => a + b, 0) / dailyData.phValues.length;
                const avgChlorine = dailyData.chlorineValues.reduce((a, b) => a + b, 0) / dailyData.chlorineValues.length;
                phData.push(parseFloat(avgPH.toFixed(1)));
                chlorineData.push(parseFloat(avgChlorine.toFixed(2)));
            });

            renderEfficiencyChart(sortedDates, pumpHoursData, efficiencyData);
            renderQualityChart(qualityDates, phData, chlorineData);
        }, 100);
    }
}

// navigation helper: exported for use by other modules (and assigned to window above)
export function navigate(pageName) {
    if (pageName === currentPage) return;

    currentPage = pageName;
    
    // Clean up old listeners
    if (unsubscribeDashboard) { unsubscribeDashboard(); unsubscribeDashboard = null; }
    if (unsubscribeFaults) { unsubscribeFaults(); unsubscribeFaults = null; }
    
    // Re-subscribe if navigating to specific pages
    if (userId && userId !== 'development-fallback') {
        if (currentPage === 'Dashboard') {
            setupDashboardListener();
        } else if (currentPage === 'Faults') {
            setupFaultsListener();
        } else if (currentPage === 'Analytics') {
            setupAnalyticsListener();
        }
    } else {
         console.warn("Cannot set up listeners: userId is null/fallback.");
    }
    
    renderApp();
}

// ----------------------------------------------------------------------
// 4. SUBMISSION HANDLERS
// ----------------------------------------------------------------------

async function handleLogout() {
    try {
        if (unsubscribeDashboard) unsubscribeDashboard();
        if (unsubscribeFaults) unsubscribeFaults();
        
        await signOut(auth);
        showModalMessage('Logged out successfully. Reloading for new session.', 'success');
        // onAuthStateChanged handles the re-initialization
    } catch (error) {
        console.error("Logout Error:", error);
        showModalMessage('Logout failed. Please try again.', 'error');
    }
}

async function submitOMLog() {
    if (!db || !userId || userId === 'development-fallback' || userId === 'timeout-fallback') { 
        showModalMessage('Cannot save data. Authentication failed. Running in Fallback Mode.', 'error'); 
        return; 
    }

    const form = document.getElementById('om-log-form');
    const submitButton = form.querySelector('button[type="submit"]');
    
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="flex items-center justify-center"><div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> Saving...</span>`;

    const pumpHours = parseFloat(form.pumpHours.value);
    const meterReading = parseFloat(form.meterReading.value) || 0;
    const leakageObserved = form.leakageObserved.value;
    const remarks = form.remarks.value.trim();

    if (isNaN(pumpHours) || pumpHours < 0) {
        showModalMessage('Please enter a valid, non-negative number for Pump Running Hours.', 'error');
        submitButton.disabled = false;
        submitButton.innerHTML = `<span class"flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Save Daily Log</span>`;
        return;
    }

    try {
        const omData = {
            pumpHours: pumpHours,
            meterReading: meterReading, 
            leakageObserved: leakageObserved,
            remarks: remarks,
            reporterId: userId,
            timestamp: serverTimestamp(),
            logDate: new Date().toISOString().split('T')[0] 
        };

        const omRef = collection(db, getCollectionPath('OMLogs'));
        await addDoc(omRef, omData);

        showModalMessage('Daily O&M Log successfully recorded. Dashboard will update shortly.', 'success');
        form.reset();
        
        setTimeout(() => navigate('Dashboard'), 1000); 

    } catch (e) {
        console.error("Error adding O&M Log: ", e);
        showModalMessage(`Failed to record O&M Log: ${e.message}`, 'error');
    } finally {
         submitButton.disabled = false;
         submitButton.innerHTML = `<span class"flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Save Daily Log</span>`;
    }
}

async function submitWaterQualityLog() {
    if (!db || !userId || userId === 'development-fallback' || userId === 'timeout-fallback') { 
        showModalMessage('Cannot save data. Authentication failed. Running in Fallback Mode.', 'error'); 
        return; 
    }

    const form = document.getElementById('quality-log-form');
    const submitButton = form.querySelector('button[type="submit"]');
    
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="flex items-center justify-center"><div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> Saving...</span>`;

    const pH = parseFloat(form.pH.value);
    const chlorineLevel = parseFloat(form.chlorineLevel.value);
    const tdsLevel = parseFloat(form.tdsLevel.value) || 0; 
    const location = form.location.value;

    if (isNaN(pH) || pH < 0 || pH > 14) {
        showModalMessage('Please enter a valid pH value (0-14).', 'error');
        submitButton.disabled = false;
        submitButton.innerHTML = `<span class="flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Save Quality Report</span>`;
        return;
    }
    if (isNaN(chlorineLevel) || chlorineLevel < 0) {
        showModalMessage('Please enter a valid Chlorine Residual (non-negative).', 'error');
        submitButton.disabled = false;
        submitButton.innerHTML = `<span class"flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Save Quality Report</span>`;
        return;
    }
    
    let isCompliant = true;
    let complianceMessage = "Water quality is compliant.";
    if (pH < 6.5 || pH > 8.5) {
        isCompliant = false;
        complianceMessage = "Warning: pH level is outside the safe range (6.5-8.5).";
    } else if (chlorineLevel < 0.2) {
        isCompliant = false;
        complianceMessage = "Warning: Chlorine residual is too low (< 0.2 mg/L).";
    }

    try {
        const qualityData = {
            pH: pH,
            chlorineLevel: chlorineLevel,
            tdsLevel: tdsLevel,
            location: location,
            isCompliant: isCompliant,
            reporterId: userId,
            timestamp: serverTimestamp(),
            logDate: new Date().toISOString().split('T')[0] 
        };

        const qualityRef = collection(db, getCollectionPath('WaterQuality'));
        await addDoc(qualityRef, qualityData);

        showModalMessage(`Report saved. ${complianceMessage}`, 'success');
        form.reset();
        
        setTimeout(() => navigate('Dashboard'), 1000); 

    } catch (e) {
        console.error("Error adding document: ", e);
        showModalMessage(`Failed to record quality report: ${e.message}`, 'error');
    } finally {
         submitButton.disabled = false;
         submitButton.innerHTML = `<span class"flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Save Quality Report</span>`;
    }
}

async function submitFaultReport() {
    if (!db || !userId || userId === 'development-fallback' || userId === 'timeout-fallback') { 
        showModalMessage('Cannot save data. Authentication failed. Running in Fallback Mode.', 'error'); 
        return; 
    }

    const form = document.getElementById('fault-report-form');
    const submitButton = form.querySelector('button[type="submit"]');
    
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="flex items-center justify-center"><div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> Reporting...</span>`;

    const description = form.description.value.trim();
    const location = form.location.value;
    const priority = form.priority.value;
    const contact = form.contact.value.trim();

    if (description.length < 10) {
        showModalMessage('Please provide a detailed description (min 10 characters).', 'error');
        submitButton.disabled = false;
        submitButton.innerHTML = `<span class"flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Report Fault</span>`;
        return;
    }

    try {
        const faultData = {
            description: description,
            location: location,
            priority: priority,
            contact: contact,
            status: 'Reported', // Initial status
            reporterId: userId,
            timestamp: serverTimestamp(),
        };

        const faultRef = collection(db, getCollectionPath('Faults'));
        await addDoc(faultRef, faultData);

        showModalMessage(`Fault reported successfully. Status: Reported.`, 'success');
        form.reset();
        if (currentPage === 'Faults') renderApp(); 
        
    } catch (e) {
        console.error("Error adding fault report: ", e);
        showModalMessage(`Failed to submit fault: ${e.message}`, 'error');
    } finally {
         submitButton.disabled = false;
         submitButton.innerHTML = `<span class"flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Report Fault</span>`;
    }
}

async function updateFaultStatus(faultId, newStatus) {
    if (!db || !userId || userId === 'development-fallback' || userId === 'timeout-fallback') { 
        showModalMessage('Cannot save data. Authentication failed. Running in Fallback Mode.', 'error'); 
        return; 
    }

    const faultDocRef = doc(db, getCollectionPath('Faults'), faultId);

    try {
        await updateDoc(faultDocRef, {
            status: newStatus,
            lastUpdated: serverTimestamp()
        });
        showModalMessage(`Fault ${faultId.substring(0, 4)}... status updated to: ${newStatus}`, 'success');
    } catch (e) {
        console.error("Error updating fault status: ", e);
        showModalMessage(`Failed to update status: ${e.message}`, 'error');
    }
}

// ----------------------------------------------------------------------
// 5. FIRESTORE DATA LISTENERS
// ----------------------------------------------------------------------

function setupDashboardListener() {
    if (!db || !userId || userId === 'development-fallback' || userId === 'timeout-fallback') {
        appData.systemStatus = 'ERROR (No Auth)';
        appData.lastPumpRun = 'Cannot Connect';
        appData.lastQualityCheck = 'Disabled';
        appData.pendingFaults = 'N/A';
        renderApp();
        return;
    }

    if (unsubscribeDashboard) unsubscribeDashboard();

    // 1. Get the latest O&M Log
    const omQuery = query(collection(db, getCollectionPath('OMLogs')), orderBy('timestamp', 'desc'), limit(1));
    // 2. Get the latest Water Quality Report
    const qualityQuery = query(collection(db, getCollectionPath('WaterQuality')), orderBy('timestamp', 'desc'), limit(1));
    // 3. Get the pending Faults count and latest fault
    const faultQuery = query(collection(db, getCollectionPath('Faults')), orderBy('timestamp', 'desc'));

    // --- Listener for O&M Log (Pump Status) ---
    onSnapshot(omQuery, (snapshot) => {
        const latestLog = snapshot.docs[0]?.data();
        if (latestLog) {
            const logTime = latestLog.timestamp ? new Date(latestLog.timestamp.toDate()).toLocaleTimeString() : 'N/A';
            appData.lastPumpRun = `${latestLog.pumpHours || '0'} hrs (as of ${logTime})`;
            appData.systemStatus = latestLog.pumpHours > 0 ? 'Operational' : 'Warning';
        } else {
            appData.lastPumpRun = 'No logs yet';
            appData.systemStatus = 'Warning';
        }
        if (currentPage === 'Dashboard') renderApp();
    }, (error) => { console.error("Error fetching O&M Log:", error); });

    // --- Listener for Water Quality ---
    onSnapshot(qualityQuery, (snapshot) => {
        const latestQuality = snapshot.docs[0]?.data();
        if (latestQuality) {
            const latestDate = latestQuality.timestamp ? new Date(latestQuality.timestamp.toDate()).toLocaleDateString() : 'N/A';
            appData.lastQualityCheck = latestDate;
            
            // Compliance Check
            if (latestQuality.chlorineLevel < 0.2 || latestQuality.pH < 6.5 || latestQuality.pH > 8.5) {
                appData.qualityCompliance = 'Non-Compliant';
                appData.systemStatus = 'Fault'; // Override system status if quality fails
            } else {
                appData.qualityCompliance = 'Compliant';
            }
        } else {
            appData.qualityCompliance = 'Needs Check';
        }
        if (currentPage === 'Dashboard') renderApp();
    }, (error) => { console.error("Error fetching Water Quality:", error); });
    
    // --- Listener for Faults ---
    unsubscribeDashboard = onSnapshot(faultQuery, (snapshot) => {
        const faults = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        appData.pendingFaults = faults.filter(f => f.status !== 'Resolved').length;
        
        const pendingFaults = faults.filter(f => f.status !== 'Resolved');
        const highPriorityFault = pendingFaults.find(f => f.priority === 'High');
        const latestReportedFault = highPriorityFault || pendingFaults[0];

        appData.lastFault = latestReportedFault ? {
            id: latestReportedFault.id,
            description: latestReportedFault.description,
            status: latestReportedFault.status
        } : { description: 'No outstanding issues.', status: 'Resolved' };

        if (appData.pendingFaults > 0) {
            appData.systemStatus = 'Warning';
        }
        
        if (currentPage === 'Dashboard') renderApp();
    }, (error) => { console.error("Error fetching Faults:", error); });
}

function setupFaultsListener() {
     if (!db || !userId || userId === 'development-fallback' || userId === 'timeout-fallback') return;
    if (unsubscribeFaults) unsubscribeFaults();

    const faultsListQuery = query(collection(db, getCollectionPath('Faults')), orderBy('timestamp', 'desc'));
    
    unsubscribeFaults = onSnapshot(faultsListQuery, (snapshot) => {
        // Update the faultsData state in the global store
        appData.faultsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (currentPage === 'Faults') renderApp();
    }, (error) => { console.error("Error fetching Faults List:", error); });
}

function setupAnalyticsListener() {
     if (!db || !userId || userId === 'development-fallback' || userId === 'timeout-fallback') return;

    // Fetch all O&M Logs (ordered by timestamp asc for graphing)
    const omQuery = query(collection(db, getCollectionPath('OMLogs')), orderBy('timestamp', 'asc'));
    // Fetch all Water Quality Reports (ordered by timestamp asc for graphing)
    const qualityQuery = query(collection(db, getCollectionPath('WaterQuality')), orderBy('timestamp', 'asc'));

    const omPromise = new Promise(resolve => {
         onSnapshot(omQuery, (snapshot) => {
            appData.omLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp ? d.data().timestamp.toDate() : null }));
            resolve();
        }, (error) => { console.error("Error fetching O&M Logs for Analytics:", error); resolve(); });
    });

    const qualityPromise = new Promise(resolve => {
        onSnapshot(qualityQuery, (snapshot) => {
            appData.qualityLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp ? d.data().timestamp.toDate() : null }));
            resolve();
        }, (error) => { console.error("Error fetching Quality Logs for Analytics:", error); resolve(); });
    });
    
    Promise.all([omPromise, qualityPromise]).then(() => {
        if (currentPage === 'Analytics') {
            renderApp(); 
        }
    });
}

// ----------------------------------------------------------------------
// 6. STARTUP EXECUTION
// ----------------------------------------------------------------------

initializeAppAndAuth().then(() => {
    // Initialization is finished, the app is already rendered within the promise chain.
    console.log("Jal-Mitra Application initialized.");

}).catch(error => {
    console.error("FATAL APP STARTUP ERROR:", error);
    // If the entire initialization failed (a fatal error like missing config), render the app 
    if (!isAuthReady) {
        isAuthReady = true; // Prevents renderApp() from exiting prematurely
        renderApp();
    }
});

// CRITICAL FALLBACK: If the onAuthStateChanged listener never fires due to any blocking reason,
// force the app to render the UI after 3 seconds.
setTimeout(() => {
    if (!isAuthReady) {
        console.warn("Forcing UI render after timeout (3s). Authentication likely stalled.");
        isAuthReady = true;
        userId = 'timeout-fallback'; // Assign a temporary ID
        renderApp();
        showModalMessage("App startup stalled. Running with temporary ID. Data will NOT save. Check console for JS errors.", 'error');
    }
}, 3000);