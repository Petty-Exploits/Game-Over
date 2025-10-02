(function () {
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
        copyPasteEnabled: true
    };

    const exemptDomains = [
        "*.edu/*", "*.gov/*", "*://*.abcya.com/*" // whitelisted domains that wont be fingerprinted for game/proxy code
    ];

    const forceFingerprintDomains = [
        "*culinaryschools.org/kids-games*",
        "*gemini.google.com*",
        "*sites.google.com*"
    ];

    const suspiciousSrcDomains = [
        "atari-embeds.googleusercontent.com", "deev.is", "eaglercraft",
        "glitch.me", "herokuapp.com", "lax1dude",
        "netlify.app", "onrender.com", "railway.app", "replit.com",
        "replit.dev", "surge.sh", "vercel.app", "workers.dev"
    ];

    const fingerprintBlockPatterns = [
        /allow-pointer-lock/i, /allow\s*=\s*["']keyboard["']/i, /allow\s*=\s*["']pointer-lock["']/i,
        /bypass/i, /data-embed.*(game|proxy|unblock)/i, /eaglercraft/i,
        /embed.*(proxy|unblock)/i, /encodeURIComponent\s*\(.*(proxy|game|unblock)/i,
        /game(?:\/|\\).*(proxy|hack|cheat|bot)/i, /gamecanvas/i, /holyunblocker/i,
        /lax1dude/i, /proxy\s*=\s*['"]/i, /proxy.*(http|url)/i,
        /requestFullscreen\s*\(/i, /toggleFullscreen\s*\(/i, /unblocker/i, /unblocked/i,
        /window\.eaglercraftopts/i
    ];

    const copyPasteBlockPatterns = [
        /allow-pointer-lock/i, /allow\s*=\s*["']keyboard["']/i, /allow\s*=\s*["']pointer-lock["']/i,
        /bypass/i, /eaglercraft/i, /embed.*(proxy|game|unblock)/i,
        /encodeURIComponent\s*\(.*(proxy|game|unblock)/i, /game(?:\/|\\).*(proxy|hack|cheat|bot)/i,
        /gamecanvas/i, /holyunblocker/i, /lax1dude/i, /proxy\s*=\s*['"]/i,
        /proxy.*(http|url)/i, /requestFullscreen\s*\(/i, /toggleFullscreen\s*\(/i,
        /unblocker/i, /unblocked/i, /window\.eaglercraftopts/i
    ];

    const asciiArt = `Replace copied game / proxy code with this

    `;

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
        const shouldFingerprint = !isExempt && (!isWhitelisted || forceFingerprintDomains.some(domain => currentUrl.includes(domain)));
        if (shouldFingerprint && fingerprintBlockPatterns.some(rx => rx.test(code.toLowerCase()))) {
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
        alert("Pasting of game/proxy code detected and replaced with cursed text.");
        setTimeout(() => { hasPasteAlerted = false; }, 1000);
    }
}, true);

let hasCopyAlerted = false;
document.addEventListener("copy", (e) => {
    if (hasCopyAlerted || !settings.copyPasteEnabled) return;
    // Use clipboardData to get selected text, fallback to getSelection
    let text = "";
    if (e.clipboardData) {
        const selection = window.getSelection();
        text = selection && !selection.isCollapsed ? selection.toString().toLowerCase() : "";
    }
    const isSuspicious = text && copyPasteBlockPatterns.some(rx => rx.test(text));
    if (isSuspicious) {
        e.stopImmediatePropagation();
        e.preventDefault();
        // Set clipboard data directly
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
            alert("Copying of game/proxy code detected and replaced.");
            setTimeout(() => { hasCopyAlerted = false; }, 1000);
        } else {
            // Fallback to navigator.clipboard
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
            alert("Copying of game/proxy code detected and replaced.");
            setTimeout(() => { hasCopyAlerted = false; }, 1000);
        }
    }
}, { capture: true, passive: false });

    function setupListeners() {
        if (!document.body) {
            setTimeout(() => setupListeners(), 100);
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
                            // Debug log for unblocked iframes
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
                        const matchedPattern = fingerprintBlockPatterns.find(rx => rx.test(content))?.toString();
                        if (matchedPattern) {
                            logBlockEvent("Suspicious script detected", { 
                                type: "script", 
                                attributes: content.substring(0, 100),
                                pattern: matchedPattern,
                                element: `SCRIPT${el.id ? `#${el.id}` : ''}`,
                                flags: 'N/A',
                                src: 'N/A',
                                srcdoc: 'N/A'
                            });
                            blockPage("Suspicious script detected");
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
                    const matchedPattern = fingerprintBlockPatterns.find(rx => rx.test(content))?.toString();
                    if (matchedPattern) {
                        logBlockEvent("Suspicious script detected", { 
                            type: "script", 
                            attributes: content.substring(0, 100),
                            pattern: matchedPattern,
                            element: `SCRIPT${script.id ? `#${script.id}` : ''}`,
                            flags: 'N/A',
                            src: 'N/A',
                            srcdoc: 'N/A'
                        });
                        blockPage("Suspicious script detected");
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
                }
            }
        };

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

    function blockPage(reason) {
        if (isWhitelisted || isExempt || pageBlocked) return;
        pageBlocked = true;

        if (domObserver) domObserver.disconnect();
        if (intervalCheck) clearInterval(intervalCheck);

        document.documentElement.innerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Possible Policy Violation</title>
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
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.0.2);
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
        <h1>Possible Policy Violation</h1>
        <p>${reason}</p>
        <p>If you think this is a false positive, bring it to your school tech support to have it inspected.</p>
        <div class="footer">! This Site May Might Violate Your Internet Usage Policy ! Powered by Game Over</div>
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