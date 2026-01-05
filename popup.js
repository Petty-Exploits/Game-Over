document.addEventListener("DOMContentLoaded", () => {
    let isAdmin = false;
    let hasAccess = true;
    const whitelistContainer = document.querySelector(".whitelist-container");
    const whitelistElement = document.getElementById("whitelist");
    const adminLoginButton = document.getElementById("adminLogin");
    const viewWhitelist = document.getElementById("viewWhitelist");
    const addUrl = document.getElementById("addUrl");
    const adminModal = document.getElementById("adminModal");
    const adminPasswordInput = document.getElementById("adminPassword");
    const submitPasswordButton = document.getElementById("submitPassword");
    const cancelPasswordButton = document.getElementById("cancelPassword");
    const checkboxGroup = document.querySelector(".checkbox-group");
    const fingerprintingCheckbox = document.getElementById("fingerprinting-enabled");
    const embedBlockingCheckbox = document.getElementById("embed-blocking-enabled");
    const wssBlockingCheckbox = document.getElementById("wss-blocking-enabled");
    const copyPasteCheckbox = document.getElementById("copy-paste-enabled");
    // NEW: ROM checkbox
    const romCheckbox = document.getElementById("rom-enabled");
    const logContainer = document.querySelector(".log-container");
    const logList = document.getElementById("logList");
    const clearLogsButton = document.getElementById("clearLogs");
    const adminLogoutButton = document.createElement("button");
    adminLogoutButton.id = "adminLogout";
    adminLogoutButton.textContent = "Admin Logout";
    adminLogoutButton.classList.add("hidden");
    document.body.appendChild(adminLogoutButton);

    if (!whitelistContainer || !whitelistElement || !adminLoginButton || !viewWhitelist || !addUrl ||
        !adminModal || !adminPasswordInput || !submitPasswordButton || !cancelPasswordButton ||
        !checkboxGroup || !fingerprintingCheckbox || !embedBlockingCheckbox || !wssBlockingCheckbox || 
        !copyPasteCheckbox || !romCheckbox || !logContainer || !logList || !clearLogsButton) {  // NEW: Include romCheckbox
        console.error('DOM elements missing');
        return;
    }

    const storedPasswordHash = "f2d6cbdc77e822bb31f79b1afda42155872a42d54489a09dee0cdf9b262f53d9";

    adminPasswordInput.addEventListener("copy", (e) => e.preventDefault());
    adminPasswordInput.addEventListener("cut", (e) => e.preventDefault());
    adminPasswordInput.addEventListener("contextmenu", (e) => e.preventDefault());

    adminLoginButton.addEventListener("click", () => {
        adminModal.classList.add("visible");
        adminPasswordInput.value = "";
        adminPasswordInput.focus();
    });

    submitPasswordButton.addEventListener("click", () => {
        const enteredPassword = adminPasswordInput.value;
        adminModal.classList.remove("visible");
        hashPassword(enteredPassword).then((enteredHash) => {
            if (enteredHash === storedPasswordHash) {
                isAdmin = true;
                chrome.storage.local.set({ adminLoggedIn: true });
                alert("Admin login successful!");
                updateButtonVisibility();
                renderWhitelist();
                loadSettings();
                loadLogs();
            } else {
                alert("Incorrect password.");
            }
        }).catch(() => {
            alert("An error occurred during login.");
        });
    });

    cancelPasswordButton.addEventListener("click", () => {
        adminModal.classList.remove("visible");
        adminPasswordInput.value = "";
    });

    adminLogoutButton.addEventListener("click", () => {
        isAdmin = false;
        chrome.storage.local.set({ adminLoggedIn: false }, () => {
            alert("Admin logged out.");
            updateButtonVisibility();
            whitelistContainer.classList.add("hidden");
            logContainer.classList.add("hidden");
            viewWhitelist.textContent = "View Whitelist";
            checkboxGroup.classList.add("hidden");
            renderWhitelist();
            loadLogs();
        });
    });

    function updateButtonVisibility() {
        adminLoginButton.classList.toggle("visible", !isAdmin);
        adminLoginButton.classList.toggle("hidden", isAdmin);
        adminLogoutButton.classList.toggle("visible", isAdmin);
        adminLogoutButton.classList.toggle("hidden", !isAdmin);
        addUrl.classList.toggle("visible", isAdmin);
        addUrl.classList.toggle("hidden", !isAdmin);
        viewWhitelist.classList.toggle("visible", isAdmin);
        viewWhitelist.classList.toggle("hidden", !isAdmin);
        checkboxGroup.classList.toggle("visible", isAdmin);
        checkboxGroup.classList.toggle("hidden", !isAdmin);
        logContainer.classList.toggle("visible", isAdmin);
        logContainer.classList.toggle("hidden", !isAdmin);
    }

    function loadSettings() {
        chrome.storage.local.get(["settings"], (result) => {
            const settings = result.settings || {
                fingerprintingEnabled: true,
                embedBlockingEnabled: true,
                wssBlockingEnabled: true,
                copyPasteEnabled: true,
                romEnabled: true  // NEW: Default to enabled
            };
            fingerprintingCheckbox.checked = settings.fingerprintingEnabled;
            embedBlockingCheckbox.checked = settings.embedBlockingEnabled;
            wssBlockingCheckbox.checked = settings.wssBlockingEnabled;
            copyPasteCheckbox.checked = settings.copyPasteEnabled;
            romCheckbox.checked = settings.romEnabled;  // NEW
            console.debug("loadSettings:", settings);
        });
    }

    function saveSettings() {
        const settings = {
            fingerprintingEnabled: fingerprintingCheckbox.checked,
            embedBlockingEnabled: embedBlockingCheckbox.checked,
            wssBlockingEnabled: wssBlockingCheckbox.checked,
            copyPasteEnabled: copyPasteCheckbox.checked,
            romEnabled: romCheckbox.checked  // NEW
        };
        chrome.storage.local.set({ settings });
        console.debug("saveSettings:", settings);
    }

    function loadLogs() {
        chrome.storage.local.get(['blockLogs'], (result) => {
            const logs = result.blockLogs || [];
            logList.innerHTML = '';
            if (logs.length === 0) {
                const li = document.createElement('li');
                li.textContent = 'No block events logged.';
                logList.appendChild(li);
            } else {
                logs.forEach(log => {
                    const li = document.createElement('li');
                    li.className = 'log-entry';
                    li.innerHTML = `
                        <p><strong>URL:</strong> ${log.url}</p>
                        <p><strong>Pattern:</strong> ${log.pattern} (Flags: ${log.flags})</p>
                        <p><strong>Element:</strong> ${log.element}</p>
                        <p><strong>Reason:</strong> ${log.reason}</p>
                        <p><strong>Time:</strong> ${new Date(log.timestamp).toLocaleString()}</p>
                    `;
                    logList.appendChild(li);
                });
            }
        });
    }

    clearLogsButton.addEventListener('click', () => {
        chrome.storage.local.set({ blockLogs: [] }, () => {
            loadLogs();
        });
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'newBlockLog') {
            loadLogs();
        }
    });

    fingerprintingCheckbox.addEventListener("change", saveSettings);
    embedBlockingCheckbox.addEventListener("change", saveSettings);
    wssBlockingCheckbox.addEventListener("change", saveSettings);
    copyPasteCheckbox.addEventListener("change", saveSettings);
    // NEW: ROM event listener
    romCheckbox.addEventListener("change", saveSettings);

    function renderWhitelist() {
        chrome.storage.local.get(["whitelist"], (result) => {
            const whitelist = result.whitelist || [];
            whitelistElement.innerHTML = "";
            console.debug("renderWhitelist: whitelist=", whitelist);
            if (whitelist.length === 0) {
                const listItem = document.createElement("li");
                listItem.textContent = "No URLs in whitelist";
                whitelistElement.appendChild(listItem);
            } else {
                whitelist.forEach((url) => {
                    const listItem = document.createElement("li");
                    listItem.textContent = url;
                    if (isAdmin) {
                        const removeButton = document.createElement("button");
                        removeButton.textContent = "Remove";
                        removeButton.className = "remove-button";
                        removeButton.addEventListener("click", () => removeUrl(url));
                        listItem.appendChild(removeButton);
                    }
                    whitelistElement.appendChild(listItem);
                });
            }
        });
    }

    function removeUrl(url) {
        chrome.storage.local.get(["whitelist"], (result) => {
            const whitelist = result.whitelist.filter((item) => item !== url);
            chrome.storage.local.set({ whitelist }, () => {
                console.debug("removeUrl:", url);
                renderWhitelist();
            });
        });
    }

    addUrl.addEventListener("click", () => {
        if (isAdmin) {
            const url = prompt("Enter the URL to add (e.g., *://example.com/*):");
            if (url) {
                chrome.storage.local.get(["whitelist"], (result) => {
                    const whitelist = result.whitelist || [];
                    if (!whitelist.includes(url)) {
                        whitelist.push(url);
                        chrome.storage.local.set({ whitelist }, () => {
                            console.debug("addUrl:", url);
                            renderWhitelist();
                        });
                    }
                });
            }
        } else {
            alert("Admin login required to add URLs.");
        }
    });

    viewWhitelist.addEventListener("click", () => {
        if (!isAdmin) {
            alert("Admin login required to view whitelist.");
            return;
        }
        toggleWhitelist();
    });

    function toggleWhitelist() {
        const isShowingWhitelist = whitelistContainer.classList.contains("visible");
        whitelistContainer.classList.toggle("hidden", isShowingWhitelist);
        whitelistContainer.classList.toggle("visible", !isShowingWhitelist);
        viewWhitelist.textContent = isShowingWhitelist ? "View Whitelist" : "Hide Whitelist";
        console.debug(`toggleWhitelist: isShowingWhitelist=${isShowingWhitelist}, visible=${!isShowingWhitelist}`);
        renderWhitelist();
    }

    chrome.storage.local.get('darkMode', (result) => {
        if (result.darkMode) {
            document.body.classList.add('dark-mode');
            adminModal.querySelector('.modal-content').classList.add('dark-mode');
        }
    });

    document.getElementById("darkModeToggle").addEventListener("click", () => {
        const isDarkMode = document.body.classList.toggle("dark-mode");
        const modalContent = adminModal.querySelector('.modal-content');
        modalContent.classList.toggle('dark-mode', isDarkMode);
        chrome.storage.local.set({ darkMode: isDarkMode });
    });

    updateButtonVisibility();
    chrome.storage.local.get("adminLoggedIn", (result) => {
        if (result.adminLoggedIn) {
            isAdmin = true;
            updateButtonVisibility();
            renderWhitelist();
            loadSettings();
            loadLogs();
        }
    });
});

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function typewriterEffect() {
    const container = document.getElementById("typewriter");
    container.innerHTML = '<div class="made-by"></div><div class="script-content"></div>';
    const madeByContainer = container.querySelector(".made-by");
    const scriptContainer = container.querySelector(".script-content");

    madeByContainer.classList.add("typewriter-green");
    scriptContainer.classList.add("typewriter-green");
    container.style.fontFamily = "'Courier New', Courier, monospace";
    container.style.maxHeight = "400px";
    container.style.overflowY = "auto";
    container.style.width = "100%";
    container.style.fontSize = "10px";

    const madeByMessage = "Made by: Petty\n\n";
    let charIndex = 0;

    function typeMessage() {
        if (charIndex < madeByMessage.length) {
            madeByContainer.textContent += madeByMessage.charAt(charIndex);
            container.scrollTop = container.scrollHeight;
            charIndex++;
            setTimeout(typeMessage, 100);
        } else {
            showBlinkingCursor();
        }
    }

    function showBlinkingCursor() {
        scriptContainer.innerHTML = '<div class="line">|</div>';
        let isVisible = true;
        const cursorDiv = scriptContainer.querySelector(".line");
        const blinkInterval = setInterval(() => {
            if (isVisible) {
                cursorDiv.textContent = cursorDiv.textContent.slice(0, -1);
            } else {
                cursorDiv.textContent += "|";
            }
            isVisible = !isVisible;
        }, 500);

        setTimeout(() => {
            clearInterval(blinkInterval);
            scriptContainer.innerHTML = "";
            scriptContainer.classList.replace("typewriter-green", "typewriter-red");
            displayBeeMovieScript();
        }, 3000);
    }

    function displayBeeMovieScript() {
        const beeMovieScript = `
Loading Bee Movie Script . . .

0% 
6% 
19% 
34%
42% 
50% 
69%     "Nice"
81% 
98% 
100%   Success

According to all known laws of aviation, there is no way a bee should be able to fly. Its wings are too small to get its fat little body off the ground. The bee, of course, flies anyway because bees don't care what humans think is impossible.

BARRY BENSON: (V.O.) Yellow, black. Yellow, black. Yellow, black. Yellow, black. Ooh, black and yellow! Let's shake it up a little.

(Barry is seen getting ready in his hive, brushing his teeth with honey, and putting on his jacket.)

BARRY: Janet, your son's not sure he wants to go into honey!

JANET BENSON: Barry, you are so funny sometimes.

BARRY: I'm not trying to be funny.

(Barry flies out of the hive and into the bustling bee city.)

BARRY: (V.O.) You're not funny, you're going into honey. Our son, the stirrer!

MARTIN BENSON: You're gonna be a stirrer?

BARRY: No one's listening to me!

JANET: Wait till you see the sticks I have.

BARRY: I could say anything right now. I'm gonna get an ant tattoo!

(Barry flies past other bees working in various jobs.)

BARRY: (V.O.) Let's open some honey and celebrate!

(The scene shifts to Barry flying through the bee city, passing by different bee industries.)

BARRY: Maybe I'll pierce my thorax. Shave my antennae. Shack up with a grasshopper. Get a gold tooth and call everybody "dawg"!

Do I clutter my script with all 1363 lines of the bee movie? Find out next week on Dragon Ball Z
        `;

        const lines = beeMovieScript.split('\n').filter(line => line.trim().length > 0);
        let lineIndex = 0;
        let charIndex = 0;

        function typeLine() {
            if (lineIndex >= lines.length) {
                lineIndex = 0;
                charIndex = 0;
                scriptContainer.innerHTML = '';
            }

            const currentLine = lines[lineIndex].trim();
            if (charIndex === 0) {
                scriptContainer.innerHTML = '<div class="line"></div>';
            }

            const lineDiv = scriptContainer.querySelector(".line");
            if (charIndex < currentLine.length) {
                lineDiv.textContent += currentLine.charAt(charIndex);
                container.scrollTop = container.scrollHeight;
                charIndex++;
                setTimeout(typeLine, 100);
            } else {
                setTimeout(() => {
                    scriptContainer.innerHTML = '';
                    lineIndex++;
                    charIndex = 0;
                    typeLine();
                }, 1000);
            }
        }

        typeLine();
    }

    typeMessage();
}

window.onload = typewriterEffect;
