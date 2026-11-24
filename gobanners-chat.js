/* =====================================================================
   GoBanners · Chat de orçamento no site (gobanners.com.br)
   Um script só, colocado uma vez no tema (antes de </body>):

     <script src="https://atendimento.gobanners.com.br/gobanners-chat.js" defer></script>

   O que ele faz:
   1. Qualquer link ou botão com href="#orcamento", classe "gb-abrir-chat" ou atributo data-gb-chat abre o chat em
      TELA CHEIA por cima da página (o site continua embaixo; no × a pessoa volta onde estava).
      href="#contato" ou data-gb-chat="contato" abre no modo contato (orçamento / já sou cliente / outro assunto).
      Produto: o chat descobre sozinho pela página; para forçar, data-produto-id="wind-banner" data-produto-nome="Wind Banner".
   2. Botão flutuante verde no canto inferior direito abre o chat numa janelinha (tela cheia no celular).
      Desligue com data-flutuante="nao" na tag do script, ou <body data-gb-flutuante="nao">.
   3. Passa para o chat a página de origem e a origem da visita (UTMs, gclid, site de onde veio), guardada em cookie por 90 dias.
   4. Opcional: links antigos de WhatsApp passam a abrir o chat no modo contato, sem editar um por um:
      data-whatsapp="5511986860210,5511986860287" na tag do script (números só com dígitos, separados por vírgula).
   Configuração opcional na tag do script:
     data-base="https://atendimento.gobanners.com.br/"   endereço do chat
     data-nova-aba="sim"                                  botões abrem o chat em nova aba em vez de tela cheia
     data-texto="Solicitar orçamento"                     texto do botão flutuante
     data-auto-abrir="10"                                 segundos até a janelinha subir sozinha, pela metade da altura
                                                          (só no computador, uma vez por visita); "nao" desliga
   ===================================================================== */
