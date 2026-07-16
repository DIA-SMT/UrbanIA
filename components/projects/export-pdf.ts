import {
  budgetCostTypeLabels,
  feasibilityLabels,
  formatCurrency,
  type ProjectBudgetItemView,
  type ProjectDiagnosisView
} from "@/lib/projects/shared";

/**
 * Exportacion a PDF sin dependencias: se abre una ventana con HTML imprimible y
 * se dispara el dialogo de impresion del navegador ("Guardar como PDF"). Reutilizable
 * en el formulario y en la ficha.
 */

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Inter, "Segoe UI", system-ui, sans-serif; color: #0b1220; margin: 40px; line-height: 1.55; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #1f89f6; margin: 24px 0 8px; }
  .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #64748b; font-weight: 800; }
  .muted { color: #475569; font-size: 12px; }
  ul { margin: 6px 0; padding-left: 18px; }
  li { margin: 3px 0; }
  blockquote { border-left: 3px solid #f6d500; margin: 6px 0; padding-left: 12px; font-style: italic; color: #334155; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; }
  .total { text-align: right; font-weight: 800; font-size: 14px; margin-top: 10px; }
  .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; }
`;

function openPrintWindow(title: string, bodyHtml: string) {
  const win = window.open("", "_blank", "width=920,height=760");
  if (!win) return;
  win.document.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_STYLES}</style></head><body>${bodyHtml}<div class="footer">Generado desde UrbanIA — Municipalidad de San Miguel de Tucuman. La IA orienta; el equipo municipal valida.</div></body></html>`
  );
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

export function exportDiagnosisPdf(project: { code: string; title: string }, diagnosis: ProjectDiagnosisView) {
  const actions = diagnosis.actions.length ? `<ul>${diagnosis.actions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<p class=\"muted\">Sin acciones registradas.</p>";
  const risks = diagnosis.risks.length ? `<ul>${diagnosis.risks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<p class=\"muted\">Sin riesgos registrados.</p>";
  const cited = diagnosis.citedArticles.length
    ? diagnosis.citedArticles.map((cite) => `<blockquote><strong>Articulo ${escapeHtml(cite.articleNumber)}</strong>: “${escapeHtml(cite.quote)}”</blockquote>`).join("")
    : "<p class=\"muted\">Sin articulos citados.</p>";

  const body = `
    <p class="eyebrow">Diagnostico tecnico · version ${diagnosis.version}${diagnosis.editedByHuman ? " · editado por el equipo" : ""}</p>
    <h1>${escapeHtml(project.title)}</h1>
    <p class="muted">${escapeHtml(project.code)} · Factibilidad: ${feasibilityLabels[diagnosis.feasibility]}</p>
    <h2>Ambito</h2><p>${escapeHtml(diagnosis.scope)}</p>
    <h2>Objetivo</h2><p>${escapeHtml(diagnosis.objective)}</p>
    <h2>Analisis</h2><p>${escapeHtml(diagnosis.analysis).replace(/\n/g, "<br>")}</p>
    <h2>Acciones recomendadas</h2>${actions}
    <h2>Riesgos</h2>${risks}
    <h2>Normativa citada</h2>${cited}
  `;
  openPrintWindow(`Diagnostico ${project.code}`, body);
}

export function exportBudgetPdf(project: { code: string; title: string }, items: ProjectBudgetItemView[]) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const rows = items.length
    ? items
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.concept)}</td><td>${budgetCostTypeLabels[item.costType]}</td><td>${formatCurrency(item.baseAmount)}</td><td>${item.multiplier}x</td><td>${escapeHtml(item.fundingSource ?? "-")}</td><td>${formatCurrency(item.amount)}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="muted">Sin items de presupuesto.</td></tr>`;

  const body = `
    <p class="eyebrow">Presupuesto estimado</p>
    <h1>${escapeHtml(project.title)}</h1>
    <p class="muted">${escapeHtml(project.code)}</p>
    <table>
      <thead><tr><th>Concepto</th><th>Tipo</th><th>Base</th><th>Mult.</th><th>Financiamiento</th><th>Monto</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="total">Total estimado: ${formatCurrency(total)}</p>
  `;
  openPrintWindow(`Presupuesto ${project.code}`, body);
}
