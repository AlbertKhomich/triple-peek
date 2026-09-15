const stars = [[55,209],[190,145],[285,345],[126,554],[396,465],[539,610],[1080,168],[1303,192],[1175,305],[1414,385],[1239,522],[1493,578],[1080,658]];

import Search from "./search";

function Constellations() {
  return (
    <svg className="constellations" viewBox="0 0 1590 800" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="star-halo">
          <stop stopColor="#c2e4ff" stopOpacity=".3" />
          <stop offset="1" stopColor="#a5d5ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="constellation-lines">
        <path d="M55 209Q112 169 190 145Q245 228 285 345L126 554Q63 387 55 209" />
        <path d="M285 345L396 465L539 610Q326 615 126 554" />
        <path d="M1080 168Q1190 160 1303 192Q1342 300 1414 385Q1284 324 1175 305Q1100 236 1080 168" />
        <path d="M1175 305Q1198 442 1239 522L1414 385Q1439 489 1493 578Q1350 563 1239 522L1080 658Q1280 588 1493 578" />
      </g>
      {stars.map(([x, y], index) => (
        <g key={index} opacity={[1,1,1,1,.55,.55,.4,1,.65,1,1,1,.8][index]}>
          <circle cx={x} cy={y} r="14" fill="url(#star-halo)" />
          <circle cx={x} cy={y} r="3.1" fill="#657783" stroke="#b1c4d1" strokeWidth=".7" />
          <circle cx={x} cy={y} r="1.35" fill="#edf7ff" />
        </g>
      ))}
    </svg>
  );
}

function DiceMark() {
  return (
    <svg viewBox="0 0 34 38" fill="none" aria-hidden="true">
      <path d="M17 1 32 9.5 17 18 2 9.5 17 1Z" fill="#f3f4f5" />
      <path d="M2 11.5 16 19.5V36L2 27.5V11.5ZM18 19.5 32 11.5V27.5L18 36V19.5Z" fill="#f3f4f5" />
      <g fill="#111a20">
        <ellipse cx="12" cy="8" rx="2.6" ry="1.5" />
        <ellipse cx="22" cy="8" rx="2.6" ry="1.5" />
        <ellipse cx="17" cy="12" rx="2.6" ry="1.5" />
      </g>
      <g stroke="#111a20" strokeWidth="1.2" strokeLinejoin="round">
        <path d="m5 17 8 4.5v10L5 27V17Z" />
        <path d="m7 20 4 2.3v5.9L7 26v-6Z" />
        <path d="m21 22 8-4.5V27l-8 4.5V22Z" />
        <path d="m27 21-4 2.3v5l4-2.3v-2l-2 1" />
      </g>
    </svg>
  );
}

export default function Home() {
  return (
    <main className="papers-page">
      <Constellations />
      <section className="paper-search" aria-labelledby="page-title">
        <h1 id="page-title">Papers</h1>
        <Search />
      </section>
      <footer className="page-footer" aria-label="DICE">
        <span className="footer-rule" />
        <div className="dice-brand"><DiceMark /><span>DICE</span></div>
        <span className="footer-rule" />
      </footer>
    </main>
  );
}
