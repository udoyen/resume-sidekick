// --- CONFIGURATION ---
const USER_PROFILE = {
  firstName: "George", lastName: "Udosen", email: "datameshprojects@gmail.com",
  phone: "8022211122", linkedin: "https://www.linkedin.com/in/george-udosen", city: "Lagos, Nigeria"
};

// --- ICONS (SVG Strings) ---
const ICON_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#16a34a" style="vertical-align: middle; margin-right: 4px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
const ICON_WARN  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#ca8a04" style="vertical-align: middle; margin-right: 4px;"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`;
const ICON_ERROR = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#dc2626" style="vertical-align: middle; margin-right: 4px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

// --- LOAD SETTINGS ---
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['profile'], (result) => {
    if (result.profile) {
      document.getElementById('firstName').value = result.profile.firstName || '';
      document.getElementById('lastName').value = result.profile.lastName || '';
      document.getElementById('email').value = result.profile.email || '';
      document.getElementById('phone').value = result.profile.phone || '';
      document.getElementById('city').value = result.profile.city || '';
      document.getElementById('linkedin').value = result.profile.linkedin || '';
    }
  });
});

// --- TOGGLE VIEWS ---
document.getElementById('toggleSettings').addEventListener('click', () => {
  const settings = document.getElementById('settingsView');
  const main = document.getElementById('mainView');
  const result = document.getElementById('resultView');
  
  if (settings.style.display === 'block') {
    settings.style.display = 'none';
    main.style.display = 'block';
  } else {
    settings.style.display = 'block';
    main.style.display = 'none';
    result.style.display = 'none';
  }
});

document.getElementById('openAppBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: "http://localhost:3000" });
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const profile = {
    firstName: document.getElementById('firstName').value,
    lastName: document.getElementById('lastName').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    city: document.getElementById('city').value,
    linkedin: document.getElementById('linkedin').value,
  };
  chrome.storage.local.set({ profile }, () => {
    // Use innerHTML to render the SVG
    document.getElementById('status').innerHTML = `${ICON_CHECK} Profile Saved!`;
    setTimeout(() => {
      document.getElementById('settingsView').style.display = 'none';
      document.getElementById('mainView').style.display = 'block';
      document.getElementById('status').innerHTML = "Ready.";
    }, 1000);
  });
});

// --- SCAN BUTTON ---
document.getElementById("scanBtn").addEventListener("click", async () => {
  const status = document.getElementById("status");
  status.innerHTML = "Scanning...";
  
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: scrapeSmart,
  }, async (results) => {
    if (!results || !results[0] || !results[0].result) {
      status.innerHTML = `${ICON_ERROR} Nothing found. Try highlighting text!`;
      return;
    }
    
    const text = results[0].result;
    
    // Show text in UI
    document.getElementById('resultView').style.display = 'block';
    const textArea = document.getElementById('scannedText');
    textArea.value = text;
    textArea.select();
    
    // Auto-Copy
    try {
      await navigator.clipboard.writeText(text);
      // HERE IS THE UPDATE YOU REQUESTED:
      status.innerHTML = `${ICON_CHECK} Copied! Click 'Open Resume Builder'`;
    } catch (err) {
      // AND HERE:
      status.innerHTML = `${ICON_WARN} Auto-copy blocked. Copy text manually above.`;
    }
  });
});

// --- AUTO-FILL BUTTON ---
document.getElementById("fillBtn").addEventListener("click", async () => {
  const status = document.getElementById("status");
  chrome.storage.local.get(['profile'], async (result) => {
    if (!result.profile) {
      status.innerHTML = `${ICON_ERROR} Please save settings first.`;
      return;
    }
    status.innerHTML = "Auto-filling...";
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [result.profile],
      function: fillEasyApplyForm,
    }, (results) => {
      const count = results[0]?.result || 0;
      status.innerHTML = `${ICON_CHECK} Filled ${count} fields.`;
    });
  });
});

// --- INJECTED SCRIPTS ---
function scrapeSmart() {
  const cleanText = (text) => {
    if (!text) return "";
    return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const selection = window.getSelection().toString();
  if (selection && selection.length > 50) return cleanText(selection);

  const selectors = ["#job-details", ".jobs-description__content", ".jobs-box__html-content", ".job-view-layout .description", "article"];
  for (let s of selectors) {
    const el = document.querySelector(s);
    if (el && el.innerText.length > 50) return cleanText(el.innerText);
  }
  
  return cleanText(document.body.innerText).substring(0, 5000); 
}

function fillEasyApplyForm(profile) {
  const setNativeValue = (element, value) => {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
    if (valueSetter && valueSetter !== prototypeValueSetter) prototypeValueSetter.call(element, value);
    else valueSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const inputs = document.querySelectorAll('input, select, textarea');
  let filledCount = 0;
  inputs.forEach(input => {
    const label = (input.labels?.[0]?.innerText || input.getAttribute('aria-label') || input.name || "").toLowerCase();
    if (!label || input.type === 'hidden') return;
    
    let val = null;
    if (label.includes("first")) val = profile.firstName;
    else if (label.includes("last")) val = profile.lastName;
    else if (label.includes("email")) val = profile.email;
    else if (label.includes("phone") || label.includes("mobile")) val = profile.phone;
    else if (label.includes("city") || label.includes("location")) val = profile.city;
    else if (label.includes("linkedin")) val = profile.linkedin;

    if (val) { setNativeValue(input, val); filledCount++; input.style.border = "2px solid #16a34a"; }
  });
  return filledCount;
}