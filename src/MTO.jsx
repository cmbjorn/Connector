import { useStore } from './store.js';
import { fittingDB } from './engine/fittings.js';

// 10 bolted lap-joint connections in the chain (5 elbows × 2 ends).
const N_CONNECTIONS = 10;

export default function MTO({ onClose }) {
  const spoolLengths = useStore((s) => s.spoolLengths);
  const dn = useStore((s) => s.dn);
  const f = fittingDB[dn];

  const totalMm = Math.round(spoolLengths.reduce((s, l) => s + l * 1000, 0));

  // Stud length: 2 flanges + gasket (3 mm) + 2 × thread engagement (12 mm each)
  const studLen = Math.ceil((2 * f.flangeThickness + 3 + 24) / 5) * 5;
  const totalStuds = N_CONNECTIONS * f.boltCount;

  const spoolRows = spoolLengths.map((len, i) => ({
    tag: `S${i + 1}`,
    mm: Math.round(len * 1000),
    note: i === 0 ? 'From nozzle A' : i === spoolLengths.length - 1 ? 'To nozzle B' : '',
  }));

  const fittingRows = [
    {
      tag: 'E1–E5',
      desc: '90° Elbow, 1.5D LR',
      spec: `${dn} PN25`,
      qty: 5,
      unit: 'ea',
    },
    {
      tag: 'LJF1–10',
      desc: 'Lap joint flange (loose)',
      spec: `${dn} PN25`,
      qty: N_CONNECTIONS,
      unit: 'ea',
    },
    {
      tag: 'SE1–10',
      desc: 'Stub end, Type A',
      spec: `${dn} PN25`,
      qty: N_CONNECTIONS,
      unit: 'ea',
    },
    {
      tag: 'G1–10',
      desc: 'Gasket, spiral wound, SS/graphite',
      spec: `${dn} PN25`,
      qty: N_CONNECTIONS,
      unit: 'ea',
    },
    {
      tag: '—',
      desc: `Stud bolt ${f.boltSize} × ${studLen} mm`,
      spec: 'ASTM A193 B7',
      qty: totalStuds,
      unit: 'ea',
    },
    {
      tag: '—',
      desc: `Heavy hex nut ${f.boltSize}`,
      spec: 'ASTM A194 2H',
      qty: totalStuds * 2,
      unit: 'ea',
    },
  ];

  const downloadCSV = () => {
    const date = new Date().toISOString().split('T')[0];
    const lines = [
      `Teafortwo – Material Take-Off`,
      `Date: ${date}`,
      `Pipe size: ${f.label}  PN25  OD ${f.pipeOD} mm  ID ${f.pipeID} mm`,
      '',
      'SPOOL CUT LIST',
      'Tag,Length (mm),Note',
      ...spoolRows.map((r) => `${r.tag},${r.mm},${r.note}`),
      `TOTAL,${totalMm},`,
      '',
      'FITTINGS & BULK MATERIALS',
      'Tag,Description,Specification,Qty,Unit',
      ...fittingRows.map((r) => `${r.tag},"${r.desc}",${r.spec},${r.qty},${r.unit}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `teafortwo-mto-${date}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 text-white rounded-xl p-6 w-[580px] max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="text-lg font-bold">Material Take-Off</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {f.label} · PN25 · OD {f.pipeOD} mm · ID {f.pipeID} mm
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Spool cut list */}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Spool Cut List
        </h3>
        <table className="w-full text-xs mb-5">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left py-1 w-12">Tag</th>
              <th className="text-right py-1 w-28">Length (mm)</th>
              <th className="text-left py-1 pl-4">Note</th>
            </tr>
          </thead>
          <tbody>
            {spoolRows.map((r) => (
              <tr key={r.tag} className="border-b border-slate-800">
                <td className="py-1.5 font-mono text-slate-300">{r.tag}</td>
                <td className="py-1.5 text-right font-mono text-yellow-300">{r.mm}</td>
                <td className="py-1.5 pl-4 text-slate-400">{r.note}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-500 font-semibold text-slate-200">
              <td className="pt-2">Total pipe</td>
              <td className="pt-2 text-right font-mono text-yellow-300">{totalMm}</td>
              <td className="pt-2 pl-4 text-slate-400">mm</td>
            </tr>
          </tbody>
        </table>

        {/* Fittings */}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Fittings &amp; Bulk Materials
        </h3>
        <table className="w-full text-xs mb-6">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left py-1 w-20">Tag</th>
              <th className="text-left py-1">Description</th>
              <th className="text-left py-1 hidden sm:table-cell">Spec</th>
              <th className="text-right py-1 w-10">Qty</th>
              <th className="text-left py-1 pl-2 w-8">Unit</th>
            </tr>
          </thead>
          <tbody>
            {fittingRows.map((r, i) => (
              <tr key={i} className="border-b border-slate-800">
                <td className="py-1.5 font-mono text-slate-400 text-xs">{r.tag}</td>
                <td className="py-1.5 text-slate-200">{r.desc}</td>
                <td className="py-1.5 text-slate-400 hidden sm:table-cell">{r.spec}</td>
                <td className="py-1.5 text-right font-mono text-yellow-300">{r.qty}</td>
                <td className="py-1.5 pl-2 text-slate-400">{r.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={downloadCSV}
          className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          Download CSV
        </button>
      </div>
    </div>
  );
}
