(function() {
   
    const currentUrl = window.location.href.toLowerCase();
    let storedWhitelist = [];
    let isWhitelisted = false;
    let isExempt = false;
    let domObserver = null;
    let intervalCheck = null;
    let pageBlocked = false;
    let settings = {
        fingerprintingEnabled: true,
        embedBlockingEnabled: true,
        wssBlockingEnabled: true,
        copyPasteEnabled: true,
        romEnabled: true
    };

    const exemptDomains = [
        "*.edu/*", "*.gov/*" //add whitelisted domains here
    ];

    const forceFingerprintDomains = [
        "*://*culinaryschools.org/kids-games*",
        "*://*gemini.google.com*",
        "*://*sites.google.com*"
    ];

    const suspiciousSrcDomains = [
        "atari-embeds.googleusercontent.com", "deev.is", "eaglercraft",
        "glitch.me", "herokuapp.com", "lax1dude",
        "netlify.app", "onrender.com", "railway.app", "replit.com",
        "replit.dev", "surge.sh", "vercel.app", "workers.dev"
    ];

    const fingerprintBlockPatterns = [
        /allow-pointer-lock/i, /allow\s*=\s*["']keyboard["']/i, /allow\s*=\s*["']pointer-lock["']/i,
        /data-embed.*(game|proxy|unblock)/i, /eaglercraft/i,
        /embed.*(proxy|unblock)/i, /encodeURIComponent\s*\(.*(proxy|game|unblock)/i,
        /game(?:\/|\\).*(proxy|hack|cheat|bot)/i, /gamecanvas/i, /holyunblocker/i,
        /lax1dude/i, /proxy\s*=\s*['"]/i, /proxy.*(http|url)/i,
        /requestFullscreen\s*\(/i, /toggleFullscreen\s*\(/i, /unblocker/i, /unblocked/i,
        /window\.eaglercraftopts/i,
        // NEW: ROM emulator/loader patterns
        /EJS_(player|gameUrl|core|biosUrl)/i,
        /emulatorjs\.com/i,
        /jsnes|jssnes/i,
        /\.nes$|\.gba$|\.sfc$/i,
        /rom.*loader/i,
        /emulator.*div/i,
        /unblocker\.io|unblocker\.cc/i,
        /proxy\s*[:=]\s*['"]https?:\/\//i,
        /fetch.*\/api\/translate/i,
        /emulator.*canvas/i
    ];

    const copyPasteBlockPatterns = [
        /allow-pointer-lock/i,
        /bypass/i, /eaglercraft/i, /embed.*(proxy|unblock)/i,
        /game(?:\/|\\).*(proxy|hack|cheat|bot)/i,
        /gamecanvas/i, /holyunblocker/i, /lax1dude/i, /proxy\s*=\s*['"]/i,
        /proxy.*(http|url)/i, /requestFullscreen\s*\(/i, /toggleFullscreen\s*\(/i,
        /unblocker/i, /unblocked/i, /window\.eaglercraftopts/i,
        // NEW: Mirror ROM patterns for copy-paste (prevents pasting ROM code)
        /EJS_(player|gameUrl|core|biosUrl)/i,
        /new\s+jsnes\.NES/i,
        /(nes|snes|gba|gb|md|lynx|psx)\.(?:js|wasm)/i,
        /loadRom|loadrom|nes\.loadROM|gba\.loadROM/i,
        /\.(nes|sfc|smc|gba|gb|gbc|z64|bin|cue).*?(rom|game)/i,
        /rom\s*(?:data|buffer|file)|base64.*rom/i,
        /emulator\s*(?:core|init|run)|nostalgist/i
    ];

    const asciiArt = `LIMITED EDUCATIONAL PURPOSE

The school district is providing students and employees with access to the school district computer system, which includes Internet access.  The purpose of the system is more specific than providing students and employees with general access to the Internet.  The school district system has a limited educational purpose, which includes use of the system for classroom activities, educational research, and professional or career development activities.  Users are expected to use Internet access through the district system to further educational and personal goals consistent with the mission of the school district and school policies. Uses which might be acceptable on a user’s private personal account on another system may not be acceptable on this limited-purpose network.

IV.	USE OF SYSTEM IS A PRIVILEGE

The use of the school district system and access to use of the Internet is a privilege, not a right.  Depending on the nature and degree of the violation and the number of previous violations, unacceptable use of the school district system or the Internet may result in one or more of the following consequences:  suspension or cancellation of use or access privileges; payments for damages and repairs; discipline under other appropriate school district policies, including suspension, expulsion, exclusion, or termination of employment; or civil or criminal liability under other applicable laws.

V.	UNACCEPTABLE USES

A.	The following uses of the school district system and Internet resources or accounts are considered unacceptable:

1.	Users will not use the school district system to access, review, upload, download, store, print, post, receive, transmit, or distribute:

a.	pornographic, obscene, or sexually explicit material or other visual depictions that are harmful to minors;

b.	obscene, abusive, profane, lewd, vulgar, rude, inflammatory, threatening, disrespectful, or sexually explicit language;

c.	materials that use language or images that are inappropriate in the education setting or disruptive to the educational process;

d.	information or materials that could cause damage or danger of disruption to the educational process;

e.	materials that use language or images that advocate violence or discrimination toward other people (hate literature) or that may constitute harassment or discrimination.

2.	Users will not use the school district system to knowingly or recklessly post, transmit, or distribute false or defamatory information about a person or organization, or to harass another person, or to engage in personal attacks, including prejudicial or discriminatory attacks.

3.	Users will not use the school district system to engage in any illegal act or violate any local, state, or federal statute or law.

4.	Users will not use the school district system to vandalize, damage, or disable the property of another person or organization, will not make deliberate attempts to degrade or disrupt equipment, software, or system performance by spreading computer viruses or by any other means, will not tamper with, modify, or change the school district system software, hardware, or wiring or take any action to violate the school district’s security  system, and will not use the school district system in such a way as to disrupt the use of the system by other users.

5.	Users will not use the school district system to gain unauthorized access to information resources or to access another person’s materials, information, or files without the implied or direct permission of that person.

6.	Users will not use the school district system to post private information about another person, personal contact information about themselves or other persons, or other personally identifiable information, including, but not limited to, addresses, telephone numbers, school addresses, work addresses, identification numbers, account numbers, access codes or passwords, labeled photographs, or other information that would make the individual’s identity easily traceable, and will not repost a message that was sent to the user privately without permission of the person who sent the message.   `;

    // Message mapping for different violation reasons
    const violationMessages = {
        "Suspicious eval execution detected": {
            title: "Suspicious Code Execution Blocked",
            description: "This page was blocked because it attempted to execute suspicious code (via eval) that may bypass school internet policies, such as proxy or game-related scripts.",
            action: "If you believe this is an error, contact your school’s IT department with the URL and the reason 'Suspicious eval execution detected' for review."
        },
        "Suspicious Function execution detected": {
            title: "Suspicious Function Execution Blocked",
            description: "This page was blocked due to a suspicious function execution that could be related to unauthorized proxies or games.",
            action: "Report this to your school’s tech support with the URL and the reason 'Suspicious Function execution detected' if you think this is a mistake."
        },
        "Suspicious paste detected": {
            title: "Suspicious Paste Attempt Blocked",
            description: "The content you attempted to paste was blocked because it contains code related to games, proxies, or ROM emulators, which violates school policies.",
            action: "If this was unintentional, contact your school’s IT support with the URL and the reason 'Suspicious paste detected' for assistance."
        },
        "Suspicious copy detected": {
            title: "Suspicious Copy Attempt Blocked",
            description: "The content you attempted to copy was blocked because it contains code related to games, proxies, or ROM emulators, which is not allowed under school policies.",
            action: "If you believe this is an error, report it to your school’s tech support with the URL and the reason 'Suspicious copy detected'."
        },
        "Failed to write to clipboard during paste": {
            title: "Clipboard Operation Failed",
            description: "An attempt to modify the clipboard during a paste operation failed, possibly due to suspicious content related to games or proxies.",
            action: "Contact your school’s IT department with the URL and the reason 'Failed to write to clipboard during paste' for further inspection."
        },
        "Failed to write to clipboard during copy": {
            title: "Clipboard Operation Failed",
            description: "An attempt to modify the clipboard during a copy operation failed, possibly due to suspicious content related to games or proxies.",
            action: "Contact your school’s IT department with the URL and the reason 'Failed to write to clipboard during copy' for further inspection."
        },
        "Suspicious manual input detected": {
            title: "Suspicious Input Blocked",
            description: "The text you entered was blocked because it contains suspicious code related to games, proxies, or emulators, which violates school internet policies.",
            action: "If this is a mistake, contact your school’s tech support with the URL and the reason 'Suspicious manual input detected' for review."
        },
        "Iframe with suspicious src detected": {
            title: "Suspicious Iframe Blocked",
            description: "This page was blocked because it contains an iframe with a source linked to a suspicious domain, potentially used for unauthorized games or proxies.",
            action: "Report this to your school’s IT support with the URL and the reason 'Iframe with suspicious src detected' if you believe this is an error."
        },
        "Suspicious iframe injection detected": {
            title: "Suspicious Iframe Injection Blocked",
            description: "This page was blocked due to an iframe injection that may be attempting to load unauthorized content, such as games or proxies.",
            action: "Contact your school’s IT department with the URL and the reason 'Suspicious iframe injection detected' for further inspection."
        },
        "ROM file load detected": {
            title: "ROM File Load Blocked",
            description: "This page was blocked because it attempted to load a ROM file, which is not permitted under school internet policies.",
            action: "If you think this is a mistake, report it to your school’s tech support with the URL and the reason 'ROM file load detected'."
        },
        "Suspicious iframe attribute change detected": {
            title: "Suspicious Iframe Change Blocked",
            description: "This page was blocked due to a suspicious change in an iframe’s attributes, potentially related to unauthorized content like games or proxies.",
            action: "Contact your school’s IT support with the URL and the reason 'Suspicious iframe attribute change detected' for review."
        },
        "Suspicious iframe detected": {
            title: "Suspicious Iframe Blocked",
            description: "This page was blocked because it contains an iframe with suspicious attributes or content, potentially related to games or proxies.",
            action: "Report this to your school’s IT department with the URL and the reason 'Suspicious iframe detected' if you believe this is an error."
        },
        "Existing iframe with suspicious src detected": {
            title: "Suspicious Iframe Blocked",
            description: "This page was blocked because an existing iframe contains a source linked to a suspicious domain, potentially used for unauthorized games or proxies.",
            action: "Contact your school’s IT support with the URL and the reason 'Existing iframe with suspicious src detected' if you think this is a mistake."
        },
        "ROM emulator canvas detected": {
            title: "ROM Emulator Canvas Blocked",
            description: "This page was blocked because it contains a canvas element commonly used by ROM emulators, which violates school internet policies.",
            action: "If you believe this is an error, report it to your school’s tech support with the URL and the reason 'ROM emulator canvas detected'."
        },
        "Suspicious script detected": {
            title: "Suspicious Script Blocked",
            description: "This page was blocked because it contains a script that may be attempting to bypass school internet policies, such as proxy or game-related scripts.",
            action: "If you believe this is an error, contact your school’s IT department with the URL and the reason 'Suspicious script detected' for review."
        },
        "ROM emulator script detected": {
            title: "ROM Emulator Script Blocked",
            description: "This page was blocked due to a script associated with a ROM emulator, which is not permitted under school internet policies.",
            action: "If you think this is a mistake, report it to your school’s tech support with the URL and the reason 'ROM emulator script detected'."
        },
        "Suspicious game element detected": {
            title: "Unauthorized Game Content Blocked",
            description: "This page was blocked because it contains elements associated with unauthorized games, such as game canvases or specific game frameworks.",
            action: "Contact your school’s IT support with the URL and the reason 'Suspicious game element detected' if you believe this is a false positive."
        },
        "ROM loader element detected": {
            title: "ROM Emulator Loader Blocked",
            description: "This page was blocked due to the presence of a ROM emulator or loader element, which is not permitted under school internet policies.",
            action: "If you think this is a mistake, please report it to your school’s tech support with the URL and the reason 'ROM loader element detected'."
        },
        "default": {
            title: "Policy Violation Detected",
            description: "This page was blocked due to a potential violation of school internet usage policies. The specific reason is: ${reason}.",
            action: "If you think this is a false positive, bring it to your school tech support with the URL and the reason provided for inspection."
        }
    };

    isExempt = exemptDomains.some(pattern => {
        const regexPattern = pattern
            .replace(/[-[\]{}()+?.,\\^$|#\s]/g, "\\$&")
            .replace(/\*/g, ".*");
        const regex = new RegExp(`^${regexPattern}$`, "i");
        return regex.test(currentUrl);
    });

    function loadWhitelistAndSettings(callback) {
        chrome.storage.local.get(["whitelist", "settings"], (result) => {
            if (chrome.runtime.lastError) {
                storedWhitelist = exemptDomains;
                updateWhitelistStatus();
                callback();
                return;
            }
            storedWhitelist = result.whitelist || exemptDomains;
            if (result.settings) {
                settings.fingerprintingEnabled = result.settings.fingerprintingEnabled;
                settings.embedBlockingEnabled = result.settings.embedBlockingEnabled;
                settings.wssBlockingEnabled = result.settings.wssBlockingEnabled;
                settings.copyPasteEnabled = result.settings.copyPasteEnabled;
                settings.romEnabled = result.settings.romEnabled !== undefined ? result.settings.romEnabled : true;
            }
            updateWhitelistStatus();
            callback();
        });
    }

    function updateWhitelistStatus() {
        isWhitelisted = isExempt || isWhitelistedUrl(currentUrl, storedWhitelist);
    }

    function isWhitelistedUrl(url, whitelist) {
        return whitelist.some(pattern => {
            const regexPattern = pattern
                .replace(/[-[\]{}()+?.,\\^$|#\s]/g, "\\$&")
                .replace(/\*/g, ".*");
            const regex = new RegExp(`^${regexPattern}$`, "i");
            return regex.test(url);
        });
    }

    function logBlockEvent(reason, details = {}) {
        if (isWhitelisted || isExempt) return;
        const logEntry = {
            url: currentUrl,
            reason,
            timestamp: Date.now(),
            pattern: details.pattern || 'N/A',
            element: details.element || 'N/A',
            flags: details.flags || 'N/A',
            attributes: details.attributes || 'N/A'
        };
        chrome.storage.local.get(['blockLogs'], (result) => {
            const logs = result.blockLogs || [];
            logs.push(logEntry);
            if (logs.length > 100) logs.shift();
            chrome.storage.local.set({ blockLogs: logs }, () => {
                chrome.runtime.sendMessage({ type: 'newBlockLog', log: logEntry });
            });
        });
    }

    const originalEval = window.eval;
    window.eval = function (code) {
        if (!settings.fingerprintingEnabled) return originalEval(code);
        const shouldFingerprint = forceFingerprintDomains.some(domain => {
            const regexPattern = domain.replace(/[-[\]{}()+?.,\\^$|#\s]/g, "\\$&").replace(/\*/g, ".*");
            const regex = new RegExp(`^${regexPattern}$`, "i");
            return regex.test(currentUrl);
        }) ? true : (!isWhitelisted && !isExempt);        if (shouldFingerprint && fingerprintBlockPatterns.some(rx => rx.test(code.toLowerCase()))) {
            const matchedPattern = fingerprintBlockPatterns.find(rx => rx.test(code.toLowerCase()))?.toString() || 'N/A';
            logBlockEvent("Suspicious eval execution detected", { 
                type: "eval",
                pattern: matchedPattern,
                element: 'eval',
                flags: 'N/A'
            });
            blockPage("Suspicious eval execution detected");
        }
        return originalEval(code);
    };

    const originalFunction = window.Function;
    window.Function = function (...args) {
        if (!settings.fingerprintingEnabled) return originalFunction.apply(this, args);
        const code = args[args.length - 1];
        const shouldFingerprint = !isExempt && (!isWhitelisted || forceFingerprintDomains.some(domain => currentUrl.includes(domain)));
        if (shouldFingerprint && fingerprintBlockPatterns.some(rx => rx.test(code.toLowerCase()))) {
            const matchedPattern = fingerprintBlockPatterns.find(rx => rx.test(code.toLowerCase()))?.toString() || 'N/A';
            logBlockEvent("Suspicious Function execution detected", { 
                type: "function",
                pattern: matchedPattern,
                element: 'Function',
                flags: 'N/A'
            });
            blockPage("Suspicious Function execution detected");
        }
        return originalFunction.apply(this, args);
    };

    let hasPasteAlerted = false;
    document.addEventListener("paste", (e) => {
        if (hasPasteAlerted || !settings.copyPasteEnabled) return;
        const text = (e.clipboardData?.getData("text") || "").toLowerCase();
        const isSuspicious = copyPasteBlockPatterns.some(rx => rx.test(text));
        if (isSuspicious) {
            e.stopImmediatePropagation();
            e.preventDefault();
            navigator.clipboard.writeText(`[${asciiArt.trim()}]`).then(() => {
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.isContentEditable)) {
                    if (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA") {
                        const start = activeElement.selectionStart || 0;
                        const end = activeElement.selectionEnd || 0;
                        const value = activeElement.value || "";
                        activeElement.value = value.substring(0, start) + `[${asciiArt.trim()}]` + value.substring(end);
                        activeElement.selectionStart = activeElement.selectionEnd = start + `[${asciiArt.trim()}]`.length;
                    } else {
                        document.execCommand("insertText", false, `[${asciiArt.trim()}]`);
                    }
                }
                const matchedPattern = copyPasteBlockPatterns.find(rx => rx.test(text))?.toString() || 'N/A';
                logBlockEvent("Suspicious paste detected", { 
                    type: "paste", 
                    text: text.substring(0, 100),
                    pattern: matchedPattern,
                    element: activeElement?.tagName || 'N/A',
                    flags: 'N/A'
                });
            }).catch(err => {
                logBlockEvent("Failed to write to clipboard during paste", { 
                    type: "paste_error", 
                    error: err.message,
                    pattern: 'N/A',
                    element: 'N/A',
                    flags: 'N/A'
                });
            });
            hasPasteAlerted = true;
            alert("Pasting of game/proxy code detected and replaced.");
            setTimeout(() => { hasPasteAlerted = false; }, 1000);
        }
    }, true);

    let hasCopyAlerted = false;
    document.addEventListener("copy", (e) => {
        if (hasCopyAlerted || !settings.copyPasteEnabled) return;
        let text = "";
        if (e.clipboardData) {
            const selection = window.getSelection();
            text = selection && !selection.isCollapsed ? selection.toString().toLowerCase() : "";
        }
        const isSuspicious = text && copyPasteBlockPatterns.some(rx => rx.test(text));
        if (isSuspicious) {
            e.stopImmediatePropagation();
            e.preventDefault();
            if (e.clipboardData) {
                e.clipboardData.setData("text/plain", `[${asciiArt.trim()}]`);
                const matchedPattern = copyPasteBlockPatterns.find(rx => rx.test(text))?.toString() || 'N/A';
                logBlockEvent("Suspicious copy detected", { 
                    type: "copy",
                    text: text.substring(0, 100),
                    pattern: matchedPattern,
                    element: 'selection',
                    flags: 'copy'
                });
                hasCopyAlerted = true;
                alert("Copying of game/proxy code detected and replaced with cursed text.");
                setTimeout(() => { hasCopyAlerted = false; }, 1000);
            } else {
                navigator.clipboard.writeText(`[${asciiArt.trim()}]`).then(() => {
                    const matchedPattern = copyPasteBlockPatterns.find(rx => rx.test(text))?.toString() || 'N/A';
                    logBlockEvent("Suspicious copy detected", { 
                        type: "copy",
                        text: text.substring(0, 100),
                        pattern: matchedPattern,
                        element: 'selection',
                        flags: 'copy'
                    });
                }).catch(err => {
                    logBlockEvent("Failed to write to clipboard during copy", { 
                        type: "copy_error",
                        error: err.message,
                        pattern: 'N/A',
                        element: 'N/A',
                        flags: 'N/A'
                    });
                });
                hasCopyAlerted = true;
                alert("Copying of game/proxy code detected and replaced with cursed text.");
                setTimeout(() => { hasCopyAlerted = false; }, 1000);
            }
        }
    }, { capture: true, passive: false });

    function setupListeners() {
        if (!document.body) {
            setTimeout(() => setupListeners(), 100);
            return;
        }
            // Skip setup entirely for whitelisted/exempt pages unless forced fingerprint applies
        const isForcedFingerprint = forceFingerprintDomains.some(domain => {
            const regexPattern = domain.replace(/[-[\]{}()+?.,\\^$|#\s]/g, "\\$&").replace(/\*/g, ".*");
            const regex = new RegExp(`^${regexPattern}$`, "i");
            return regex.test(currentUrl);
        });
        if ((isWhitelisted || isExempt) && !isForcedFingerprint) {
            console.debug("[No Fun Allowed] Skipping fingerprint checks — site is whitelisted or exempt:", currentUrl);
            return;
        }


        const shouldFingerprint = !isExempt && (!isWhitelisted || forceFingerprintDomains.some(term => currentUrl.includes(term)));
        if (shouldFingerprint && settings.fingerprintingEnabled) {
            const typingBlockPatterns = fingerprintBlockPatterns;
            const editableElements = document.querySelectorAll("textarea, [contenteditable], input[type='text'], input[type='search']");
            editableElements.forEach(el => {
                el.addEventListener("input", (e) => {
                    if (!settings.fingerprintingEnabled) return;
                    const text = el.textContent?.toLowerCase() || el.value?.toLowerCase() || "";
                    if (typingBlockPatterns.some(rx => rx.test(text))) {
                        const matchedPattern = typingBlockPatterns.find(rx => rx.test(text))?.toString() || 'N/A';
                        logBlockEvent("Suspicious manual input detected", { 
                            type: "input", 
                            text: text.substring(0, 100),
                            pattern: matchedPattern,
                            element: el.tagName + (el.id ? `#${el.id}` : ''),
                            flags: 'N/A'
                        });
                        blockPage("Suspicious manual input detected");
                    }
                });
            });
        }

        let debounceTimer;
        const debounceTime = 200;
        domObserver = new MutationObserver((mutations) => {
            if ((isWhitelisted || isExempt) && !forceFingerprintDomains.some(domain => currentUrl.includes(domain))) return;

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (!settings.fingerprintingEnabled && !settings.embedBlockingEnabled || pageBlocked) return;
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const el = node;
                            const text = el.outerHTML?.toLowerCase() || "";
                            if (el.tagName === "IFRAME" && settings.embedBlockingEnabled) {
                                const src = el.src?.toLowerCase() || "";
                                const matchedDomain = suspiciousSrcDomains.find(domain => src.includes(domain));
                                if (matchedDomain) {
                                    logBlockEvent("Iframe with suspicious src detected", { 
                                        type: "iframe", 
                                        attributes: text.substring(0, 100),
                                        pattern: `domain:${matchedDomain}`,
                                        element: `IFRAME${el.id ? `#${el.id}` : ''}`,
                                        flags: src ? `src:${src}` : 'no-src',
                                        src: src || 'N/A',
                                        srcdoc: el.srcdoc?.substring(0, 50) || 'N/A'
                                    });
                                    blockPage("Iframe with suspicious src detected");
                                    return;
                                }
                                if (shouldFingerprint) {
                                    const flags = [];
                                    let pattern = 'N/A';
                                    const srcdocText = el.srcdoc?.toLowerCase() || "";
                                    const matchedPattern = fingerprintBlockPatterns.find(rx => rx.test(text) || rx.test(srcdocText));
                                    if (matchedPattern) {
                                        pattern = matchedPattern.toString().replace(/^\/|\/[a-z]*$/gi, '');
                                        flags.push(pattern);
                                        if (el.srcdoc || text.includes("srcdoc")) flags.push("srcdoc");
                                        logBlockEvent("Suspicious iframe injection detected", { 
                                            type: "iframe", 
                                            attributes: text.substring(0, 100),
                                            pattern,
                                            element: `IFRAME${el.id ? `#${el.id}` : ''}`,
                                            flags: flags.join(','),
                                            src: src || 'N/A',
                                            srcdoc: el.srcdoc?.substring(0, 50) || 'N/A'
                                        });
                                        blockPage("Suspicious iframe injection detected");
                                        return;
                                    }
                                    if (settings.romEnabled) {
                                        const romExtMatch = /\.(nes|sfc|smc|gba|gb|gbc|z64|bin|cue|zip)(?:\?|$)/i;
                                        if ((src.match(romExtMatch) || srcdocText.match(romExtMatch)) && !isWhitelisted) {
                                            logBlockEvent("ROM file load detected", { 
                                                type: "iframe_rom", 
                                                attributes: src.substring(0, 100),
                                                pattern: 'rom-extension',
                                                element: `IFRAME${el.id ? `#${el.id}` : ''}`,
                                                flags: flags.join(','),
                                                src: src || 'N/A',
                                                srcdoc: el.srcdoc?.substring(0, 50) || 'N/A'
                                            });
                                            blockPage("ROM file load detected");
                                            return;
                                        }
                                    }
                                    if (settings.debugMode && (text.includes("allow-pointer-lock") || text.includes("allow='pointer-lock'") || el.srcdoc || srcdocText)) {
                                        const debugPattern = fingerprintBlockPatterns.find(rx => rx.test(srcdocText))?.toString().replace(/^\/|\/[a-z]*$/gi, '') || 'N/A';
                                        logBlockEvent("Unblocked iframe detected (debug)", { 
                                            type: "iframe_debug",
                                            attributes: text.substring(0, 100),
                                            pattern: debugPattern,
                                            element: `IFRAME${el.id ? `#${el.id}` : ''}`,
                                            flags: (text.includes("allow-pointer-lock") || text.includes("allow='pointer-lock'")) ? 'allow-pointer-lock' : srcdocText ? 'srcdoc' : 'none',
                                            src: src || 'N/A',
                                            srcdoc: el.srcdoc?.substring(0, 50) || 'N/A'
                                        });
                                    }
                                }
                            } else if (el.tagName === "SCRIPT" && shouldFingerprint && settings.fingerprintingEnabled) {
                                const content = el.textContent?.toLowerCase() || "";
                                let matchedPattern = null;
                                let isRomPattern = false;
                                if (settings.romEnabled) {
                                    matchedPattern = fingerprintBlockPatterns.find(rx => rx.test(content) && 
                                        (rx.source.includes('EJS') || rx.source.includes('jsnes') || rx.source.includes('nes') || 
                                         rx.source.includes('loadRom') || rx.source.includes('rom') || rx.source.includes('emulator') || 
                                         rx.source.includes('onFrame')))?.toString();
                                    isRomPattern = !!matchedPattern;
                                }
                                if (!matchedPattern) {
                                    matchedPattern = fingerprintBlockPatterns.find(rx => rx.test(content))?.toString();
                                }
                                if (matchedPattern) {
                                    const reason = isRomPattern ? "ROM emulator script detected" : "Suspicious script detected";
                                    logBlockEvent(reason, { 
                                        type: "script", 
                                        attributes: content.substring(0, 100),
                                        pattern: matchedPattern,
                                        element: `SCRIPT${el.id ? `#${el.id}` : ''}`,
                                        flags: 'N/A',
                                        src: 'N/A',
                                        srcdoc: 'N/A'
                                    });
                                    blockPage(reason);
                                    return;
                                }
                            } else if (shouldFingerprint && settings.fingerprintingEnabled && (text.includes("gamecanvas") || text.includes("eagler") || text.includes("arcade"))) {
                                const pattern = text.includes("gamecanvas") ? "gamecanvas" : text.includes("eagler") ? "eagler" : "arcade";
                                logBlockEvent("Suspicious game element detected", { 
                                    type: "element",
                                    attributes: text.substring(0, 100),
                                    pattern,
                                    element: `${el.tagName}${el.id ? `#${el.id}` : ''}`,
                                    flags: 'N/A',
                                    src: 'N/A',
                                    srcdoc: 'N/A'
                                });
                                blockPage("Suspicious game element detected");
                                return;
                            } else if (shouldFingerprint && settings.fingerprintingEnabled && settings.romEnabled) {
                                if ((text.includes("rom loader") || text.includes("emulator div") || text.includes("gba emulator")) && 
                                    (text.includes(".nes") || text.includes(".gba"))) {
                                    const pattern = text.includes("rom loader") ? "rom-loader" : "emulator-div";
                                    logBlockEvent("ROM loader element detected", { 
                                        type: "div", 
                                        attributes: text.substring(0, 100),
                                        pattern,
                                        element: `DIV${el.id ? `#${el.id}` : ''}`,
                                        flags: 'N/A',
                                        src: 'N/A',
                                        srcdoc: 'N/A'
                                    });
                                    blockPage("ROM loader element detected");
                                    return;
                                }
                            }
                        }
                    }
                    if (mutation.type === "attributes" && mutation.target.tagName === "IFRAME" && settings.embedBlockingEnabled) {
                        const src = mutation.target.src?.toLowerCase() || "";
                        const matchedDomain = suspiciousSrcDomains.find(domain => src.includes(domain));
                        if (matchedDomain) {
                            logBlockEvent("Suspicious iframe src on attribute change", { 
                                type: "iframe", 
                                attributes: mutation.target.outerHTML?.substring(0, 100) || 'N/A',
                                pattern: `domain:${matchedDomain}`,
                                element: `IFRAME${mutation.target.id ? `#${mutation.target.id}` : ''}`,
                                flags: src ? `src:${src}` : 'no-src',
                                src: src || 'N/A',
                                srcdoc: mutation.target.srcdoc?.substring(0, 50) || 'N/A'
                            });
                            blockPage("Suspicious iframe src on attribute change detected");
                            return;
                        }
                        if (shouldFingerprint) {
                            const text = mutation.target.outerHTML?.toLowerCase() || "";
                            const srcdocText = mutation.target.srcdoc?.toLowerCase() || "";
                            const flags = [];
                            let pattern = 'N/A';
                            const matchedPattern = fingerprintBlockPatterns.find(rx => rx.test(text) || rx.test(srcdocText));
                            if (matchedPattern) {
                                pattern = matchedPattern.toString().replace(/^\/|\/[a-z]*$/gi, '');
                                flags.push(pattern);
                                if (mutation.target.srcdoc || text.includes("srcdoc")) flags.push("srcdoc");
                                logBlockEvent("Suspicious iframe attribute change detected", { 
                                    type: "iframe",
                                    attributes: text.substring(0, 100),
                                    pattern,
                                    element: `IFRAME${mutation.target.id ? `#${mutation.target.id}` : ''}`,
                                    flags: flags.join(','),
                                    src: src || 'N/A',
                                    srcdoc: mutation.target.srcdoc?.substring(0, 50) || 'N/A'
                                });
                                blockPage("Suspicious iframe attribute change detected");
                                return;
                            }
                            if (settings.romEnabled) {
                                const romExtMatch = /\.(nes|sfc|smc|gba|gb|gbc|z64|bin|cue|zip)(?:\?|$)/i;
                                if ((src.match(romExtMatch) || srcdocText.match(romExtMatch)) && !isWhitelisted) {
                                    logBlockEvent("ROM file load detected", { 
                                        type: "iframe_rom", 
                                        attributes: src.substring(0, 100),
                                        pattern: 'rom-extension',
                                        element: `IFRAME${mutation.target.id ? `#${mutation.target.id}` : ''}`,
                                        flags: flags.join(','),
                                        src: src || 'N/A',
                                        srcdoc: mutation.target.srcdoc?.substring(0, 50) || 'N/A'
                                    });
                                    blockPage("ROM file load detected");
                                    return;
                                }
                            }
                            if (settings.debugMode && (text.includes("allow-pointer-lock") || text.includes("allow='pointer-lock'") || mutation.target.srcdoc || srcdocText)) {
                                const debugPattern = fingerprintBlockPatterns.find(rx => rx.test(srcdocText))?.toString().replace(/^\/|\/[a-z]*$/gi, '') || 'N/A';
                                logBlockEvent("Unblocked iframe attribute change (debug)", { 
                                    type: "iframe_debug",
                                    attributes: text.substring(0, 100),
                                    pattern: debugPattern,
                                    element: `IFRAME${mutation.target.id ? `#${mutation.target.id}` : ''}`,
                                    flags: (text.includes("allow-pointer-lock") || text.includes("allow='pointer-lock'")) ? 'allow-pointer-lock' : srcdocText ? 'srcdoc' : 'none',
                                    src: src || 'N/A',
                                    srcdoc: mutation.target.srcdoc?.substring(0, 50) || 'N/A'
                                });
                            }
                        }
                    }
                }
            }, debounceTime);
        });

        if (document.body) {
            domObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["src", "sandbox", "srcdoc", "allow", "data-embed"],
                characterData: true
            });
        }

        const checkExistingElements = () => {
            if (pageBlocked || (!settings.fingerprintingEnabled && !settings.embedBlockingEnabled)) return;
            const srcdocText = document.documentElement.outerHTML.toLowerCase();
        
            if (shouldFingerprint && settings.fingerprintingEnabled && settings.romEnabled) {
                const canvases = document.getElementsByTagName("CANVAS");
                for (const canvas of canvases) {
                    const dims = `${canvas.width}x${canvas.height}`;
                    if ((dims === '256x240' || dims === '256x224' || dims === '240x160') && 
                        (srcdocText.includes('rom') || srcdocText.includes('emulator') || canvas.id?.toLowerCase().includes('game'))) {
                        logBlockEvent("ROM emulator canvas detected", { 
                            type: "canvas", 
                            attributes: `id="${canvas.id}" dims="${dims}"`,
                            pattern: 'emulator-canvas-size',
                            element: `CANVAS#${canvas.id}`,
                            flags: 'ROM dimensions',
                            src: 'N/A',
                            srcdoc: 'N/A'
                        });
                        blockPage("ROM emulator canvas detected");
                        return;
                    }
                }
            }
    
            const canvas = document.querySelector('canvas');
            const hasFullscreen = document.body.innerHTML.toLowerCase().includes('requestfullscreen');
            const hasGameText = /(game|play|start|level|score|coin|jump|shoot|player)/i.test(document.body.innerText);
        
            if (canvas && hasFullscreen && hasGameText && settings.fingerprintingEnabled) {
                logBlockEvent("Fullscreen game canvas detected", { 
                    type: "combo", 
                    canvas: canvas.id || canvas.className || "unnamed",
                    fullscreen: "requestFullscreen found",
                    keywords: "game/play/start/level/score"
                });
                blockPage("Suspicious game element detected");
                return;
            }

            const iframes = document.getElementsByTagName("IFRAME");
            for (const iframe of iframes) {
                const src = iframe.src?.toLowerCase() || "";
                const matchedDomain = suspiciousSrcDomains.find(domain => src.includes(domain));
                if (settings.embedBlockingEnabled && matchedDomain) {
                    logBlockEvent("Existing iframe with suspicious src detected", { 
                        type: "iframe", 
                        attributes: iframe.outerHTML?.substring(0, 100) || 'N/A',
                        pattern: `domain:${matchedDomain}`,
                        element: `IFRAME${iframe.id ? `#${iframe.id}` : ''}`,
                        flags: src ? `src:${src}` : 'no-src',
                        src: src || 'N/A',
                        srcdoc: iframe.srcdoc?.substring(0, 50) || 'N/A'
                    });
                    blockPage("Existing iframe with suspicious src detected");
                    return;
                }
                if (shouldFingerprint && settings.embedBlockingEnabled) {
                    const text = iframe.outerHTML?.toLowerCase() || "";
                    const srcdocText = iframe.srcdoc?.toLowerCase() || "";
                    const flags = [];
                    let pattern = 'N/A';
                    const matchedPattern = fingerprintBlockPatterns.find(rx => rx.test(text) || rx.test(srcdocText));
                    if (matchedPattern) {
                        pattern = matchedPattern.toString().replace(/^\/|\/[a-z]*$/gi, '');
                        flags.push(pattern);
                        if (iframe.srcdoc || text.includes("srcdoc")) flags.push("srcdoc");
                        logBlockEvent("Suspicious iframe detected", { 
                            type: "iframe", 
                            attributes: text.substring(0, 100),
                            pattern,
                            element: `IFRAME${iframe.id ? `#${iframe.id}` : ''}`,
                            flags: flags.join(','),
                            src: src || 'N/A',
                            srcdoc: iframe.srcdoc?.substring(0, 50) || 'N/A'
                        });
                        blockPage("Suspicious iframe detected");
                        return;
                    }
                    if (settings.romEnabled) {
                        const romExtMatch = /\.(nes|sfc|smc|gba|gb|gbc|z64|bin|cue|zip)(?:\?|$)/i;
                        if ((src.match(romExtMatch) || srcdocText.match(romExtMatch)) && !isWhitelisted) {
                            logBlockEvent("ROM file load detected", { 
                                type: "iframe_rom", 
                                attributes: src.substring(0, 100),
                                pattern: 'rom-extension',
                                element: `IFRAME${iframe.id ? `#${iframe.id}` : ''}`,
                                flags: flags.join(','),
                                src: src || 'N/A',
                                srcdoc: iframe.srcdoc?.substring(0, 50) || 'N/A'
                            });
                            blockPage("ROM file load detected");
                            return;
                        }
                    }
                    if (settings.debugMode) {
                        const debugPattern = fingerprintBlockPatterns.find(rx => rx.test(srcdocText))?.toString().replace(/^\/|\/[a-z]*$/gi, '') || 'N/A';
                        logBlockEvent("Unblocked existing iframe (debug)", { 
                            type: "iframe_debug",
                            attributes: text.substring(0, 100),
                            pattern: debugPattern,
                            element: `IFRAME${iframe.id ? `#${iframe.id}` : ''}`,
                            flags: (text.includes("allow-pointer-lock") || text.includes("allow='pointer-lock'")) ? 'allow-pointer-lock' : srcdocText ? 'srcdoc' : 'none',
                            src: src || 'N/A',
                            srcdoc: iframe.srcdoc?.substring(0, 50) || 'N/A'
                        });
                    }
                }
            }
            if (shouldFingerprint && settings.fingerprintingEnabled) {
                const scripts = document.getElementsByTagName("SCRIPT");
                for (const script of scripts) {
                    const content = script.textContent?.toLowerCase() || "";
                    let matchedPattern = null;
                    let isRomPattern = false;
                    if (settings.romEnabled) {
                        matchedPattern = fingerprintBlockPatterns.find(rx => rx.test(content) && 
                            (rx.source.includes('EJS') || rx.source.includes('jsnes') || rx.source.includes('nes') || 
                             rx.source.includes('loadRom') || rx.source.includes('rom') || rx.source.includes('emulator') || 
                             rx.source.includes('onFrame')))?.toString();
                        isRomPattern = !!matchedPattern;
                    }
                    if (!matchedPattern) {
                        matchedPattern = fingerprintBlockPatterns.find(rx => rx.test(content))?.toString();
                    }
                    if (matchedPattern) {
                        const reason = isRomPattern ? "ROM emulator script detected" : "Suspicious script detected";
                        logBlockEvent(reason, { 
                            type: "script", 
                            attributes: content.substring(0, 100),
                            pattern: matchedPattern,
                            element: `SCRIPT${script.id ? `#${script.id}` : ''}`,
                            flags: 'N/A',
                            src: 'N/A',
                            srcdoc: 'N/A'
                        });
                        blockPage(reason);
                        return;
                    }
                }
                const divs = document.getElementsByTagName("DIV");
                for (const div of divs) {
                    const text = div.outerHTML?.toLowerCase() || "";
                    if (text.includes("gamecanvas") || text.includes("eagler")) {
                        const pattern = text.includes("gamecanvas") ? "gamecanvas" : "eagler";
                        logBlockEvent("Suspicious game element detected", { 
                            type: "div", 
                            attributes: text.substring(0, 100),
                            pattern,
                            element: `DIV${div.id ? `#${div.id}` : ''}`,
                            flags: 'N/A',
                            src: 'N/A',
                            srcdoc: 'N/A'
                        });
                        blockPage("Suspicious game element detected");
                        return;
                    }
                    if (settings.romEnabled) {
                        if ((text.includes("rom loader") || text.includes("emulator div") || text.includes("gba emulator")) && 
                            (text.includes(".nes") || text.includes(".gba"))) {
                            const pattern = text.includes("rom loader") ? "rom-loader" : "emulator-div";
                            logBlockEvent("ROM loader element detected", { 
                                type: "div", 
                                attributes: text.substring(0, 100),
                                pattern,
                                element: `DIV${div.id ? `#${div.id}` : ''}`,
                                flags: 'N/A',
                                src: 'N/A',
                                srcdoc: 'N/A'
                            });
                            blockPage("ROM loader element detected");
                            return;
                        }
                    }
                }
            }
        };
if ((isWhitelisted || isExempt) && !forceFingerprintDomains.some(domain => currentUrl.includes(domain))) {
    console.debug("[No Fun Allowed] Skipping element checks — site is whitelisted or exempt:", currentUrl);
} else {
    if (document.readyState === "complete" || document.readyState === "interactive") {
        checkExistingElements();
    } else {
        document.addEventListener("DOMContentLoaded", checkExistingElements);
    }

    window.addEventListener("load", checkExistingElements);
    intervalCheck = setInterval(checkExistingElements, 500);
    document.addEventListener("click", () => setTimeout(checkExistingElements, 100));
    document.addEventListener("change", (e) => {
        if (e.target.type === "file") {
            setTimeout(checkExistingElements, 100);
        }
    });
}
}

    function blockPage(reason) {
        if ((isWhitelisted || isExempt) && !forceFingerprintDomains.some(domain => {
            const regexPattern = domain.replace(/[-[\]{}()+?.,\\^$|#\s]/g, "\\$&").replace(/\*/g, ".*");
            const regex = new RegExp(`^${regexPattern}$`, "i");
            return regex.test(currentUrl);
        })) {
            console.debug("[No Fun Allowed] Block skipped — site is whitelisted or exempt:", currentUrl);
            return;
        }
    
        if (pageBlocked) return;
        pageBlocked = true;
    
        if (domObserver) domObserver.disconnect();
        if (intervalCheck) clearInterval(intervalCheck);
    
        const message = violationMessages[reason] || violationMessages.default;
        const description = message.description.replace('${reason}', reason);
    
        document.documentElement.innerHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${message.title}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@700&display=swap');
            body {
                font-family: 'Roboto', sans-serif;
                margin: 0;
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                background: linear-gradient(45deg, #ff4b4b, #4b79ff);
                background-size: 200% 200%;
                animation: gradientShift 10s ease infinite;
            }
            .container {
                text-align: center;
                background: rgba(255, 255, 255, 0.95);
                padding: 30px;
                border-radius: 15px;
                box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
                border: 2px solid #ff4b4b;
                animation: inducting 0.5s ease-out, pulse 2s infinite;
                max-width: 90%;
                width: 400px;
            }
            .icon {
                font-size: 80px;
                color: #ff4b4b;
                text-shadow: 0 0 10px #ff4b4b;
                animation: iconPulse 1.5s infinite;
                margin-bottom: 10px;
            }
            h1 {
                color: #ff4b4b;
                font-size: 28px;
                margin: 10px 0;
                text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
            }
            p {
                color: rgb(51, 255, 0);
                font-size: 18px;
                margin: 10px 0;
                font-weight: bold;
            }
            .footer {
                margin-top: 20px;
                font-size: 14px;
                color: #666;
                opacity: 0.8;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.8); }
                to { opacity: 1; transform: scale(1); }
            }
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.02); }
            }
            @keyframes iconPulse {
                0%, 100% { transform: scale(1); text-shadow: 0 0 10px #ff4b4b; }
                50% { transform: scale(1.1); text-shadow: 0 0 20px #ff4b4b; }
            }
            @keyframes gradientShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            @media (max-width: 600px) {
                .container { padding: 20px; width: 80%; }
                .icon { font-size: 60px; }
                h1 { font-size: 24px; }
                p { font-size: 16px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="icon">🚫</div>
            <h1>${message.title}</h1>
            <p>${description}</p>
            <p>${message.action}</p>
            <div class="footer">! This Site May Violate Your Internet Usage Policy ! Powered by Game Over</div>
        </div>
    </body>
    </html>
            `;
    }

    function initialize() {
        loadWhitelistAndSettings(() => {
            if (document.readyState === "complete" || document.readyState === "interactive") {
                setupListeners();
            } else {
                document.addEventListener("DOMContentLoaded", setupListeners, { once: true });
            }
        });
    }

    initialize();
})();
