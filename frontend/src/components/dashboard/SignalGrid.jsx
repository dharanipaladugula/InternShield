import SignalCard from "./SignalCard";

export default function SignalGrid({ signals }) {
  return (
    <section className="signal-grid">
      <h3 className="panel-heading">Signal matrix</h3>
      <div className="signal-grid__cards">
        {signals.map((signal, i) => (
          <SignalCard key={signal.id} signal={signal} index={i} />
        ))}
      </div>
    </section>
  );
}
