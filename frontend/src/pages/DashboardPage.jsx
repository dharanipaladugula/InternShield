import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ParticleBackground from "../components/shared/ParticleBackground";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import AnalyzeToolbar from "../components/dashboard/AnalyzeToolbar";
import ScanLoading from "../components/dashboard/ScanLoading";
import DashboardEmpty from "../components/dashboard/DashboardEmpty";
import TrustMeterCard from "../components/dashboard/TrustMeterCard";
import SignalGrid from "../components/dashboard/SignalGrid";
import RiskIndicatorList from "../components/dashboard/RiskIndicatorList";
import RecommendationPanel from "../components/dashboard/RecommendationPanel";
import GlassCard from "../components/shared/GlassCard";
import { buildSignalCards } from "../utils/signalParser";
import { buildRecommendation } from "../utils/recommendation";
import DetectionSummary from "../components/dashboard/DetectionSummary";
export default function DashboardPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleAnalyze(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
    } catch (err) {
      setError(
        err.message ||
          "Could not reach the server. Is the backend running on port 3001?"
      );
    } finally {
      setLoading(false);
    }
  }

  const signals = result ? buildSignalCards(result) : [];
  const recommendation = buildRecommendation(result);

  return (
    <div className="dashboard-page">
      <ParticleBackground variant="dense" />
      <DashboardSidebar />

      <motion.main
        className="dashboard-main"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <AnalyzeToolbar
          url={url}
          setUrl={setUrl}
          loading={loading}
          onSubmit={handleAnalyze}
        />

        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ScanLoading />
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <GlassCard className="dash-error" delay={0.08} hover={false}>
            <div className="dash-error__inner" role="alert">
              <strong>Connection error</strong>
              <p>{error}</p>
            </div>
          </GlassCard>
        )}

        {!loading && !result && !error && <DashboardEmpty />}

        <AnimatePresence>
          {result && !loading && (
            <motion.div
              className="dashboard-results"
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            >
              {(result.safeBrowsingFlagged || result.impersonationRisk) && (
                <div className="dashboard-alerts">
                  {result.safeBrowsingFlagged && (
                    <div className="dash-alert dash-alert--danger" role="alert">
                      <strong>Safe Browsing threat</strong>
                      <p>Google flagged this URL as dangerous. Do not submit personal data.</p>
                    </div>
                  )}
                  {result.impersonationRisk && (
                    <div className="dash-alert dash-alert--violet" role="alert">
                      <strong>Impersonation signal</strong>
                      <p>
                        Company name in URL does not match the site domain
                        {result.impersonatedCompanies?.length > 0 &&
                          ` (${result.impersonatedCompanies.join(", ")})`}
                        .
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="dashboard-results__top">
                <TrustMeterCard result={result} />

                <GlassCard className="url-intel-card" delay={0.18}>
                  <h3 className="panel-heading">URL intelligence</h3>
                  <dl className="url-intel">
                    <div>
                      <dt>Original</dt>
                      <dd><code>{result.urlChecked}</code></dd>
                    </div>
                    {result.finalUrl && result.finalUrl !== result.urlChecked && (
                      <div>
                        <dt>Final</dt>
                        <dd><code>{result.finalUrl}</code></dd>
                      </div>
                    )}
                    {result.domain && (
                      <div>
                        <dt>Domain</dt>
                        <dd><code>{result.domain}</code></dd>
                      </div>
                    )}
                  </dl>
                </GlassCard>
              </div>

              <SignalGrid signals={signals} />
              <DetectionSummary
  result={result}
/>
              <RiskIndicatorList indicators={result.riskIndicators} />
              <RecommendationPanel recommendation={recommendation} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>
    </div>
  );
}
