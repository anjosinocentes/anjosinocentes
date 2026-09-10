// Formata os documentos do banco para o formato devolvido ao cliente. Usado pelas várias
// rotas de app/api/students/[id]/pdi/** para não repetir o mesmo mapeamento em cada arquivo.

// Janela de recuperação da "lixeira" de PDI: um PDI excluído pode ser restaurado por até este
// número de dias; depois disso é apagado definitivamente pela limpeza oportunista abaixo.
export const PDI_TRASH_TTL_DAYS = 7

// Remove DEFINITIVAMENTE do banco os PDIs (e seus registros) cuja exclusão passou da janela de
// 7 dias. Chamada de forma oportunista nas rotas de PDI (o adaptador Postgres não tem TTL do
// Mongo). Best-effort: uma falha aqui não deve travar a operação principal.
export async function purgeExpiredTrash(db: any): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - PDI_TRASH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const filter = { deletedAt: { $ne: null, $lt: cutoff } }
    await Promise.all([
      db.collection("pdis").deleteMany(filter),
      db.collection("pdi_tracking").deleteMany(filter),
      db.collection("pdi_evolutions").deleteMany(filter),
    ])
  } catch (err) {
    console.error("Falha ao limpar a lixeira de PDIs expirada:", err)
  }
}

export function toPdiView(doc: any) {
  return {
    id: doc.id,
    studentId: doc.studentId,
    situacaoInicial: doc.situacaoInicial,
    objetivosIniciais: doc.objetivosIniciais || "",
    observacoesIniciais: doc.observacoesIniciais || "",
    attachments: doc.attachments || [],
    eventos: (doc.eventos || []).map(toEventView),
    createdAt: doc.createdAt,
    createdBy: doc.createdBy || null,
    createdByName: doc.createdByName || null,
    updatedAt: doc.updatedAt,
    updatedBy: doc.updatedBy || null,
    updatedByName: doc.updatedByName || null,
  }
}

export function toEventView(doc: any) {
  return {
    id: doc.id,
    data: doc.data,
    titulo: doc.titulo,
    descricao: doc.descricao || "",
    createdAt: doc.createdAt,
    createdBy: doc.createdBy || null,
    createdByName: doc.createdByName || null,
  }
}

export function toTrackingView(doc: any) {
  return {
    id: doc.id,
    pdiId: doc.pdiId,
    studentId: doc.studentId,
    area: doc.area,
    objetivo: doc.objetivo,
    descricao: doc.descricao || "",
    dataInicio: doc.dataInicio,
    prazo: doc.prazo || null,
    status: doc.status,
    responsavelId: doc.responsavelId || null,
    responsavelNome: doc.responsavelNome || null,
    observacoes: doc.observacoes || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export function toEvolutionView(doc: any) {
  return {
    id: doc.id,
    pdiId: doc.pdiId,
    studentId: doc.studentId,
    area: doc.area,
    status: doc.status,
    data: doc.data,
    relato: doc.relato,
    proximosPassos: doc.proximosPassos || "",
    responsavelId: doc.responsavelId || null,
    responsavelNome: doc.responsavelNome || null,
    attachments: doc.attachments || [],
    createdAt: doc.createdAt,
  }
}