(function () {
  'use strict';
  if (window.__gbChat) return;
  var me = document.currentScript || {};
  var ds = me.dataset || {};
  var BASE = ds.base || (function () {
    try { return new URL('.', me.src).href; } catch (e) { return 'https://atendimento.gobanners.com.br/'; }   // pasta onde este script está
  })();
  var ORIGEM = new URL(BASE).origin;
  var FLUTUANTE = (ds.flutuante || (document.body && document.body.dataset.gbFlutuante) || 'sim') !== 'nao';
  var NOVA_ABA = (ds.novaAba || 'nao') === 'sim';
  var INTERCEPTAR = (ds.interceptar || 'sim') !== 'nao';
  var FONES = String(ds.whatsapp || '').split(',').map(function (n) { return n.replace(/\D/g, '').replace(/^55/, ''); }).filter(function (n) { return n.length >= 10; });
  var WA_CENTRAL = { test: function (h) { if (!FONES.length || !/(wa\.me|whatsapp\.com)\//.test(h)) return false; var d = String(h).replace(/\D/g, ''); return FONES.some(function (n) { return d.indexOf(n) >= 0; }); } };
  var TEXTO = ds.texto || 'Solicitar orçamento';
  var AUTO = /^(nao|0)$/.test(String(ds.autoAbrir || '')) ? 0 : (parseFloat(ds.autoAbrir) || 10);   // segundos; 0 = não abre sozinha
  var MOBILE = function () { return window.innerWidth <= 640; };

  /* ---------- UTMs: primeiro toque guardado em cookie ---------- */
  function utmsDaUrl() {
    var o = {};
    try { new URLSearchParams(location.search).forEach(function (v, k) { if (k.indexOf('utm_') === 0) o[k] = v; }); } catch (e) {}
    return o;
  }
  function lerCookie() {
    var m = document.cookie.match(/(?:^|; )gb_utm=([^;]*)/);
    try { return m ? JSON.parse(decodeURIComponent(m[1])) : null; } catch (e) { return null; }
  }
  var atuais = utmsDaUrl();
  // gclid sem utm = Google Ads (o Google nem sempre manda utm); referrer externo = de onde a pessoa veio (google.com = busca orgânica,
  // instagram.com, l.facebook.com...). Guardado no primeiro acesso, para a origem do lead ficar na nota do Pipedrive (16/10/2026).
  // 07/11/2026: no iPhone o Google Ads manda gbraid/wbraid em vez de gclid; os três ficam guardados para a conversão do Google Ads
  var CLIQUE = {};
  try { var qs = new URLSearchParams(location.search); ['gclid', 'gbraid', 'wbraid'].forEach(function (k) { if (qs.get(k)) CLIQUE[k] = qs.get(k); }); } catch (e) {}
  if (Object.keys(CLIQUE).length && !atuais.utm_source) { atuais.utm_source = 'google'; atuais.utm_medium = 'cpc'; }
  Object.keys(CLIQUE).forEach(function (k) { atuais[k] = CLIQUE[k]; });
  // 30/10/2026: o cookie passa a ser atualizado em toda visita que TEM origem (utm ou site externo) — "último toque identificado".
  // Antes só gravava no primeiro acesso: quem tinha cookie antigo sem origem (anterior a 16/10) ficava "direto" para sempre.
  var ref = ''; try { ref = new URL(document.referrer).hostname.replace(/^www\./, ''); } catch (e) {}
  if (ref === location.hostname.replace(/^www\./, '') || /(^|\.)gobanners\.com\.br$/.test(ref)) ref = '';
  var antigo = lerCookie();
  var temOrigem = !!(atuais.utm_source || ref);
  if (!antigo || (temOrigem && !(antigo.utm_source || antigo.ref)) || atuais.utm_source || (ref && !atuais.utm_source && ref !== antigo.ref)) {
    if (!temOrigem && antigo) atuais = antigo; else {
      atuais.landing = location.pathname;
      if (ref && !atuais.utm_source) atuais.ref = ref;
    }
    // sem origem nenhuma: tenta o cookie de origem do RD Station (__trf.src), que guarda a 1ª sessão desde antes do nosso
    if (!atuais.utm_source && !atuais.ref) {
      try {
        var trf = (document.cookie.match(/(?:^|; )__trf\.src=([^;]*)/) || [])[1];
        if (trf) {
          var j = JSON.parse(atob(decodeURIComponent(trf).replace(/^encoded_/, '')));
          var v = String((j.first_session && j.first_session.value) || '');
          if (/^https?:/.test(v)) { var h = new URL(v).hostname.replace(/^www\./, ''); if (!/(^|\.)gobanners\.com\.br$/.test(h)) atuais.ref = h; }
          else if (/utm_source=/.test(v)) new URLSearchParams(v).forEach(function (x, k) { if (k.indexOf('utm_') === 0) atuais[k] = x; });
          if (atuais.ref || atuais.utm_source) atuais.via = 'rd';
        }
      } catch (e) {}
    }
    document.cookie = 'gb_utm=' + encodeURIComponent(JSON.stringify(atuais)) + '; max-age=' + (90 * 86400) + '; path=/; SameSite=Lax';
  }

  /* ---------- Estilos ---------- */
  var css = '' +
    '.gbc-fundo{position:fixed;inset:0;z-index:2147483000;background:rgba(20,26,51,.55);display:none;opacity:0;transition:opacity .2s}' +
    '.gbc-fundo.on{display:block;opacity:1}' +
    '.gbc-painel{position:fixed;right:20px;bottom:20px;width:420px;height:min(700px,calc(100vh - 40px));z-index:2147483001;' +
      'background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(20,26,51,.35);display:none;transform:translateY(16px);opacity:0;transition:transform .22s,opacity .22s,height .25s}' +
    '.gbc-painel.meia{height:min(460px,calc(100vh - 40px))}' +
    '.gbc-painel.on{display:block;transform:none;opacity:1}' +
    '.gbc-painel.cheia{inset:0;width:auto;height:auto;border-radius:0;box-shadow:none}' +
    '.gbc-painel iframe{width:100%;height:100%;border:0;display:block}' +
    '.gbc-x{position:absolute;top:8px;right:8px;width:34px;height:34px;border-radius:50%;border:1px solid #D3E2F2;background:#fff;color:#17171D;' +
      'font:20px/1 Arial,sans-serif;cursor:pointer;display:grid;place-items:center;box-shadow:0 2px 8px rgba(20,26,51,.15);z-index:2}' +
    '.gbc-bolha{position:fixed;right:20px;bottom:20px;z-index:2147482999;display:inline-flex;align-items:center;gap:10px;' +
      'background:#25D366;color:#fff;border:0;border-radius:999px;padding:12px 20px 12px 14px;font:700 15px/1 Arial,sans-serif;' +
      'cursor:pointer;box-shadow:0 8px 24px rgba(37,211,102,.4);transition:transform .12s}' +
    '.gbc-bolha:hover{transform:translateY(-2px)}' +
    '.gbc-bolha svg{width:22px;height:22px}' +
    'html.gbc-trava{overflow:hidden}' +
    '@media (max-width:640px){' +
      '.gbc-painel{inset:0;width:auto;height:auto;border-radius:0}' +
      '.gbc-bolha{padding:12px 16px 12px 12px;font-size:14px;right:12px;bottom:12px}' +
      '.gbc-x{top:6px;right:6px}' +
    '}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- Elementos ---------- */
  var fundo, painel, frame, bolha, aberto = false, ultimoFoco = null;
  function montar() {
    if (painel) return;
    fundo = document.createElement('div'); fundo.className = 'gbc-fundo';
    painel = document.createElement('div'); painel.className = 'gbc-painel'; painel.setAttribute('role', 'dialog'); painel.setAttribute('aria-label', 'Solicitar orçamento');
    var x = document.createElement('button'); x.className = 'gbc-x'; x.type = 'button'; x.setAttribute('aria-label', 'Fechar'); x.innerHTML = '&times;';
    frame = document.createElement('iframe'); frame.title = 'Solicitar orçamento'; frame.setAttribute('allow', 'clipboard-write');
    painel.appendChild(x); painel.appendChild(frame);
    document.body.appendChild(fundo); document.body.appendChild(painel);
    x.addEventListener('click', fechar);
    fundo.addEventListener('click', fechar);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && aberto) fechar(); });
    window.addEventListener('message', function (e) {
      if (e.origin !== ORIGEM) return;
      var d = e.data || {};
      if (d.gobanners === 'fechar') fechar();
      if (d.gobanners === 'interagiu') painel.classList.remove('meia');   // abriu sozinha pela metade: cresce quando a pessoa começa a responder
      // lead concluído no chat (07/11/2026): avisa o Google Tag Manager / GA4 do site (o Google Ads é avisado pela própria página do chat)
      if (d.gobanners === 'lead') {
        try { (window.dataLayer = window.dataLayer || []).push({ event: 'gobanners_lead', gobanners_produto: d.produto || '' }); } catch (err) {}
        // o generate_lead do GA4 sai da própria página do chat (24/11/2026); aqui repetiria a contagem
      }
      if (d.gobanners === 'expandir') { try { frame.contentWindow.postMessage({ gobanners: 'expandido' }, ORIGEM); } catch (err) {} }
    });
  }

  function urlDoChat(opts) {
    var p = new URLSearchParams();
    if (opts.cheia) p.set('tela', 'cheia'); else p.set('embed', '1');
    p.set('origem', location.pathname);
    if (opts.produto_id) p.set('produto_id', opts.produto_id);
    if (opts.produto_nome) p.set('produto_nome', opts.produto_nome);
    if (opts.modo) p.set('modo', opts.modo);
    var u = Object.assign({}, lerCookie() || {}, utmsDaUrl());
    Object.keys(u).forEach(function (k) { if (k.indexOf('utm_') === 0) p.set(k, u[k]); });
    if (u.landing) p.set('landing', u.landing);
    if (u.ref) p.set('ref', u.ref);
    ['gclid', 'gbraid', 'wbraid'].forEach(function (k) { if (u[k]) p.set(k, u[k]); });
    return BASE + '?' + p.toString();
  }

  var srcAtual = null;
  function abrir(opts) {
    opts = opts || {};
    if (opts.cheia && NOVA_ABA) { window.open(urlDoChat(opts), '_blank', 'noopener'); return; }
    montar();
    jaAbriu();
    painel.classList.toggle('cheia', !!opts.cheia);
    painel.classList.toggle('meia', !!opts.auto);
    var src = urlDoChat(opts);
    if (src !== srcAtual) {   // mesma conversa se reabrir com o mesmo contexto
      // replace(): troca a página do iframe SEM criar entrada no histórico do navegador
      // (com frame.src o "voltar" do navegador voltava o iframe para a tela anterior, sem cabeçalho)
      var alvo = src + (opts.auto ? '&auto=1' : '');   // auto=1: a página do chat se arruma para caber na metade da altura
      try { frame.contentWindow.location.replace(alvo); } catch (e) { frame.src = alvo; }
      srcAtual = src;
    }
    painel.classList.add('on');
    if (bolha) bolha.style.display = 'none';
    if (opts.auto) { aberto = true; return; }   // subiu sozinha: não escurece a página, não trava a rolagem, não rouba o foco
    ultimoFoco = document.activeElement;
    fundo.classList.add('on');
    document.documentElement.classList.add('gbc-trava');
    if (!(history.state && history.state.gbc)) { try { history.pushState({ gbc: 1 }, ''); } catch (e) {} }   // "voltar" do navegador fecha o chat em vez de sair do site
    aberto = true;
    try { frame.contentWindow.postMessage({ gobanners: (MOBILE() || opts.cheia) ? 'expandido' : 'recolhido' }, ORIGEM); } catch (e) {}
    setTimeout(function () { try { frame.focus(); } catch (e) {} }, 250);
  }
  function fechar() {
    if (!aberto) return;
    // se foi a gente que empilhou a entrada no histórico, volta uma: o popstate abaixo fecha de fato
    if (history.state && history.state.gbc) { history.back(); return; }
    fecharAgora();
  }
  window.addEventListener('popstate', function () { if (aberto) fecharAgora(); });
  function fecharAgora() {
    if (!aberto) return;
    fundo.classList.remove('on'); painel.classList.remove('on');
    if (bolha) bolha.style.display = '';
    document.documentElement.classList.remove('gbc-trava');
    aberto = false;
    if (ultimoFoco && ultimoFoco.focus) { try { ultimoFoco.focus(); } catch (e) {} }
  }

  /* ---------- Abre sozinha depois de um tempo (23/11/2026, como o Leadster fazia) ----------
     Só no computador (no celular o chat ocupa a tela inteira), uma vez por visita, e nunca depois de a pessoa já ter aberto ou fechado. */
  function jaAbriu() { try { sessionStorage.setItem('gbc_abriu', '1'); } catch (e) {} }
  function abriuAntes() { try { return sessionStorage.getItem('gbc_abriu') === '1'; } catch (e) { return false; } }
  function agendarAuto() {
    if (!AUTO || !FLUTUANTE || abriuAntes()) return;
    var tentar = function () {
      if (aberto || abriuAntes() || MOBILE()) return;
      if (document.visibilityState !== 'visible') { document.addEventListener('visibilitychange', function v() { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', v); setTimeout(tentar, 2000); } }); return; }
      abrir(Object.assign({}, window.GB_CHAT || {}, { cheia: false, auto: true }));
    };
    setTimeout(tentar, AUTO * 1000);
  }

  /* ---------- Gatilhos: links/botões do site ---------- */
  function opcoesDe(el) {
    var d = el.dataset || {};
    var o = { produto_id: d.produtoId || d.gbProdutoId || '', produto_nome: d.produtoNome || d.gbProdutoNome || '', modo: d.gbChat && d.gbChat !== '' ? d.gbChat : '' };
    if (!o.produto_id && window.GB_CHAT && window.GB_CHAT.produto_id) { o.produto_id = window.GB_CHAT.produto_id; o.produto_nome = window.GB_CHAT.produto_nome || ''; }
    return o;
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('a[href], .gb-abrir-chat, [data-gb-chat]');
    if (!el) return;
    var href = el.getAttribute('href') || '';
    // link fixo para o chat (banner da lateral, botão de página antiga): leva junto a origem guardada no cookie, senão o lead
    // chega como "direto" (10/11/2026, caso Creme Americano: origem banner-sidebar, sem utm, sem ref, sem landing)
    try {
      if (href.indexOf(BASE) === 0 && !/[?&](utm_source|ref|landing|gclid|gbraid|wbraid)=/.test(href)) {
        var U = new URL(href), ck = Object.assign({}, lerCookie() || {}, utmsDaUrl());
        Object.keys(ck).forEach(function (k) { if ((k.indexOf('utm_') === 0 || /^(landing|ref|gclid|gbraid|wbraid)$/.test(k)) && ck[k] && !U.searchParams.get(k)) U.searchParams.set(k, ck[k]); });
        el.setAttribute('href', U.toString()); href = U.toString();
      }
    } catch (err) {}
    var direto = /#(orcamento|contato)$/.test(href) || el.matches('.gb-abrir-chat, [data-gb-chat]');
    var legado = INTERCEPTAR && WA_CENTRAL.test(href);
    if (!direto && !legado) return;
    e.preventDefault(); e.stopImmediatePropagation();   // impede o tema de abrir o modal antigo do formulário
    var o = opcoesDe(el); o.cheia = true;
    if (!o.modo && (/#contato/.test(href) || WA_CENTRAL.test(href))) o.modo = 'contato';
    abrir(o);
  }, true);

  /* ---------- Botão flutuante ---------- */
  function montarBolha() {
    if (!FLUTUANTE || bolha) return;
    bolha = document.createElement('button'); bolha.type = 'button'; bolha.className = 'gbc-bolha';
    bolha.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.9 2.9 4.6 4 1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg><span></span>'; bolha.querySelector('span').textContent = TEXTO;
    bolha.addEventListener('click', function () { abrir(Object.assign({}, window.GB_CHAT || {}, { cheia: false })); });
    document.body.appendChild(bolha);
    vigiarRodape();
    agendarAuto();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montarBolha); else montarBolha();

  /* Aviso de cookies (ou qualquer faixa fixa no rodapé): a bolha sobe para não cobrir o botão "Aceitar" no celular */
  function alturaFaixaRodape() {
    var sel = '[class*="cookie" i],[id*="cookie" i],[class*="consent" i],[id*="consent" i],[class*="gdpr" i],[id*="gdpr" i],[class*="cmplz" i],[class*="lgpd" i],[id*="lgpd" i]';
    var lista = []; try { lista = Array.prototype.slice.call(document.querySelectorAll(sel)); } catch (e) {}
    /* plugins que não se identificam na classe (ex.: aviso do RD Station): qualquer caixa fixa perto do rodapé falando de cookies */
    var raiz = document.body.children;
    for (var a = 0; a < raiz.length; a++) {
      var c = raiz[a]; if (lista.indexOf(c) < 0 && /cookie/i.test(c.textContent || '') && (c.textContent || '').length < 2000) lista.push(c);
      var netos = c.children; for (var b = 0; b < netos.length && b < 30; b++) { var d = netos[b]; if (lista.indexOf(d) < 0 && /cookie/i.test(d.textContent || '') && (d.textContent || '').length < 2000) lista.push(d); }
    }
    var h = 0;
    for (var i = 0; i < lista.length; i++) {
      var el = lista[i];
      if (el === bolha || el === painel || (painel && painel.contains(el))) continue;
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
      var r = el.getBoundingClientRect();
      if (r.height < 40 || r.width < window.innerWidth * 0.5 || r.bottom < window.innerHeight - 60) continue;   // só faixas largas coladas no rodapé
      h = Math.max(h, Math.min(window.innerHeight - r.top, window.innerHeight * 0.7));
    }
    return h;
  }
  function ajustarBolha() {
    if (!bolha) return;
    var h = alturaFaixaRodape();
    bolha.style.bottom = h ? (h + 12) + 'px' : '';
  }
  function vigiarRodape() {
    var agendado = null;
    var pedir = function () { if (agendado) return; agendado = setTimeout(function () { agendado = null; ajustarBolha(); }, 150); };
    ajustarBolha();
    if (window.MutationObserver) new MutationObserver(pedir).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    window.addEventListener('resize', pedir);
    var n = 0, t = setInterval(function () { ajustarBolha(); if (++n > 30) clearInterval(t); }, 1000);   // plugins que aparecem com atraso
  }

  /* abre sozinho se a página foi carregada com #orcamento (links de e-mail, anúncios) */
  if (/^#(orcamento|contato)$/.test(location.hash)) {
    var m = location.hash === '#contato' ? 'contato' : '';
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { abrir({ modo: m, cheia: true }); }); else abrir({ modo: m, cheia: true });
  }

  window.__gbChat = { abrir: abrir, fechar: fechar };
})();
