export interface ExovonSpeedInsightsProps {
    /** Custom endpoint URL if not using the default edge router (e.g. for custom proxies) */
    endpoint?: string;
    /** Custom sample rate between 0 and 1 (default: 1) */
    sampleRate?: number;
    /**
     * @deprecated DO NOT PASS API KEYS TO CLIENT-SIDE SDK.
     * Exovon Speed Insights requires ZERO configuration and ZERO API keys.
     * Any API key passed here would be leaked in client-side bundles.
     */
    apiKey?: never;
}
export declare function ExovonSpeedInsights({ endpoint, sampleRate, ...rest }?: ExovonSpeedInsightsProps): null;
export { ExovonSpeedInsights as SpeedInsights };
