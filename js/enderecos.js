(() => {
  const d=window.LEVANTAMENTO_ENDERECOS;
  const el=id=>document.getElementById(id);
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fold=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(!d){el('rows').innerHTML='<tr><td colspan="5">Não foi possível carregar a relação cadastral. Atualize a página.</td></tr>';return;}
  const n=d.lotes.filter(x=>x.rua&&x.numero).length;
  el('kpis').innerHTML=[[d.resumo.length,'Quadras do recorte'],[d.lotes.length,'Lotes cadastrados'],[n,'Com rua e número'],[d.lotes.length-n,'Pendências de endereço']].map(([v,k])=>`<div class="kpi"><span>${k}</span><strong>${v}</strong></div>`).join('');
  for(const q of d.resumo) el('quadra').insertAdjacentHTML('beforeend',`<option value="${q.quadra}">Quadra ${String(q.quadra).padStart(2,'0')} — ${q.total} lotes</option>`);
  const initial=new URLSearchParams(location.search).get('quadra');
  if(initial&&d.resumo.some(x=>String(x.quadra)===initial)) el('quadra').value=initial;
  let page=0,filtered=[]; const size=50;
  function row(l,print=false){
    const badge=!l.rua?'missing':!l.numero?'pending':'';
    const links=`<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.latitude+','+l.longitude)}" target="_blank" rel="noopener">Mapa do lote</a><a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${l.latitude},${l.longitude}" target="_blank" rel="noopener">Street View</a>`;
    return `<tr><td>${String(l.quadra).padStart(2,'0')}</td><td>${safe(l.inscricao)}</td><td>${safe(l.endereco)}</td><td><span class="badge ${badge}">${safe(l.situacaoEndereco)}</span>${!l.bairro?'<br><small>Bairro não informado</small>':''}</td>${print?'':`<td class="links">${links}</td>`}</tr>`;
  }
  function render(){
    const q=el('quadra').value,s=el('status').value,term=fold(el('search').value.trim());
    filtered=d.lotes.filter(l=>(!q||String(l.quadra)===q)&&(!term||fold([l.rua,l.numero,l.inscricao,l.endereco].join(' ')).includes(term))&&(!s||(s==='completo'&&l.rua&&l.numero)||(s==='pendente'&&(!l.rua||!l.numero))||(s==='numero'&&l.rua&&!l.numero)||(s==='rua'&&!l.rua)));
    const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages-1);
    const complete=filtered.filter(l=>l.rua&&l.numero).length;
    el('result-count').textContent=`${filtered.length} lotes · ${complete} com rua e número · ${filtered.length-complete} pendentes`;
    el('rows').innerHTML=filtered.slice(page*size,(page+1)*size).map(l=>row(l)).join('')||'<tr><td colspan="5" class="empty">Nenhum lote corresponde aos filtros.</td></tr>';
    el('pagination-label').textContent=`Página ${page+1} de ${pages} · até ${size} registros por página`;
    el('previous').disabled=page===0;el('next').disabled=page>=pages-1;
    const url=new URL(location.href);if(q)url.searchParams.set('quadra',q);else url.searchParams.delete('quadra');history.replaceState(null,'',url);
  }
  for(const id of ['quadra','status','search'])el(id).addEventListener(id==='search'?'input':'change',()=>{page=0;render();});
  el('previous').onclick=()=>{page--;render();};el('next').onclick=()=>{page++;render();};
  el('export').onclick=()=>{
    const csv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const headers=['Quadra','Inscrição técnica','Logradouro','Número de porta','Endereço','Situação','Bairro no cadastro','Latitude','Longitude','Data da consulta','Fonte'];
    const rows=filtered.map(l=>[l.quadra,l.inscricao,l.rua,l.numero,l.endereco,l.situacaoEndereco,l.bairro,l.latitude,l.longitude,d.dataConsulta,d.fonte]);
    const content='\uFEFF'+[headers,...rows].map(r=>r.map(csv).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`enderecos-piratininga-${d.dataConsulta}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  function preparePrint(){el('print-list').innerHTML=`<h2>${safe(el('result-count').textContent)}</h2><table><thead><tr><th>Quadra</th><th>Inscrição técnica</th><th>Endereço no cadastro</th><th>Situação</th></tr></thead><tbody>${filtered.map(l=>row(l,true)).join('')}</tbody></table>`;}
  window.addEventListener('beforeprint',preparePrint);
  el('print').onclick=()=>{preparePrint();window.print();};
  render();
})();
