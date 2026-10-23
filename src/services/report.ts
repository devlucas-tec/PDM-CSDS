import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Aluno } from '@/database/types';
import { calculateAge, simNao } from '@/lib/format';
import type { ChartItem, DashboardData, DashboardFilters } from '@/lib/stats';

const escape = (value: string | number | null | undefined) =>
  String(value ?? '—').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

function barChart(title: string, items: ChartItem[]) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const rows = items
    .map(
      (item) => `
      <tr>
        <td class="label">${escape(item.label)}</td>
        <td class="bar"><div style="width:${(item.value / max) * 100}%"></div></td>
        <td class="value">${item.value}</td>
      </tr>`,
    )
    .join('');
  return `<div class="chart"><h3>${escape(title)}</h3><table class="bars">${rows || '<tr><td>Sem dados</td></tr>'}</table></div>`;
}

export function buildReportHtml(data: DashboardData, students: Aluno[], filters: DashboardFilters) {
  const filterText = [
    `Ano: ${filters.ano ?? 'Todos'}`,
    `Série: ${filters.serie ?? 'Todas'}`,
    `Bairro: ${filters.bairro ?? 'Todos'}`,
  ].join(' · ');
  const generatedAt = new Date().toLocaleString('pt-BR');

  const studentRows = students
    .map(
      (s) => `<tr>
        <td>${escape(s.nome_social || s.nome)}</td>
        <td>${calculateAge(s.data_nascimento)}</td>
        <td>${escape(s.serie)}</td>
        <td>${escape(s.bairro)}</td>
        <td>${simNao(s.bolsa_familia)}</td>
        <td>${simNao(s.possui_deficiencia)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Arial, sans-serif; color: #2A3020; margin: 28px; font-size: 12px; }
  header { border-bottom: 3px solid #4F5F2A; padding-bottom: 10px; margin-bottom: 16px; }
  h1 { margin: 0; color: #4F5F2A; font-size: 22px; }
  h2 { color: #4F5F2A; font-size: 15px; margin: 22px 0 8px; border-bottom: 1px solid #E1DFD1; padding-bottom: 4px; }
  h3 { font-size: 12px; margin: 0 0 6px; }
  .muted { color: #666D5A; }
  .cards { display: flex; flex-wrap: wrap; gap: 8px; }
  .card { flex: 1 1 18%; border: 1px solid #E1DFD1; border-radius: 8px; padding: 10px; }
  .card b { display: block; font-size: 20px; color: #4F5F2A; }
  .grid { display: flex; flex-wrap: wrap; gap: 16px; }
  .chart { flex: 1 1 45%; page-break-inside: avoid; }
  table.bars { width: 100%; border-collapse: collapse; }
  table.bars td { padding: 3px 4px; }
  table.bars .label { width: 38%; }
  table.bars .bar div { height: 10px; background: #6F8A34; border-radius: 0 3px 3px 0; }
  table.bars .value { width: 30px; text-align: right; font-weight: bold; }
  table.list { width: 100%; border-collapse: collapse; }
  table.list th, table.list td { border-bottom: 1px solid #E1DFD1; padding: 5px; text-align: left; }
  table.list th { background: #ECEBDF; }
  .vuln { display: flex; gap: 8px; }
  .vuln div { flex: 1; border-radius: 8px; padding: 10px; border: 1px solid #E1DFD1; }
  footer { margin-top: 24px; font-size: 10px; color: #666D5A; text-align: center; }
</style></head>
<body>
  <header>
    <h1>Casa São Domingos Sávio — Análise Social</h1>
    <div class="muted">${escape(filterText)} · Gerado em ${escape(generatedAt)}</div>
  </header>

  <h2>Indicadores principais</h2>
  <div class="cards">
    <div class="card"><b>${data.total}</b>Alunos atendidos</div>
    <div class="card"><b>${data.bolsaFamilia.count}</b>Recebem Bolsa Família (${data.bolsaFamilia.percent}%)</div>
    <div class="card"><b>${data.deficiencia}</b>Alunos com deficiência</div>
    <div class="card"><b>${data.mediaPessoasCasa.toLocaleString('pt-BR')}</b>Média de pessoas por casa</div>
    <div class="card"><b>${data.transporte}</b>Necessitam transporte</div>
  </div>

  <h2>Índice de vulnerabilidade social</h2>
  <div class="vuln">
    <div><b>Baixa (0–1 pt):</b> ${data.vulnerabilidade.baixa.percent}% (${data.vulnerabilidade.baixa.count})</div>
    <div><b>Média (2–3 pts):</b> ${data.vulnerabilidade.media.percent}% (${data.vulnerabilidade.media.count})</div>
    <div><b>Alta (4–5 pts):</b> ${data.vulnerabilidade.alta.percent}% (${data.vulnerabilidade.alta.count})</div>
  </div>
  <p class="muted">Índice médio da Casa: ${data.indiceMedio}% dos critérios atendidos.</p>

  <h2>Perfil dos alunos</h2>
  <div class="grid">
    ${barChart('Distribuição por idade', data.idade)}
    ${barChart('Gênero', data.genero)}
    ${barChart('Raça / cor', data.corRaca)}
  </div>

  <h2>Perfil das famílias</h2>
  <div class="grid">
    ${barChart('Escolaridade dos pais', data.escolaridadePais)}
    ${barChart('Profissões mais comuns', data.profissoes)}
    ${barChart('Tamanho das famílias', data.tamanhoFamilia)}
  </div>

  <h2>Origem dos alunos</h2>
  <div class="grid">
    ${barChart('Alunos por bairro', data.bairros)}
    ${barChart('Escolas de origem', data.escolas)}
  </div>

  <h2>Dados de saúde</h2>
  <div class="grid">
    ${barChart('Condições médicas', data.condicoesMedicas)}
    ${barChart('Restrições alimentares', data.restricoesAlimentares)}
  </div>

  <h2>Lista de alunos (${students.length})</h2>
  <table class="list">
    <thead><tr><th>Nome</th><th>Idade</th><th>Série</th><th>Bairro</th><th>Bolsa Família</th><th>Deficiência</th></tr></thead>
    <tbody>${studentRows}</tbody>
  </table>

  <footer>Relatório gerado pelo aplicativo de gestão da Casa São Domingos Sávio. Dados armazenados localmente no dispositivo.</footer>
</body></html>`;
}

/** Gera o PDF do dashboard e abre a folha de compartilhamento do sistema. */
export async function exportDashboardPdf(data: DashboardData, students: Aluno[], filters: DashboardFilters) {
  const html = buildReportHtml(data, students, filters);
  if (Platform.OS === 'web') {
    // Na web, o expo-print abre a janela de impressão (onde é possível salvar como PDF).
    await Print.printToFileAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: 'Relatório de análise social' });
  } else {
    throw new Error('Compartilhamento indisponível neste dispositivo.');
  }
}
