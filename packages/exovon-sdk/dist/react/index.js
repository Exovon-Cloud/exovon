"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExovonSpeedInsights = ExovonSpeedInsights;
exports.SpeedInsights = ExovonSpeedInsights;
const react_1 = require("react");
const web_vitals_1 = require("web-vitals");
function ExovonSpeedInsights({ endpoint = '/_exovon/vitals', sampleRate = 1, ...rest } = {}) {
    const hasSent = (0, react_1.useRef)(false);
    const vitals = (0, react_1.useRef)({});
    (0, react_1.useEffect)(() => {
        // Only track in browser environments
        if (typeof window === 'undefined')
            return;
        // Security Guard: Detect and alert if a developer accidentally passed an API key in client code
        if (rest.apiKey || rest.token) {
            console.error('🚨 [EXOVON SECURITY ALERT] Never pass an API key to <SpeedInsights />! ' +
                'Speed Insights is automatically intercepted by the Exovon Edge Router with zero credentials. ' +
                'Exposing an API key in client-side code compromises your Exovon account.');
        }
        // Skip localhost / local dev to prevent 404 console noise when running outside Exovon Edge
        const isLocalhost = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname === '::1';
        if (isLocalhost && endpoint === '/_exovon/vitals') {
            return;
        }
        // Sample rate filter
        if (sampleRate < 1 && Math.random() > sampleRate)
            return;
        const reportVitals = () => {
            if (hasSent.current || Object.keys(vitals.current).length === 0)
                return;
            hasSent.current = true;
            const payload = JSON.stringify(vitals.current);
            // Primary: fetch with keepalive: true and explicit application/json header
            if (typeof fetch === 'function') {
                try {
                    fetch(endpoint, {
                        body: payload,
                        method: 'POST',
                        keepalive: true,
                        headers: { 'Content-Type': 'application/json' },
                        mode: 'cors'
                    }).catch(() => {
                        // Fallback: sendBeacon
                        if (navigator.sendBeacon) {
                            navigator.sendBeacon(endpoint, payload);
                        }
                    });
                    return;
                }
                catch {
                    // Fall through to sendBeacon
                }
            }
            // Secondary Fallback: navigator.sendBeacon
            if (navigator.sendBeacon) {
                navigator.sendBeacon(endpoint, payload);
            }
        };
        (0, web_vitals_1.onLCP)((metric) => { vitals.current.lcp = metric.value; });
        (0, web_vitals_1.onINP)((metric) => { vitals.current.inp = metric.value; });
        (0, web_vitals_1.onCLS)((metric) => { vitals.current.cls = metric.value; });
        (0, web_vitals_1.onFCP)((metric) => { vitals.current.fcp = metric.value; });
        (0, web_vitals_1.onTTFB)((metric) => { vitals.current.ttfb = metric.value; });
        // Send metrics when page unloads or becomes hidden
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                reportVitals();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', reportVitals);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', reportVitals);
        };
    }, [endpoint, sampleRate]);
    return null;
}
