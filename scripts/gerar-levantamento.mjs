// Recria a relação de endereços a partir de uma consulta pública do SIG municipal.
// Uso: node scripts/gerar-levantamento.mjs /caminho/municipal-live.json
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = {window:{}};
for (const path of ['data/imoveis-importados.js','data/lotes-prefeitura.js']) vm.runInNewContext(fs.readFileSync(path,'utf8'),ctx);
const base = ctx.window.LOTES_PREFEITURA;
const live = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const byId = new Map(live.map(x=>[x.tx_insct,x]));
if (byId.size !== base.lotes.length) throw new Error('Consulta incompleta ou inscrições duplicadas.');
const names = {1:'Rua Dr. Wilson Vieira',2:'Rua Prof. Fernando José de Almeida',3:'Rua Canagé Malta',4:'Rua Jorn. Umbelino Silva',5:'Rua Abdo Ami-Ramia',6:'Rua Pietro Farsoun',7:'Rua Jorn. Francisco R. de Miranda',...base.nomesQuadras};
const lotes = base.lotes.map(l=>{
  const a=byId.get(l.i);
  if(!a) throw new Error('Inscrição ausente: '+l.i);
  const quadra=base.blocos[l.i.slice(3,7)];
  if(!quadra) throw new Error('Quadra ausente: '+l.i);
  const rua=String(a.tx_logrado||'').trim();
  const bruto=String(a.tx_nroport||'').trim();
  const numero=bruto && !/^0+$/.test(bruto) && !/^(s\/?n|sem n[uú]mero)$/i.test(bruto)?bruto:'';
  return {quadra,inscricao:l.i,rua,numero,numeroOriginal:a.tx_nroport,bairro:a.tx_bairro||'',latitude:l.la,longitude:l.lo,
    endereco:rua?(numero?`${rua}, nº ${numero}`:`${rua} - número não informado no cadastro`):'Logradouro e número não informados no cadastro',
    situacaoEndereco:!rua?'Sem logradouro':numero?'Rua e número no cadastro':'Sem número no cadastro',
    bairroInformado:!!a.tx_bairro};
}).sort((a,b)=>a.quadra-b.quadra||a.rua.localeCompare(b.rua,'pt-BR')||(parseInt(a.numero)||0)-(parseInt(b.numero)||0)||a.inscricao.localeCompare(b.inscricao));
const resumo=[...new Set(lotes.map(x=>x.quadra))].map(quadra=>{
  const rows=lotes.filter(x=>x.quadra===quadra);
  const comNumero=rows.filter(x=>x.rua&&x.numero).length;
  const semRua=rows.filter(x=>!x.rua).length;
  return {quadra,nome:names[quadra]||`Quadra ${quadra}`,total:rows.length,comNumero,semNumero:rows.length-comNumero-semRua,semRua};
});
const dataset={dataConsulta:'2026-10-07',fonte:'https://sig.niteroi.rj.gov.br/server/rest/services/Hosted/NGP_SMF_SEREC_A_LOTES_PUBLICO/FeatureServer/30',
  metodo:'Consulta por inscrição técnica. Quadras operacionais seguem a associação de blocos do projeto. Coordenadas são centros de lotes da importação de 05/10/2026.',
  lotes,resumo};
fs.writeFileSync('data/levantamento-enderecos.js','// Consulta cadastral remota; não registra visita ou captação.\nwindow.LEVANTAMENTO_ENDERECOS = '+JSON.stringify(dataset)+';\n');
fs.writeFileSync('../tmp/levantamento.json',JSON.stringify(dataset));
console.log(JSON.stringify({total:lotes.length,quadras:resumo.length,comNumero:lotes.filter(x=>x.rua&&x.numero).length,semNumero:lotes.filter(x=>x.rua&&!x.numero).length,semRua:lotes.filter(x=>!x.rua).length,semBairro:lotes.filter(x=>!x.bairro).length}));
