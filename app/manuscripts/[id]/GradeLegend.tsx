import { GRADE_LEGEND as ROWS } from "@/lib/grade-legend";

export default function GradeLegend() {
  return (
    <details className="rounded-lg border border-black/10 bg-white dark:border-white/15 dark:bg-white/5">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
        What the grades mean
      </summary>
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
              <th className="py-2 pr-3 font-semibold">Grade</th>
              <th className="px-3 py-2 font-semibold">Quality (craft)</th>
              <th className="px-3 py-2 font-semibold">Marketability</th>
              <th className="px-3 py-2 font-semibold">Closeness to submission</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.grade} className="border-t border-black/10 align-top dark:border-white/10">
                <td className="py-2 pr-3 font-bold">{r.grade}</td>
                <td className="px-3 py-2 text-black/70 dark:text-white/70">{r.quality}</td>
                <td className="px-3 py-2 text-black/70 dark:text-white/70">{r.market}</td>
                <td className="px-3 py-2 text-black/70 dark:text-white/70">{r.submission}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-black/50 dark:text-white/50">
          A <strong>+</strong> or <strong>−</strong> marks gradations within a band. OpenAI grades
          commercial prospects; Claude grades craft — so a manuscript can carry two different grades.
        </p>
      </div>
    </details>
  );
}
