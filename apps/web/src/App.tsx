import './App.css'

function App() {
  return (
    <main className="shell">
      <header className="topbar"><span className="mark">JQ</span><span className="brand">JustiQ</span><span className="status">Platform foundation</span></header>
      <section className="intro"><p className="eyebrow">Judicial Case Management System</p><h1>Clarity for every case.</h1><p className="lede">The workspace is ready for case operations, intelligent scheduling, and public access.</p></section>
      <section className="modules" aria-label="Application modules">
        <article><span>01</span><h2>Core operations</h2><p>Cases, hearings, courtrooms, and audit trails.</p></article>
        <article><span>02</span><h2>Intelligence</h2><p>Human-reviewed extraction, summaries, and priority signals.</p></article>
        <article><span>03</span><h2>Open access</h2><p>Real-time dockets and a clear public case experience.</p></article>
      </section>
    </main>
  )
}

export default App
