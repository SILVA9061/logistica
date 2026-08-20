// ==========================================
// 1. CONFIGURAÇÃO SUPABASE E GOOGLE DRIVE
// ==========================================
const supabaseUrl = 'https://qrmywcvsvkrqtapgkmnj.supabase.co';
const supabaseKey = 'sb_publishable_HvS_fAvGc9ToE-CXLkDDzw_EstUEqoN';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// URL Corrigida e Restaurada
const URL_GOOGLE_SCRIPT = 'https://script.google.com/macros/s/AKfycbyTYb1WBCcYWBGtpDG8Xyktc6UuFvltMYKd1W5E0OeVzg1iJFvmKoxw6Fr2QCbUmJwNbw/exec';

let usuarioLogado = null;
let abaAtualPedidos = 'ativos';
let filtroSupIdSelecionado = '';
let filtroCardAtivo = null;

// Variáveis da Paginação Infinita
let memoriaPedidos = [];
let paginaAtualPedidos = 0;
const itensPorPagina = 20;
let carregandoPedidos = false;
let todosPedidosCarregados = false;

// Gatilho do Infinite Scroll na tabela de pedidos
document.getElementById('tela-pedidos').addEventListener('scroll', function() {
    if (this.scrollHeight - this.scrollTop - this.clientHeight < 100) {
        carregarPedidos(false); 
    }
});

// ==========================================
// 2. FUNÇÕES AUXILIARES, MODAIS GLOBAIS E UI
// ==========================================

// Função para abrir e fechar o Menu Mobile
function toggleMenuMobile() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('menu-overlay');
    
    if (sidebar.classList.contains('aberto')) {
        sidebar.classList.remove('aberto');
        overlay.style.display = 'none';
    } else {
        sidebar.classList.add('aberto');
        overlay.style.display = 'block';
    }
}

function mostrarAviso(mensagem, tipo = 'erro') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${tipo === 'sucesso' ? '#00e5b0' : '#ff4d4d'}; color: ${tipo === 'sucesso' ? '#002b22' : '#ffffff'}; 
        padding: 12px 20px; border-radius: 8px; font-weight: bold; display: flex; align-items: center; gap: 10px; 
        box-shadow: 0 4px 15px rgba(0,0,0,0.3); opacity: 0; transform: translateY(20px); transition: all 0.3s; z-index: 99999; cursor: pointer;
    `;
    
    const icone = tipo === 'sucesso' ? '<i data-lucide="check-circle"></i>' : '<i data-lucide="alert-circle"></i>';
    toast.innerHTML = `${icone} <span style="flex: 1;">${mensagem}</span>`;
    
    toast.onclick = () => {
        toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; setTimeout(() => toast.remove(), 300);
    };

    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 10);
    setTimeout(() => { if(toast.parentElement) { toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; setTimeout(() => toast.remove(), 300); } }, 4000);
}

let callbackConfirmacaoAtual = null;

function confirmarAcao(mensagem, callback) {
    document.getElementById('texto-confirmacao').innerText = mensagem;
    callbackConfirmacaoAtual = callback;
    document.getElementById('modal-confirmacao').style.display = 'flex';
    lucide.createIcons();
}

function fecharConfirmacao() {
    document.getElementById('modal-confirmacao').style.display = 'none';
    callbackConfirmacaoAtual = null;
}

document.getElementById('btn-confirmar-sim').addEventListener('click', () => {
    if (callbackConfirmacaoAtual) callbackConfirmacaoAtual();
    fecharConfirmacao();
});

function setCarregamento(btnId, isCarregando, textoCarregando = 'Aguarde...') {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isCarregando) {
        if (!btn.dataset.textoOriginal) btn.dataset.textoOriginal = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="loader" class="lucide-sm spinner"></i> ${textoCarregando}`;
        btn.style.pointerEvents = 'none'; btn.style.opacity = '0.7';
    } else {
        btn.innerHTML = btn.dataset.textoOriginal || 'Confirmar';
        btn.style.pointerEvents = 'auto'; btn.style.opacity = '1';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

let arquivosBancada = [];

function lidarComSelecaoDeFotos(input) {
    if (input.files) {
        Array.from(input.files).forEach(file => {
            if(file.type.startsWith('image/')) arquivosBancada.push(file);
        });
    }
    input.value = ''; 
    renderizarMiniaturasBancada();
}

function removerFotoBancada(index) {
    arquivosBancada.splice(index, 1);
    renderizarMiniaturasBancada();
}

function renderizarMiniaturasBancada() {
    const container = document.getElementById('preview-fotos-bancada');
    const span = document.getElementById('nome-arquivo-pedido');
    container.innerHTML = '';

    if (arquivosBancada.length === 1) span.innerText = `1 arquivo selecionado`;
    else if (arquivosBancada.length > 1) span.innerText = `${arquivosBancada.length} arquivos selecionados`;
    else span.innerText = "Clique ou arraste as fotos da bancada";

    arquivosBancada.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'preview-img-wrapper';
            div.innerHTML = `
                <img src="${e.target.result}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 2px solid rgba(0, 229, 176, 0.4);">
                <button type="button" class="btn-remover-foto" onclick="removerFotoBancada(${index})" title="Remover"><i data-lucide="x" style="width:14px;height:14px;"></i></button>
            `;
            container.appendChild(div);
            lucide.createIcons();
        }
        reader.readAsDataURL(file);
    });
}

function atualizarNomeArquivo(input, idTexto) {
    const span = document.getElementById(idTexto);
    if (input.files.length === 1) span.innerText = "Arquivo: " + input.files[0].name;
    else if (input.files.length > 1) span.innerText = `${input.files.length} arquivos selecionados`;
    else span.innerText = "Clique para anexar foto";
}

async function fazerUploadDrive(file, prefixo) {
    const fotoComprimida = await imageCompression(file, { maxSizeMB: 5, maxWidthOrHeight: 4096, useWebWorker: true, initialQuality: 0.95 });
    const base64 = await new Promise((resolve) => { 
        const reader = new FileReader(); reader.onloadend = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(fotoComprimida); 
    });
    const resposta = await fetch(URL_GOOGLE_SCRIPT, { 
        method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ base64: base64, nomeArquivo: `${prefixo}_${Date.now()}.jpg`, mimeType: fotoComprimida.type })
    });
    const dados = await resposta.json();
    if (!dados.sucesso) throw new Error("Falha no Google Drive.");
    return dados.url;
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.custom-select-wrapper')) { 
        const opts = document.getElementById('custom-options-sup'); 
        if (opts) opts.classList.remove('show'); 
    }
});

function selecionarFiltroSupervisorCustom(id, nome) {
    document.getElementById('filtro-sup-texto').innerText = nome; 
    filtroSupIdSelecionado = id;
    document.getElementById('custom-options-sup').classList.remove('show'); 
    carregarPedidos(true); 
}

// ==========================================
// 3. NAVEGAÇÃO E LOGIN 
// ==========================================
function alternarTelaLogin(isCadastro) {
    document.getElementById('form-login').style.display = isCadastro ? 'none' : 'block';
    document.getElementById('form-cadastro').style.display = isCadastro ? 'block' : 'none';
}

window.onload = () => { 
    const sessao = localStorage.getItem('usuarioLogado'); 
    if (sessao) { usuarioLogado = JSON.parse(sessao); iniciarAplicativo(); } 
};

async function fazerLogin() {
    const email = document.getElementById('login-email').value.trim(); const senha = document.getElementById('login-senha').value.trim();
    if (!email || !senha) return mostrarAviso('Preencha e-mail e senha!', 'erro');
    setCarregamento('btn-login', true, 'Autenticando...');
    try {
        const { data, error } = await supabaseClient.from('usuarios').select('*').eq('email', email).eq('senha', senha).single();
        if (error || !data) throw new Error();
        usuarioLogado = data; localStorage.setItem('usuarioLogado', JSON.stringify(data));
        mostrarAviso(`Bem-vindo, ${data.nome}!`, 'sucesso'); iniciarAplicativo();
    } catch (erro) { mostrarAviso('Credenciais inválidas.', 'erro'); } finally { setCarregamento('btn-login', false); }
}

async function fazerCadastro() {
    const nome = document.getElementById('cad-nome').value.trim(); const email = document.getElementById('cad-email').value.trim(); const senha = document.getElementById('cad-senha').value.trim();
    if (!nome || !email || !senha) return mostrarAviso('Preencha todos os campos!', 'erro');
    setCarregamento('btn-cadastrar', true, 'Criando...');
    try {
        const { data, error } = await supabaseClient.from('usuarios').insert([{ nome, email, senha, cargo: 'Supervisor' }]).select().single();
        if (error) throw error;
        usuarioLogado = data; localStorage.setItem('usuarioLogado', JSON.stringify(data)); iniciarAplicativo();
    } catch (erro) { mostrarAviso('Erro ao criar conta ou e-mail já existe.', 'erro'); } finally { setCarregamento('btn-cadastrar', false); }
}

function iniciarAplicativo() {
    document.getElementById('tela-login').style.display = 'none'; document.getElementById('tela-app').style.display = 'flex';
    document.getElementById('label-nome-usuario').innerHTML = `${usuarioLogado.nome}<br><span style="color:var(--primary)">${usuarioLogado.cargo}</span>`;
    renderizarMenuDinamico(); lucide.createIcons(); carregarPedidos(true); carregarLojasSelect(); carregarVitrineAdmin(); 
}

function fazerLogout() { localStorage.removeItem('usuarioLogado'); window.location.reload(); }

function renderizarMenuDinamico() {
    const menu = document.getElementById('sidebar-menu-dinamico');
    let html = `<a href="#" class="sidebar-link ativo" onclick="mostrarTela('tela-pedidos')"><i data-lucide="clipboard-list"></i> Pedidos <span id="badge-menu-pedidos" class="menu-badge" style="display:none;">0</span></a>`;

    if (usuarioLogado.cargo === 'Logistica' || usuarioLogado.cargo === 'Diretor') {
        html += `<a href="#" class="sidebar-link" onclick="mostrarTela('tela-gerenciar-catalogo')"><i data-lucide="settings"></i> Catálogo</a>`;
        html += `<a href="#" class="sidebar-link" onclick="mostrarTela('tela-gerenciar-usuarios')"><i data-lucide="users"></i> Equipe e Lojas</a>`;
    } else if (usuarioLogado.cargo === 'Supervisor') {
        html += `<a href="#" class="sidebar-link" onclick="mostrarTela('tela-fazer-pedido')"><i data-lucide="shopping-cart"></i> Novo Pedido</a>`;
        html += `<a href="#" class="sidebar-link" onclick="mostrarTela('tela-gerenciar-usuarios')"><i data-lucide="store"></i> Minhas Lojas</a>`;
    }

    menu.innerHTML = html;
    
    const btnExportar = document.getElementById('btn-exportar-excel');
    if (btnExportar) {
        if (usuarioLogado.cargo === 'Diretor' || usuarioLogado.cargo === 'Logistica') btnExportar.style.display = 'flex';
        else btnExportar.style.display = 'none';
    }

    const filtroSupCustom = document.getElementById('filtro-supervisor-custom');
    if (filtroSupCustom && usuarioLogado.cargo !== 'Supervisor') {
        filtroSupCustom.style.display = 'block'; carregarFiltroSupervisoresCustom();
    }
    
    const tituloUsuarios = document.getElementById('titulo-tela-usuarios');
    const btnNovoUsuario = document.getElementById('btn-novo-usuario');
    const containerTabelaUsuarios = document.getElementById('container-tabela-usuarios');
    const containerTabelaLojas = document.getElementById('container-tabela-lojas');

    if (usuarioLogado.cargo === 'Supervisor') {
        if (tituloUsuarios) tituloUsuarios.innerText = 'Minhas Lojas';
        if (btnNovoUsuario) btnNovoUsuario.style.display = 'none';
        if (containerTabelaUsuarios) containerTabelaUsuarios.style.display = 'none';
        if (containerTabelaLojas) containerTabelaLojas.style.gridColumn = '1 / -1';
    } else {
        if (tituloUsuarios) tituloUsuarios.innerText = 'Gerenciar Equipe e Lojas';
        if (btnNovoUsuario) btnNovoUsuario.style.display = 'flex';
        if (containerTabelaUsuarios) containerTabelaUsuarios.style.display = 'block';
        if (containerTabelaLojas) containerTabelaLojas.style.gridColumn = 'auto';
    }
    lucide.createIcons();
}

function mostrarTela(idTela) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('aberto')) toggleMenuMobile();

    ['tela-pedidos', 'tela-fazer-pedido', 'tela-gerenciar-catalogo', 'tela-gerenciar-usuarios'].forEach(tela => { 
        const el = document.getElementById(tela); if (el) el.style.display = (tela === idTela) ? 'block' : 'none'; 
    });
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('ativo')); 
    if (event && event.currentTarget) event.currentTarget.classList.add('ativo');
    
    if (idTela === 'tela-pedidos') carregarPedidos(true); 
    if (idTela === 'tela-fazer-pedido') { carregarLojasSelect(); carregarCatalogoPedido(); }
    if (idTela === 'tela-gerenciar-catalogo') carregarVitrineAdmin(); 
    if (idTela === 'tela-gerenciar-usuarios') { carregarTabelaUsuarios(); carregarTabelaLojas(); carregarSupervisoresModal(); }
}

// ==========================================
// 4. MOTOR DE AGRUPAMENTO DE PRODUTOS
// ==========================================
function agruparCatalogo(dados_brutos) {
    const grupos = {};
    
    dados_brutos.forEach(item => {
        let baseName = item.nome ? item.nome.trim() : 'Material Sem Nome';
        let varName = 'Único';

        // Correção: Regex guloso (.*) que aceita parênteses DENTRO do nome da variação
        const match = baseName.match(/^(.*) \((.*)\)$/);
        if (match) { baseName = match[1].trim(); varName = match[2].trim(); }

        const categoriaSegura = item.categoria ? item.categoria.trim() : 'Geral';
        const chave = baseName.toLowerCase() + '_' + categoriaSegura.toLowerCase();
        
        if (!grupos[chave]) {
            grupos[chave] = {
                nome_base: baseName, categoria: categoriaSegura,
                subcategoria: item.subcategoria ? item.subcategoria.split(' | ')[0].trim() : '',
                foto_url: item.foto_url, ids_grupo: [], variacoes: []
            };
        }
        
        grupos[chave].ids_grupo.push(item.id);
        grupos[chave].variacoes.push({
            id: item.id, nome_var: varName, quantidade: item.quantidade || 0, 
            qtdSelecionada: item.qtdSelecionada || 0, nome_original: item.nome
        });
    });
    
    Object.values(grupos).forEach(g => g.variacoes.sort((a,b) => a.nome_var.localeCompare(b.nome_var)));
    return Object.values(grupos);
}

// ==========================================
// 4.1. VITRINE (ADMIN) E CATEGORIAS DINÂMICAS
// ==========================================
let memoriaCatalogo = [];
let categoriaAtivaAdmin = 'Todos';

function abrirModalNovoProduto() {
    document.getElementById('input-nome-produto').value = ''; document.getElementById('input-subcategoria').value = '';
    document.getElementById('input-qtd-produto').value = '0'; document.getElementById('container-grade-tamanhos').innerHTML = '';
    document.getElementById('input-foto-produto').value = ''; document.getElementById('nome-arquivo-produto').innerText = 'Clique para anexar foto';
    document.getElementById('input-categoria').style.display = 'block'; document.getElementById('input-nova-categoria').style.display = 'none';
    document.getElementById('input-nova-categoria').value = ''; 
    document.getElementById('btn-toggle-categoria').innerText = '+ Criar Nova Categoria'; document.getElementById('btn-toggle-categoria').style.color = 'var(--primary)';
    
    verificarEstoqueGlobal(); carregarCategoriasSelect(); 
    document.getElementById('modal-novo-produto').style.display = 'flex'; lucide.createIcons();
}

function toggleNovaCategoria(prefix) {
    const sel = document.getElementById(`${prefix}-categoria`); const inp = document.getElementById(`${prefix}-nova-categoria`); const btn = document.getElementById(`btn-toggle-${prefix === 'edit' ? 'edit-' : ''}categoria`);
    if (sel.style.display === 'none') { sel.style.display = 'block'; inp.style.display = 'none'; inp.value = ''; btn.innerText = '+ Criar Nova Categoria'; btn.style.color = 'var(--primary)'; } 
    else { sel.style.display = 'none'; inp.style.display = 'block'; btn.innerText = 'Voltar para lista'; btn.style.color = 'var(--cor-secundaria)'; }
}

async function carregarCategoriasSelect() {
    try {
        const { data } = await supabaseClient.from('catalogo').select('categoria').eq('ativo', true);
        if (data) {
            const categorias = [...new Set(data.map(i => i.categoria).filter(Boolean))].sort();
            ['input-categoria', 'edit-categoria'].forEach(selId => {
                const el = document.getElementById(selId);
                if (el) { el.innerHTML = '<option value="Geral">Geral</option>'; categorias.forEach(c => { if(c !== 'Geral') el.innerHTML += `<option value="${c}">${c}</option>`; }); }
            });
        }
    } catch (e) {}
}

function adicionarLinhaGrade(variacao = '', qtd = '0') {
    const container = document.getElementById('container-grade-tamanhos'); const div = document.createElement('div');
    div.style.cssText = "display: flex; gap: 10px; align-items: center; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);";
    div.innerHTML = `<input type="text" class="input-neon input-tamanho" placeholder="Variação (Ex: A6x, Preto, G)" value="${variacao}" style="margin:0; flex:2; border-color: rgba(255,255,255,0.1);"><input type="number" class="input-neon input-qtd-tamanho" placeholder="Qtd" value="${qtd}" style="margin:0; flex:1; border-color: rgba(255,255,255,0.1);" min="0"><button type="button" onclick="this.parentElement.remove(); verificarEstoqueGlobal();" style="background:rgba(255,77,77,0.1); border:none; color:#ff4d4d; cursor:pointer; padding:8px; border-radius: 6px;"><i data-lucide="trash-2" style="width:16px; height:16px;"></i></button>`;
    container.appendChild(div); lucide.createIcons(); verificarEstoqueGlobal();
}

function adicionarLinhaGradeEdit(variacao = '', qtd = '0') {
    const container = document.getElementById('container-grade-edit'); const div = document.createElement('div');
    div.style.cssText = "display: flex; gap: 10px; align-items: center; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);";
    div.innerHTML = `<input type="text" class="input-neon edit-tamanho" placeholder="Variação" value="${variacao}" style="margin:0; flex:2; border-color: rgba(255,255,255,0.1);"><input type="number" class="input-neon edit-qtd-tamanho" placeholder="Qtd" value="${qtd}" style="margin:0; flex:1; border-color: rgba(255,255,255,0.1);" min="0"><button type="button" onclick="this.parentElement.remove(); verificarEstoqueGlobalEdit();" style="background:rgba(255,77,77,0.1); border:none; color:#ff4d4d; cursor:pointer; padding:8px; border-radius: 6px;"><i data-lucide="trash-2" style="width:16px; height:16px;"></i></button>`;
    container.appendChild(div); lucide.createIcons(); verificarEstoqueGlobalEdit();
}

function verificarEstoqueGlobal() {
    const linhas = document.querySelectorAll('#container-grade-tamanhos > div'); const boxGlobal = document.getElementById('container-estoque-global');
    if (boxGlobal) { if (linhas.length > 0) boxGlobal.style.display = 'none'; else boxGlobal.style.display = 'block'; }
}

function verificarEstoqueGlobalEdit() {
    const linhas = document.querySelectorAll('#container-grade-edit > div'); const boxGlobal = document.getElementById('container-estoque-global-edit');
    if (boxGlobal) { if (linhas.length > 0) boxGlobal.style.display = 'none'; else boxGlobal.style.display = 'block'; }
}

function consertarLinkGoogleDrive(url) {
    if (!url) return ''; let id = '';
    if (url.includes('/d/')) id = url.split('/d/')[1].split('/')[0];
    else if (url.includes('id=')) id = url.split('id=')[1].split('&')[0];
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w800` : url;
}

async function carregarVitrineAdmin() {
    const vitrine = document.getElementById('vitrine-admin'); if(!vitrine) return;
    vitrine.innerHTML = '<div style="color: var(--cor-secundaria); padding: 20px;"><i data-lucide="loader" class="spinner"></i> Organizando prateleiras...</div>'; lucide.createIcons();
    try {
        const { data, error } = await supabaseClient.from('catalogo').select('*').eq('ativo', true).order('categoria').order('nome');
        if (error) throw error;
        memoriaCatalogo = data || []; renderizarCategoriasAdmin(); renderizarVitrine();
    } catch (e) { vitrine.innerHTML = `<div style="color: #ff4d4d; padding: 20px;">Erro ao carregar catálogo: ${e.message || 'Desconhecido'}</div>`; }
}

function renderizarCategoriasAdmin() {
    const nav = document.getElementById('nav-categorias-admin'); if(!nav) return;
    const categorias = [...new Set(memoriaCatalogo.map(i => i.categoria || 'Geral'))].sort();
    let html = `<button class="categoria-pill ${categoriaAtivaAdmin === 'Todos' ? 'ativo' : ''}" onclick="filtrarVitrineAdmin('Todos')">Todos os Itens</button>`;
    categorias.forEach(c => { html += `<button class="categoria-pill ${categoriaAtivaAdmin === c ? 'ativo' : ''}" onclick="filtrarVitrineAdmin('${c}')">${c}</button>`; });
    nav.innerHTML = html;
}

function filtrarVitrineAdmin(cat) { categoriaAtivaAdmin = cat; renderizarCategoriasAdmin(); renderizarVitrine(); }

function renderizarVitrine() {
    const vitrine = document.getElementById('vitrine-admin');
    const catalogAgrupado = agruparCatalogo(memoriaCatalogo);
    let filtrados = catalogAgrupado;
    
    if (categoriaAtivaAdmin !== 'Todos') filtrados = catalogAgrupado.filter(i => (i.categoria || 'Geral') === categoriaAtivaAdmin);
    vitrine.innerHTML = '';
    if (filtrados.length === 0) { vitrine.innerHTML = '<div style="color: var(--cor-secundaria); padding: 20px;">Nenhum material encontrado.</div>'; return; }

    filtrados.forEach(grupo => {
        const linkCorrigido = consertarLinkGoogleDrive(grupo.foto_url);
        const fotoHtml = linkCorrigido ? `<img src="${linkCorrigido}" loading="lazy" onerror="this.onerror=null; this.outerHTML='<div class=\\'produto-img-placeholder\\'><span>Sem Imagem</span></div>';">` : `<div class="produto-img-placeholder"><span>Sem Imagem</span></div>`;
        
        let chipsHtml = '';
        grupo.variacoes.forEach(v => {
            const classeFalta = v.quantidade <= 0 ? 'falta' : '';
            chipsHtml += `<span class="var-chip ${classeFalta}">${v.nome_var === 'Único' ? 'UN' : v.nome_var}: ${v.quantidade}</span>`;
        });

        const objStr = JSON.stringify(grupo).replace(/"/g, '&quot;');

        vitrine.innerHTML += `
            <div class="produto-card">
                <div class="produto-img-container">${fotoHtml}</div>
                <div class="produto-info">
                    <h4>${grupo.nome_base}</h4>
                    <p>${grupo.categoria || 'Geral'} ${grupo.subcategoria ? '> ' + grupo.subcategoria : ''}</p>
                    <div class="var-chips-container">${chipsHtml}</div>
                </div>
                <div class="produto-acoes">
                    <button onclick="abrirModalEditarProduto('${objStr}')"><i data-lucide="edit-2" class="lucide-sm"></i> Editar Lote</button>
                    <button class="btn-excluir-prod" onclick="excluirProdutoGrupo('${JSON.stringify(grupo.ids_grupo)}', this)"><i data-lucide="trash-2" class="lucide-sm"></i> Excluir Lote</button>
                </div>
            </div>`;
    }); lucide.createIcons();
}

async function salvarProduto() {
    const nomeBase = document.getElementById('input-nome-produto').value.trim(); const subCatBase = document.getElementById('input-subcategoria').value.trim(); const qtdGlobal = parseInt(document.getElementById('input-qtd-produto').value) || 0; const inputFoto = document.getElementById('input-foto-produto');
    let categoria = document.getElementById('input-nova-categoria').style.display === 'block' ? document.getElementById('input-nova-categoria').value.trim() : document.getElementById('input-categoria').value;
    if (!categoria) categoria = 'Geral';
    if (!nomeBase) return mostrarAviso('Digite o nome do material.', 'erro');
    
    setCarregamento('btn-salvar-produto', true, 'Processando...');
    try {
        let fotoUrl = null; if (inputFoto.files.length > 0) { mostrarAviso('Salvando foto no Drive...', 'sucesso'); fotoUrl = await fazerUploadDrive(inputFoto.files[0], 'catalogo'); }
        const linhasGrade = document.querySelectorAll('#container-grade-tamanhos > div');
        
        if (linhasGrade.length > 0) {
            for (let linha of linhasGrade) {
                const varName = linha.querySelector('.input-tamanho').value.trim(); const qtd = parseInt(linha.querySelector('.input-qtd-tamanho').value) || 0;
                if(varName) { 
                    const { error } = await supabaseClient.from('catalogo').insert([{ 
                        nome: `${nomeBase} (${varName})`, categoria: categoria, subcategoria: subCatBase ? `${subCatBase} | ${varName}` : `${varName}`, 
                        quantidade: qtd, foto_url: fotoUrl, ativo: true, secao: ''
                    }]); 
                    if(error) throw error;
                }
            }
        } else { 
            const { error } = await supabaseClient.from('catalogo').insert([{ nome: nomeBase, categoria: categoria, subcategoria: subCatBase, quantidade: qtdGlobal, foto_url: fotoUrl, ativo: true, secao: '' }]); 
            if(error) throw error;
        }

        mostrarAviso('Material adicionado!', 'sucesso'); document.getElementById('modal-novo-produto').style.display = 'none'; carregarVitrineAdmin();
    } catch (e) { 
        console.error("ERRO NO BANCO:", e);
        mostrarAviso('Erro ao salvar. Verifique a conexão.', 'erro'); 
    } finally { setCarregamento('btn-salvar-produto', false); }
}

async function abrirModalEditarProduto(grupoStr) {
    const g = JSON.parse(grupoStr); await carregarCategoriasSelect();
    
    document.getElementById('edit-ids-grupo').value = JSON.stringify(g.ids_grupo);
    document.getElementById('edit-nome-produto').value = g.nome_base; 
    document.getElementById('edit-subcategoria').value = g.subcategoria || ''; 
    document.getElementById('edit-categoria').style.display = 'block'; document.getElementById('edit-nova-categoria').style.display = 'none'; 
    document.getElementById('btn-toggle-edit-categoria').innerText = '+ Criar Nova Categoria'; document.getElementById('btn-toggle-edit-categoria').style.color = 'var(--primary)';
    
    const selCat = document.getElementById('edit-categoria'); const catExiste = Array.from(selCat.options).some(opt => opt.value === g.categoria);
    if(catExiste) selCat.value = g.categoria; else selCat.value = 'Geral';

    const containerEdit = document.getElementById('container-grade-edit');
    containerEdit.innerHTML = '';
    
    if (g.variacoes.length === 1 && g.variacoes[0].nome_var === 'Único') {
        document.getElementById('edit-qtd-produto').value = g.variacoes[0].quantidade;
    } else {
        g.variacoes.forEach(v => {
            if(v.nome_var !== 'Único') adicionarLinhaGradeEdit(v.nome_var, v.quantidade);
        });
    }

    verificarEstoqueGlobalEdit();
    document.getElementById('modal-editar-produto').style.display = 'flex'; lucide.createIcons();
}

async function salvarEdicaoProduto() {
    const idsAntigosRaw = document.getElementById('edit-ids-grupo').value;
    const nomeBase = document.getElementById('edit-nome-produto').value.trim();
    const subCatBase = document.getElementById('edit-subcategoria').value.trim();
    const qtdGlobal = parseInt(document.getElementById('edit-qtd-produto').value) || 0;
    
    let categoria = document.getElementById('edit-nova-categoria').style.display === 'block' ? document.getElementById('edit-nova-categoria').value.trim() : document.getElementById('edit-categoria').value;
    if (!categoria) categoria = 'Geral';
    if (!nomeBase) return mostrarAviso('O nome é obrigatório.', 'erro');
    
    setCarregamento('btn-salvar-edicao-produto', true, 'Salvando...');
    try {
        const idsAntigos = JSON.parse(idsAntigosRaw);
        const { data: oldData } = await supabaseClient.from('catalogo').select('foto_url').eq('id', idsAntigos[0]).single();
        const oldFotoUrl = oldData ? oldData.foto_url : null;

        const { error: errDel } = await supabaseClient.from('catalogo').update({ ativo: false }).in('id', idsAntigos);
        if(errDel) throw errDel;
        
        const linhasGrade = document.querySelectorAll('#container-grade-edit > div');
        if (linhasGrade.length > 0) {
            for (let linha of linhasGrade) {
                const varName = linha.querySelector('.edit-tamanho').value.trim(); const qtd = parseInt(linha.querySelector('.edit-qtd-tamanho').value) || 0;
                if(varName) { 
                    const { error } = await supabaseClient.from('catalogo').insert([{ nome: `${nomeBase} (${varName})`, categoria: categoria, subcategoria: subCatBase ? `${subCatBase} | ${varName}` : `${varName}`, quantidade: qtd, foto_url: oldFotoUrl, ativo: true, secao: '' }]); 
                    if(error) throw error;
                }
            }
        } else {
            const { error } = await supabaseClient.from('catalogo').insert([{ nome: nomeBase, categoria: categoria, subcategoria: subCatBase, quantidade: qtdGlobal, foto_url: oldFotoUrl, ativo: true, secao: '' }]); 
            if(error) throw error;
        }

        mostrarAviso('Atualizado com sucesso!', 'sucesso'); document.getElementById('modal-editar-produto').style.display = 'none'; carregarVitrineAdmin(); carregarCatalogoPedido();
    } catch(e) { 
        console.error("ERRO EDIÇÃO:", e); 
        mostrarAviso('Erro ao editar. Verifique console.', 'erro'); 
    } finally { setCarregamento('btn-salvar-edicao-produto', false); }
}

async function excluirProdutoGrupo(idsArrStr, btn) {
    confirmarAcao("Excluir este lote de materiais permanentemente da vitrine?", async () => {
        const ids = JSON.parse(idsArrStr);
        const htmlOriginal = btn.innerHTML; btn.innerHTML = '<i data-lucide="loader" class="lucide-sm spinner"></i>'; btn.style.pointerEvents = 'none';
        try { 
            const { error } = await supabaseClient.from('catalogo').update({ ativo: false }).in('id', ids); 
            if(error) throw error;
            mostrarAviso('Lote Removido.', 'sucesso'); carregarVitrineAdmin(); carregarCatalogoPedido();
        } 
        catch(e) { console.error("ERRO EXCLUSAO:", e); mostrarAviso('Erro ao excluir.', 'erro'); btn.innerHTML = htmlOriginal; btn.style.pointerEvents = 'auto'; lucide.createIcons(); }
    });
}

// ==========================================
// 5. LOJAS E USUÁRIOS
// ==========================================
async function carregarLojasSelect() {
    const sel = document.getElementById('select-loja'); if(!sel) return;
    let q = supabaseClient.from('lojas').select('id, nome').order('nome');
    if (usuarioLogado.cargo === 'Supervisor') q = q.eq('supervisor_id', usuarioLogado.id);
    const { data } = await q; sel.innerHTML = '<option value="">Selecione a unidade...</option>'; data.forEach(l => sel.innerHTML += `<option value="${l.id}">${l.nome}</option>`);
}

async function carregarTabelaLojas() {
    const tbody = document.getElementById('tabela-lojas-admin'); if(!tbody) return;
    let q = supabaseClient.from('lojas').select('*, usuarios(nome)').order('nome');
    if (usuarioLogado.cargo === 'Supervisor') q = q.eq('supervisor_id', usuarioLogado.id); 
    const { data } = await q; tbody.innerHTML = '';
    data.forEach(loja => {
        const promotor = loja.promotor_nome ? ` | Prom: ${loja.promotor_nome}` : ''; const lojaStr = JSON.stringify(loja).replace(/"/g, '&quot;');
        let botoesAcao = `<button onclick="abrirModalEditarLoja('${lojaStr}')" style="background:transparent; border:none; color:var(--primary); cursor:pointer;" title="Editar Loja"><i data-lucide="edit" class="lucide-sm"></i></button>`;
        if (usuarioLogado.cargo === 'Diretor' || usuarioLogado.cargo === 'Logistica') botoesAcao += `<button onclick="excluirLoja(${loja.id}, this)" style="background:transparent; border:none; color:#ff4d4d; cursor:pointer; margin-left:10px;" title="Excluir Loja"><i data-lucide="trash-2" class="lucide-sm"></i></button>`;
        tbody.innerHTML += `<tr><td><strong>${loja.nome}</strong><br><span style="font-size:11px; color:var(--cor-secundaria)">Sup: ${loja.usuarios?.nome || 'Você'}${promotor}</span></td><td>${botoesAcao}</td></tr>`;
    }); lucide.createIcons();
}

async function excluirLoja(id, btn) {
    confirmarAcao("Tem certeza que deseja excluir esta loja permanentemente?", async () => {
        const htmlOriginal = btn.innerHTML; btn.innerHTML = '<i data-lucide="loader" class="lucide-sm spinner"></i>'; btn.style.pointerEvents = 'none';
        try { const { error } = await supabaseClient.from('lojas').delete().eq('id', id); if(error) throw error; mostrarAviso('Loja removida.', 'sucesso'); carregarTabelaLojas(); } 
        catch(e) { mostrarAviso('Erro: A loja possui histórico de pedidos.', 'erro'); btn.innerHTML = htmlOriginal; btn.style.pointerEvents = 'auto'; lucide.createIcons(); }
    });
}

async function carregarTabelaUsuarios() {
    const tbody = document.getElementById('tabela-usuarios-admin'); if(!tbody) return;
    const { data } = await supabaseClient.from('usuarios').select('*').order('nome'); tbody.innerHTML = ''; 
    data.forEach(u => {
        const userStr = JSON.stringify(u).replace(/"/g, '&quot;'); let botoesAcao = '';
        if (u.cargo === 'Diretor' && usuarioLogado.cargo !== 'Diretor') botoesAcao = '<span style="font-size:11px; color:var(--cor-secundaria); font-weight:bold;">Acesso Restrito</span>';
        else botoesAcao = `<button onclick="abrirModalEditarUsuario('${userStr}')" style="background:transparent; border:none; color:var(--primary); cursor:pointer;" title="Editar Usuário"><i data-lucide="edit" class="lucide-sm"></i></button><button onclick="excluirUsuario(${u.id}, this)" style="background:transparent; border:none; color:#ff4d4d; cursor:pointer; margin-left:10px;" title="Excluir Usuário"><i data-lucide="trash-2" class="lucide-sm"></i></button>`;
        tbody.innerHTML += `<tr><td><strong>${u.nome}</strong></td><td>${u.cargo}</td><td>${botoesAcao}</td></tr>`;
    }); lucide.createIcons();
}

async function excluirUsuario(id, btn) {
    if(id === usuarioLogado.id) return mostrarAviso('Você não pode excluir sua própria conta!', 'erro');
    confirmarAcao("Acesso será revogado! Deseja realmente excluir o usuário?", async () => {
        const htmlOriginal = btn.innerHTML; btn.innerHTML = '<i data-lucide="loader" class="lucide-sm spinner"></i>'; btn.style.pointerEvents = 'none';
        try { const { error } = await supabaseClient.from('usuarios').delete().eq('id', id); if(error) throw error; mostrarAviso('Usuário removido.', 'sucesso'); carregarTabelaUsuarios(); } 
        catch(e) { mostrarAviso('Erro: Usuário possui lojas vinculadas.', 'erro'); btn.innerHTML = htmlOriginal; btn.style.pointerEvents = 'auto'; lucide.createIcons(); }
    });
}

async function carregarSupervisoresModal() {
    const selects = ['loja-supervisor', 'edit-loja-supervisor']; 
    const { data } = await supabaseClient.from('usuarios').select('id, nome').eq('cargo', 'Supervisor').order('nome');
    selects.forEach(selId => { const el = document.getElementById(selId); if (el) { el.innerHTML = '<option value="">Selecione...</option>'; data.forEach(s => el.innerHTML += `<option value="${s.id}">${s.nome}</option>`); } });
}

async function carregarFiltroSupervisoresCustom() {
    const caixaOpts = document.getElementById('custom-options-sup'); if(!caixaOpts) return;
    const { data } = await supabaseClient.from('usuarios').select('id, nome').eq('cargo', 'Supervisor').order('nome');
    caixaOpts.innerHTML = `<div class="custom-option" onclick="selecionarFiltroSupervisorCustom('', 'Todos os Supervisores')">Todos os Supervisores</div>`;
    data.forEach(s => { caixaOpts.innerHTML += `<div class="custom-option" onclick="selecionarFiltroSupervisorCustom('${s.id}', '${s.nome}')">${s.nome}</div>`; });
}

function abrirModalNovaLoja() {
    if (usuarioLogado.cargo === 'Supervisor') { document.getElementById('container-supervisor-loja').style.display = 'none'; document.getElementById('loja-supervisor').value = usuarioLogado.id; } 
    else { document.getElementById('container-supervisor-loja').style.display = 'block'; }
    document.getElementById('modal-nova-loja').style.display = 'flex';
}

async function salvarLoja() {
    let supervisor_id = document.getElementById('loja-supervisor') ? document.getElementById('loja-supervisor').value : '';
    if (usuarioLogado.cargo === 'Supervisor') supervisor_id = usuarioLogado.id;
    const dados = { nome: document.getElementById('loja-nome').value.trim(), supervisor_id, promotor_nome: document.getElementById('loja-promotor').value.trim(), promotor_contato: document.getElementById('loja-contato').value.trim(), cep: document.getElementById('loja-cep').value.trim(), rua: document.getElementById('loja-rua').value.trim(), numero: '', bairro: document.getElementById('loja-bairro').value.trim(), cidade: document.getElementById('loja-cidade').value.trim(), estado: document.getElementById('loja-estado').value.trim() };
    if (!dados.nome || !dados.supervisor_id) return mostrarAviso('Loja e Supervisor obrigatórios!', 'erro');
    setCarregamento('btn-salvar-loja', true, 'Salvando...');
    try { const { error } = await supabaseClient.from('lojas').insert([dados]); if(error) throw error; mostrarAviso('Loja criada!', 'sucesso'); document.getElementById('modal-nova-loja').style.display = 'none'; carregarTabelaLojas(); carregarLojasSelect(); } 
    catch (e) { mostrarAviso('Erro ao criar loja.', 'erro'); } finally { setCarregamento('btn-salvar-loja', false); }
}

function abrirModalEditarLoja(lojaStr) {
    const loja = JSON.parse(lojaStr);
    document.getElementById('edit-id-loja').value = loja.id; document.getElementById('edit-loja-nome').value = loja.nome; document.getElementById('edit-loja-promotor').value = loja.promotor_nome || ''; document.getElementById('edit-loja-contato').value = loja.promotor_contato || ''; document.getElementById('edit-loja-cep').value = loja.cep || ''; document.getElementById('edit-loja-rua').value = loja.rua || ''; document.getElementById('edit-loja-bairro').value = loja.bairro || ''; document.getElementById('edit-loja-cidade').value = loja.cidade || ''; document.getElementById('edit-loja-estado').value = loja.estado || '';
    if (usuarioLogado.cargo === 'Diretor') { document.getElementById('container-edit-supervisor-loja').style.display = 'block'; document.getElementById('edit-loja-supervisor').value = loja.supervisor_id; } else { document.getElementById('container-edit-supervisor-loja').style.display = 'none'; }
    document.getElementById('modal-editar-loja').style.display = 'flex';
}

async function salvarEdicaoLoja() {
    const id = document.getElementById('edit-id-loja').value; let supervisor_id = document.getElementById('edit-loja-supervisor') ? document.getElementById('edit-loja-supervisor').value : ''; if (usuarioLogado.cargo === 'Supervisor') supervisor_id = usuarioLogado.id;
    const dados = { nome: document.getElementById('edit-loja-nome').value.trim(), supervisor_id, promotor_nome: document.getElementById('edit-loja-promotor').value.trim(), promotor_contato: document.getElementById('edit-loja-contato').value.trim(), cep: document.getElementById('edit-loja-cep').value.trim(), rua: document.getElementById('edit-loja-rua').value.trim(), numero: '', bairro: document.getElementById('edit-loja-bairro').value.trim(), cidade: document.getElementById('edit-loja-cidade').value.trim(), estado: document.getElementById('edit-loja-estado').value.trim() };
    setCarregamento('btn-salvar-edicao-loja', true, 'Salvando...');
    try { const { error } = await supabaseClient.from('lojas').update(dados).eq('id', id); if(error) throw error; mostrarAviso('Atualizada!', 'sucesso'); document.getElementById('modal-editar-loja').style.display = 'none'; carregarTabelaLojas(); } 
    catch(e) { mostrarAviso('Erro ao editar loja.', 'erro'); } finally { setCarregamento('btn-salvar-edicao-loja', false); }
}

function abrirModalEditarUsuario(userStr) {
    const user = JSON.parse(userStr); document.getElementById('edit-id-user').value = user.id; document.getElementById('edit-nome-user').value = user.nome; document.getElementById('edit-email-user').value = user.email; document.getElementById('edit-senha-user').value = user.senha; document.getElementById('edit-cargo-user').value = user.cargo; document.getElementById('modal-editar-usuario').style.display = 'flex';
}

async function salvarEdicaoUsuario() {
    const id = document.getElementById('edit-id-user').value; const nome = document.getElementById('edit-nome-user').value.trim(); const email = document.getElementById('edit-email-user').value.trim(); const senha = document.getElementById('edit-senha-user').value.trim(); const cargo = document.getElementById('edit-cargo-user').value;
    setCarregamento('btn-salvar-edicao-usuario', true, 'Salvando...');
    try { const { error } = await supabaseClient.from('usuarios').update({ nome, email, senha, cargo }).eq('id', id); if(error) throw error; mostrarAviso('Atualizado!', 'sucesso'); document.getElementById('modal-editar-usuario').style.display = 'none'; carregarTabelaUsuarios(); } 
    catch (e) { mostrarAviso('Erro ao editar usuário.', 'erro'); } finally { setCarregamento('btn-salvar-edicao-usuario', false); }
}

async function salvarUsuario() {
    const nome = document.getElementById('input-nome-user').value.trim(); const email = document.getElementById('input-email-user').value.trim(); const senha = document.getElementById('input-senha-user').value.trim(); const cargo = document.getElementById('select-cargo-user').value;
    setCarregamento('btn-salvar-usuario', true, 'Cadastrando...');
    try { const { error } = await supabaseClient.from('usuarios').insert([{ nome, email, senha, cargo }]); if(error) throw error; mostrarAviso('Criado!', 'sucesso'); document.getElementById('modal-novo-usuario').style.display = 'none'; carregarTabelaUsuarios(); } 
    catch (e) { mostrarAviso('Erro ao criar usuário.', 'erro'); } finally { setCarregamento('btn-salvar-usuario', false); }
}

// ==========================================
// 6. E-COMMERCE (NOVO PEDIDO AGRUPADO) E SEGREGAÇÃO DE ESTOQUE
// ==========================================
let memoriaCatalogoPedido = [];
let categoriaAtivaPedido = 'Todos';

async function carregarCatalogoPedido() {
    const vitrine = document.getElementById('vitrine-pedido'); if(!vitrine) return;
    vitrine.innerHTML = '<div style="color: var(--cor-secundaria); padding: 20px;"><i data-lucide="loader" class="spinner"></i> Carregando produtos...</div>'; lucide.createIcons();
    try {
        const { data, error } = await supabaseClient.from('catalogo').select('*').eq('ativo', true).order('categoria').order('nome');
        if (error) throw error;
        memoriaCatalogoPedido = data || []; memoriaCatalogoPedido.forEach(item => item.qtdSelecionada = 0);
        renderizarCategoriasPedido(); renderizarVitrinePedido();
    } catch (e) { vitrine.innerHTML = `<div style="color: #ff4d4d; padding: 20px;">Erro ao carregar catálogo: ${e.message || 'Desconhecido'}</div>`; }
}

function renderizarCategoriasPedido() {
    const nav = document.getElementById('nav-categorias-pedido'); if(!nav) return;
    const categorias = [...new Set(memoriaCatalogoPedido.map(i => i.categoria || 'Geral'))].sort();
    let html = `<button class="categoria-pill ${categoriaAtivaPedido === 'Todos' ? 'ativo' : ''}" onclick="filtrarVitrinePedido('Todos')">Todos os Itens</button>`;
    categorias.forEach(c => { html += `<button class="categoria-pill ${categoriaAtivaPedido === c ? 'ativo' : ''}" onclick="filtrarVitrinePedido('${c}')">${c}</button>`; });
    nav.innerHTML = html;
}

function filtrarVitrinePedido(cat) { categoriaAtivaPedido = cat; renderizarCategoriasPedido(); renderizarVitrinePedido(); }

function alterarQtdPedido(id, delta) {
    const item = memoriaCatalogoPedido.find(i => i.id == id); if(!item) return;
    item.qtdSelecionada += delta; if(item.qtdSelecionada < 0) item.qtdSelecionada = 0;
    
    const input = document.getElementById(`qtd-pedido-${item.id}`); 
    if(input) input.value = item.qtdSelecionada;
    
    let baseName = item.nome || 'Sem Nome';
    // Correção: Mesma regra nova de parênteses para o carrinho não se perder
    if (baseName.includes('(') && baseName.endsWith(')')) {
        const match = baseName.match(/^(.*) \((.*)\)$/);
        if (match) baseName = match[1].trim();
    }
    
    const idCardHtml = `card-pedido-${baseName}_${item.categoria || 'Geral'}`.replace(/[^a-zA-Z0-9]/g, '');
    const cardBase = document.getElementById(idCardHtml);
    
    if(cardBase) { 
        const temAlgum = memoriaCatalogoPedido.some(i => {
            let bn = i.nome || '';
            if (bn.includes('(') && bn.endsWith(')')) bn = bn.match(/^(.*) \((.*)\)$/)?.[1]?.trim() || bn;
            return bn === baseName && (i.categoria || 'Geral') === (item.categoria || 'Geral') && i.qtdSelecionada > 0;
        });
        if(temAlgum) cardBase.classList.add('selecionado'); else cardBase.classList.remove('selecionado'); 
    }
}

function renderizarVitrinePedido() {
    const vitrine = document.getElementById('vitrine-pedido');
    const catalogAgrupado = agruparCatalogo(memoriaCatalogoPedido);
    let filtrados = catalogAgrupado;
    
    if (categoriaAtivaPedido !== 'Todos') filtrados = catalogAgrupado.filter(i => (i.categoria || 'Geral') === categoriaAtivaPedido);
    vitrine.innerHTML = '';
    
    if (filtrados.length === 0) { vitrine.innerHTML = '<div style="color: var(--cor-secundaria); padding: 20px;">Nenhum material encontrado.</div>'; return; }

    filtrados.forEach(grupo => {
        const linkCorrigido = consertarLinkGoogleDrive(grupo.foto_url);
        const fotoHtml = linkCorrigido ? `<img src="${linkCorrigido}" loading="lazy" onerror="this.onerror=null; this.outerHTML='<div class=\\'produto-img-placeholder\\'><span>Sem Imagem</span></div>';">` : `<div class="produto-img-placeholder"><span>Sem Imagem</span></div>`;
        
        let variacoesHtml = '<div class="variacoes-lista">';
        let selecionadoGeral = false;

        grupo.variacoes.forEach(v => {
            if(v.qtdSelecionada > 0) selecionadoGeral = true;
            const classeFalta = v.quantidade <= 0 ? 'color: #ff4d4d;' : '';
            
            // Oculta a quantidade exata para o Supervisor
            let textoEstoque = '';
            if (usuarioLogado.cargo === 'Supervisor') {
                textoEstoque = v.quantidade > 0 ? 'Disponível' : 'Indisponível (Falta)';
            } else {
                textoEstoque = `${v.quantidade} disponíveis`;
            }
            
            variacoesHtml += `
                <div class="variacao-item">
                    <div style="display:flex; flex-direction:column; max-width: 65%;">
                        <span class="var-nome">${v.nome_var === 'Único' ? 'Unidade Padrão' : v.nome_var}</span>
                        <span class="var-estoque" style="${classeFalta}">${textoEstoque}</span>
                    </div>
                    <div class="qtd-selector" style="padding: 2px;">
                        <button type="button" class="qtd-btn" style="width:25px;height:25px;font-size:16px;" onclick="alterarQtdPedido('${v.id}', -1)">-</button>
                        <input type="number" class="qtd-input" id="qtd-pedido-${v.id}" value="${v.qtdSelecionada}" readonly style="width:30px;font-size:14px;">
                        <button type="button" class="qtd-btn" style="width:25px;height:25px;font-size:16px;" onclick="alterarQtdPedido('${v.id}', 1)">+</button>
                    </div>
                </div>
            `;
        });
        variacoesHtml += '</div>';

        const idCardHtml = `card-pedido-${grupo.nome_base}_${grupo.categoria}`.replace(/[^a-zA-Z0-9]/g, '');

        vitrine.innerHTML += `
            <div class="produto-card ${selecionadoGeral ? 'selecionado' : ''}" id="${idCardHtml}">
                <div class="produto-img-container">${fotoHtml}</div>
                <div class="produto-info">
                    <h4>${grupo.nome_base}</h4>
                    <p style="margin-bottom: 5px;">${grupo.categoria || 'Geral'} ${grupo.subcategoria ? '> ' + grupo.subcategoria : ''}</p>
                    ${variacoesHtml}
                </div>
            </div>`;
    }); lucide.createIcons();
}

async function salvarSolicitacao() {
    const lojaId = document.getElementById('select-loja').value;
    const itensSelecionados = memoriaCatalogoPedido.filter(i => i.qtdSelecionada > 0);
    
    if (!lojaId) return mostrarAviso('Selecione a Loja/Destino!', 'erro');
    if (itensSelecionados.length === 0) return mostrarAviso('Adicione pelo menos um material!', 'erro');
    if (arquivosBancada.length === 0) return mostrarAviso('Anexe as fotos da bancada!', 'erro');
    
    let itensPedido = []; let atualizacoesEstoque = []; let temFalta = false;
    
    itensSelecionados.forEach(item => {
        const qtdPedida = item.qtdSelecionada; const estoqueAtual = item.quantidade;
        let nomeFinalFormato = item.nome;
        const matchVar = item.nome.match(/^(.*) \((.*)\)$/);
        if (matchVar && matchVar[2] !== 'Único') {
            nomeFinalFormato = `${matchVar[1].trim()} - Var: ${matchVar[2].trim()}`;
        }
        itensPedido.push(`${qtdPedida}x ${nomeFinalFormato}`);
        if (estoqueAtual <= 0 || qtdPedida > estoqueAtual) temFalta = true;
        const novoEstoque = estoqueAtual - qtdPedida; 
        atualizacoesEstoque.push({ id: item.id, quantidade: novoEstoque < 0 ? 0 : novoEstoque, nome: nomeFinalFormato, baixado: qtdPedida });
    });

    let detalhes = itensPedido.join(', ');
    if (temFalta) detalhes = `[⚠️ CONTÉM ITEM SEM ESTOQUE] ` + detalhes;
    
    setCarregamento('btn-enviar-pedido', true, 'Processando Pedido...');

    try {
        let urlsBancada = [];
        
        try {
            for (let i = 0; i < arquivosBancada.length; i++) {
                const urlDrive = await fazerUploadDrive(arquivosBancada[i], `bancada_${i+1}`);
                urlsBancada.push(urlDrive);
            }
        } catch (errDrive) {
            console.error("Erro no envio para o Google Drive:", errDrive);
            mostrarAviso('Falha no upload das fotos. Enviando pedido sem imagens.', 'erro');
        }
        
        const { error: erroInsert } = await supabaseClient.from('pedidos').insert([{ loja_id: lojaId, detalhes, foto_url: urlsBancada.join(','), status: 'Pendente' }]);
        if (erroInsert) throw erroInsert;
        
        for (let item of atualizacoesEstoque) { 
            await supabaseClient.from('catalogo').update({ quantidade: item.quantidade }).eq('id', item.id);
            
            // Correção: Bloco de log isolado com try/catch separado para evitar quebra no Supabase v2
            try {
                await supabaseClient.from('logs_estoque').insert([{ 
                    material: item.nome, 
                    quantidade_movimentada: -item.baixado, 
                    responsavel: usuarioLogado.nome, 
                    motivo: 'Solicitação de Pedido' 
                }]);
            } catch (errLog) {
                console.warn("Log de estoque opcional não gravado:", errLog);
            }
        }

        mostrarAviso('Pedido Enviado com Sucesso!', 'sucesso'); 
        document.getElementById('select-loja').value = ''; 
        arquivosBancada = []; renderizarMiniaturasBancada(); 
        memoriaCatalogoPedido.forEach(item => item.qtdSelecionada = 0);
        mostrarTela('tela-pedidos');
    } catch (e) { 
        console.error("ERRO COMPLETO AO ENVIAR:", e);
        mostrarAviso('Erro no envio. Verifique a conexão.', 'erro'); 
    } finally { setCarregamento('btn-enviar-pedido', false); }
}

// ==========================================
// 7. DASHBOARD E WORKFLOW DE PEDIDOS (INFINITE SCROLL)
// ==========================================
function filtrarPorCard(status) {
    if (filtroCardAtivo === status) { filtroCardAtivo = null; document.getElementById('card-' + status).classList.remove('card-ativo'); }
    else {
        ['Pendente', 'Enviado', 'Entregue', 'Alerta'].forEach(id => { const c = document.getElementById('card-' + id); if(c) c.classList.remove('card-ativo'); });
        filtroCardAtivo = status; document.getElementById('card-' + status).classList.add('card-ativo');
    } carregarPedidos(true);
}

function mudarAbaPedidos(aba) {
    abaAtualPedidos = aba; filtroCardAtivo = null;
    ['Pendente', 'Enviado', 'Entregue', 'Alerta'].forEach(id => { const c = document.getElementById('card-' + id); if(c) c.classList.remove('card-ativo'); });
    document.getElementById('aba-ativos').classList.remove('ativo'); document.getElementById('aba-historico').classList.remove('ativo');
    document.getElementById(`aba-${aba}`).classList.add('ativo'); carregarPedidos(true);
}

async function carregarPedidos(reset = true) {
    if (reset) {
        paginaAtualPedidos = 0; todosPedidosCarregados = false; memoriaPedidos = [];
        document.getElementById('tabela-dados-corpo').innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--cor-secundaria); padding: 20px;">Carregando pedidos...</td></tr>';
        
        let qStats = supabaseClient.from('pedidos').select('status, detalhes, lojas!inner(supervisor_id)');
        if (usuarioLogado.cargo === 'Supervisor') qStats = qStats.eq('lojas.supervisor_id', usuarioLogado.id);
        else if (filtroSupIdSelecionado) qStats = qStats.eq('lojas.supervisor_id', filtroSupIdSelecionado);
        
        const { data: stats } = await qStats;
        if(stats) {
            let pendentes = 0, enviados = 0, entregues = 0, alertas = 0;
            stats.forEach(p => { if (p.status === 'Pendente') pendentes++; if (p.status === 'Enviado') enviados++; if (p.status === 'Entregue') entregues++; if (p.detalhes.includes('ESTOQUE')) alertas++; });
            document.getElementById('dash-pendentes').innerText = pendentes; document.getElementById('dash-enviados').innerText = enviados; document.getElementById('dash-entregues').innerText = entregues; document.getElementById('dash-alertas').innerText = alertas;
            const badgeMenu = document.getElementById('badge-menu-pedidos');
            if (badgeMenu) { if (pendentes > 0 && usuarioLogado.cargo !== 'Supervisor') { badgeMenu.innerText = pendentes; badgeMenu.style.display = 'inline-block'; } else { badgeMenu.style.display = 'none'; } }
        }
    }

    if (carregandoPedidos || todosPedidosCarregados) return;
    carregandoPedidos = true;
    const tbody = document.getElementById('tabela-dados-corpo');

    if (!reset) {
        const trLoading = document.createElement('tr'); trLoading.id = 'linha-carregando-mais';
        trLoading.innerHTML = '<td colspan="4" style="text-align:center; color:var(--primary); padding: 15px;"><i data-lucide="loader" class="lucide-sm spinner"></i> Buscando...</td>';
        tbody.appendChild(trLoading); lucide.createIcons();
    }

    let q = supabaseClient.from('pedidos').select('*, lojas!inner(nome, supervisor_id, promotor_nome, promotor_contato, cep, rua, bairro, cidade, estado, usuarios(nome))');
    if (usuarioLogado.cargo === 'Supervisor') q = q.eq('lojas.supervisor_id', usuarioLogado.id);
    else if (filtroSupIdSelecionado) q = q.eq('lojas.supervisor_id', filtroSupIdSelecionado);

    if (filtroCardAtivo) { if (filtroCardAtivo === 'Alerta') q = q.like('detalhes', '%ESTOQUE%'); else q = q.eq('status', filtroCardAtivo); } 
    else { if (abaAtualPedidos === 'ativos') q = q.in('status', ['Pendente', 'Enviado']); else q = q.in('status', ['Entregue', 'Reprovado']); }

    q = q.order('created_at', { ascending: false }).range(paginaAtualPedidos * itensPorPagina, (paginaAtualPedidos + 1) * itensPorPagina - 1);
    const { data } = await q;

    if (reset) tbody.innerHTML = '';
    else { const loadingRow = document.getElementById('linha-carregando-mais'); if(loadingRow) loadingRow.remove(); }

    if (!data || data.length === 0) {
        todosPedidosCarregados = true;
        if (reset) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--cor-secundaria); padding: 20px;">Nenhum pedido encontrado.</td></tr>';
        else tbody.innerHTML += '<tr><td colspan="4" style="text-align:center; color:var(--cor-secundaria); padding: 15px; font-size: 12px;">Fim da lista.</td></tr>';
        carregandoPedidos = false; return;
    }

    if (data.length < itensPorPagina) todosPedidosCarregados = true;
    memoriaPedidos = [...memoriaPedidos, ...data];
    
    data.forEach(p => {
        const lojaNome = p.lojas ? p.lojas.nome : 'Excluída'; const supNome = p.lojas && p.lojas.usuarios ? p.lojas.usuarios.nome : 'Sem Sup';
        const promotorHtml = p.lojas && p.lojas.promotor_nome ? `<div style="display:flex; align-items:center; gap: 4px; margin-top: 4px; font-size: 11px; color: var(--cor-secundaria);"><i data-lucide="briefcase" style="width:12px; height:12px;"></i> Promotor: ${p.lojas.promotor_nome}</div>` : '';
        const nomeEDono = `<strong style="font-size: 15px; color: #fff;">${lojaNome}</strong><div style="display:flex; align-items:center; gap: 4px; margin-top: 8px; font-size: 11px; color: var(--primary); background: rgba(0, 229, 176, 0.1); padding: 4px 8px; border-radius: 6px; width: fit-content; border: 1px solid rgba(0, 229, 176, 0.2);"><i data-lucide="user-check" style="width:12px; height:12px;"></i> Sup: ${supNome}</div>${promotorHtml}`;

        const dataF = new Date(p.created_at).toLocaleDateString('pt-BR');
        let infoExtra = p.codigo_rastreio ? `<br><span style="font-size:11px; color:#3b82f6;"><i data-lucide="truck" class="lucide-sm"></i> ${p.codigo_rastreio}</span>` : '';
        
        let avisoFalta = '';
        if (p.detalhes.includes('[ATENDIMENTO PARCIAL]')) {
            avisoFalta = `<span class="tag-parcial" style="margin-top: 5px;">Expedição Parcial</span>`;
        } else if (p.detalhes.includes('ESTOQUE')) {
            avisoFalta = `<span class="tag-alerta" style="margin-top: 5px;">Atenção: Ruptura na Origem</span>`;
        }

        let btnLista = `<button class="btn-ver-lista" onclick="abrirModalVerPedido(${p.id})"><i data-lucide="file-text" class="lucide-sm"></i> Ver Lista</button> <br>${avisoFalta}`;

        let acaoHtml = `<span style="font-weight:bold; color:#f59e0b;">${p.status}</span>`; 
        if (p.status === 'Pendente' && (usuarioLogado.cargo === 'Logistica' || usuarioLogado.cargo === 'Diretor')) { acaoHtml = `<div style="display:flex; flex-direction:column; gap:5px;"><button onclick="abrirModalDespacho(${p.id})" style="background:#3b82f6; color:#fff; padding:6px 12px; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Despachar</button><button onclick="abrirModalReprovar(${p.id})" style="background:transparent; color:#ff4d4d; border: 1px solid #ff4d4d; padding:4px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Reprovar</button></div>`; } 
        else if (p.status === 'Enviado') { acaoHtml = `<span style="font-weight:bold; color:#3b82f6;">Enviado</span>`; if (usuarioLogado.cargo === 'Supervisor') acaoHtml = `<button onclick="abrirModalRecebimento(${p.id})" style="background:#10b981; color:#fff; padding:6px 12px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; width:100%;">Recebido <i data-lucide="camera" class="lucide-sm"></i></button>`; } 
        else if (p.status === 'Entregue') acaoHtml = `<span style="font-weight:bold; color:#10b981;"><i data-lucide="check-circle" class="lucide-sm"></i> Entregue</span>`;
        else if (p.status === 'Reprovado') acaoHtml = `<span style="font-weight:bold; color:#ff4d4d;"><i data-lucide="x-circle" class="lucide-sm"></i> Reprovado</span>`;

        tbody.innerHTML += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);"><td style="padding: 15px; vertical-align: top;">${nomeEDono}</td><td style="padding: 15px; vertical-align: top;">${dataF}${infoExtra}</td><td style="padding: 15px; vertical-align: top;">${btnLista}</td><td style="padding: 15px; vertical-align: top;">${acaoHtml}</td></tr>`;
    }); 
    lucide.createIcons(); paginaAtualPedidos++; carregandoPedidos = false;
}

function abrirModalVerPedido(id) {
    const p = memoriaPedidos.find(x => x.id === id); if (!p) return;
    let listaItensRaw = p.detalhes.replace('[⚠️ CONTÉM ITEM SEM ESTOQUE]', '').replace('[ATENDIMENTO PARCIAL]', '').trim();
    if(listaItensRaw.startsWith(',')) listaItensRaw = listaItensRaw.substring(1).trim();
    
    let listaHtml = `<ul style="list-style: none; padding: 0; margin-bottom: 15px;">`;
    listaItensRaw.split(',').forEach(item => { listaHtml += `<li style="background: rgba(255,255,255,0.05); padding: 8px 12px; margin-bottom: 5px; border-radius: 6px; border-left: 3px solid var(--primary);"><strong style="color:#fff;">${item}</strong></li>`; }); 
    listaHtml += `</ul>`;
    
    const end = p.lojas; 
    let endHtml = end ? `${end.rua || 'S/N'}, ${end.bairro || ''} - ${end.cidade || ''}/${end.estado || ''} - CEP: ${end.cep || ''}` : 'Endereço não cadastrado';
    let prom = end ? `${end.promotor_nome || 'Não info.'} (${end.promotor_contato || 'S/N'})` : '';
    
    let galeriaHtml = '';
    if (p.foto_url) {
        galeriaHtml += `<p style="margin: 15px 0 5px 0; color: var(--primary); font-size: 12px; font-weight: bold;">FOTOS DA BANCADA</p><div class="galeria-fotos">`;
        p.foto_url.split(',').forEach(url => { galeriaHtml += `<a href="${url.trim()}" target="_blank"><img src="${consertarLinkGoogleDrive(url.trim())}" loading="lazy"></a>`; });
        galeriaHtml += `</div>`;
    }
    if (p.foto_recebimento_url) {
        galeriaHtml += `<p style="margin: 15px 0 5px 0; color: #10b981; font-size: 12px; font-weight: bold;">FOTO DA ENTREGA</p><div class="galeria-fotos">`;
        p.foto_recebimento_url.split(',').forEach(url => { galeriaHtml += `<a href="${url.trim()}" target="_blank"><img src="${consertarLinkGoogleDrive(url.trim())}" loading="lazy" style="border-color: #10b981;"></a>`; });
        galeriaHtml += `</div>`;
    }
    
    document.getElementById('picking-list-conteudo').innerHTML = `<div style="margin-bottom: 15px;"><p style="margin: 0; color: var(--primary); font-size: 12px; font-weight: bold;">DESTINO</p><h4 style="color: #fff; margin: 5px 0;">${end ? end.nome : 'Excluída'}</h4><p style="margin: 0; font-size: 13px;">${endHtml}</p><p style="margin: 5px 0 0 0; font-size: 13px; color: var(--cor-secundaria);">Promotor: ${prom}</p></div><div style="margin-bottom: 15px;"><p style="margin: 0 0 10px 0; color: var(--primary); font-size: 12px; font-weight: bold;">LISTA DE SEPARAÇÃO</p>${listaHtml}</div>${galeriaHtml}`;
    document.getElementById('modal-ver-pedido').style.display = 'flex'; lucide.createIcons();
}

function abrirModalDespacho(id) {
    document.getElementById('id-pedido-despacho').value = id;
    document.getElementById('input-rastreio').value = '';
    
    const pedido = memoriaPedidos.find(p => p.id === id);
    if (!pedido) return;

    let itensRaw = pedido.detalhes
        .replace('[⚠️ CONTÉM ITEM SEM ESTOQUE]', '')
        .replace('[ATENDIMENTO PARCIAL]', '')
        .trim();
    
    if(itensRaw.startsWith(',')) itensRaw = itensRaw.substring(1).trim();

    const listaContainer = document.getElementById('lista-conferencia');
    listaContainer.innerHTML = '';

    itensRaw.split(',').forEach((itemStr, index) => {
        itemStr = itemStr.trim();
        if (!itemStr) return;

        // O padrão salvo é "Qtdx Nome do Item" (ex: "3x Camisa Polo")
        const match = itemStr.match(/^(\d+)x\s+(.+)$/);
        if (match) {
            const qtdPedida = parseInt(match[1]);
            const nomeItem = match[2];

            listaContainer.innerHTML += `
                <div class="linha-conferencia">
                    <span style="flex: 2;"><strong>${nomeItem}</strong><br><small style="color: var(--cor-secundaria);">Pedido: ${qtdPedida} un.</small></span>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 11px; color: var(--cor-secundaria); flex: none;">Enviando:</span>
                        <input type="number" class="input-conferencia" id="conf-qtd-${index}" value="${qtdPedida}" min="0" max="${qtdPedida}" data-nome="${nomeItem}" data-original="${qtdPedida}">
                    </div>
                </div>
            `;
        } else {
            listaContainer.innerHTML += `
                <div class="linha-conferencia">
                    <span style="flex: 2;"><strong>${itemStr}</strong></span>
                </div>
            `;
        }
    });

    document.getElementById('modal-despacho').style.display = 'flex';
    lucide.createIcons();
}

async function confirmarDespacho() {
    const id = document.getElementById('id-pedido-despacho').value;
    const rastreio = document.getElementById('input-rastreio').value.trim();
    const pedidoOriginal = memoriaPedidos.find(p => p.id == id);
    
    if (!pedidoOriginal) return;

    setCarregamento('btn-confirma-despacho', true, 'Aferindo Estoque...');

    try {
        let houveRuptura = false;
        let novoDetalhes = [];
        
        const inputs = document.querySelectorAll('.input-conferencia');
        
        for (let input of inputs) {
            const nomeItem = input.getAttribute('data-nome');
            const qtdOriginal = parseInt(input.getAttribute('data-original'));
            const qtdEnviada = parseInt(input.value) || 0;

            if (qtdEnviada < qtdOriginal) {
                houveRuptura = true;
                const diferenca = qtdOriginal - qtdEnviada;
                
                const { data: catData } = await supabaseClient
                    .from('catalogo')
                    .select('id, quantidade')
                    .eq('nome', nomeItem)
                    .single();

                if (catData) {
                    const novoEstoque = catData.quantidade + diferenca;
                    await supabaseClient.from('catalogo').update({ quantidade: novoEstoque }).eq('id', catData.id);

                    await supabaseClient.from('logs_estoque').insert([{
                        material: nomeItem,
                        quantidade_movimentada: diferenca,
                        responsavel: usuarioLogado.nome,
                        motivo: 'Estorno: Ruptura no Despacho'
                    }]).catch(e => {}); 
                }
                
                if (qtdEnviada === 0) {
                    novoDetalhes.push(`0x ${nomeItem} (Ruptura Total)`);
                } else {
                    novoDetalhes.push(`${qtdEnviada}x ${nomeItem} (Pediu ${qtdOriginal})`);
                }
            } else {
                novoDetalhes.push(`${qtdOriginal}x ${nomeItem}`);
            }
        }

        let stringFinal = novoDetalhes.join(', ');
        if (houveRuptura) {
            stringFinal = '[ATENDIMENTO PARCIAL] ' + stringFinal;
        } else if (pedidoOriginal.detalhes.includes('[⚠️ CONTÉM ITEM SEM ESTOQUE]')) {
            stringFinal = '[⚠️ CONTÉM ITEM SEM ESTOQUE] ' + stringFinal;
        }

        await supabaseClient.from('pedidos')
            .update({ 
                status: 'Enviado', 
                codigo_rastreio: rastreio,
                detalhes: stringFinal
            })
            .eq('id', id);

        mostrarAviso('Conferência e Despacho realizados!', 'sucesso');
        document.getElementById('modal-despacho').style.display = 'none';
        
        carregarPedidos(true); 
        carregarCatalogoPedido(); 
        carregarVitrineAdmin(); 

    } catch (e) {
        mostrarAviso('Erro ao registrar conferência.', 'erro');
        console.error(e);
    } finally {
        setCarregamento('btn-confirma-despacho', false);
    }
}

function abrirModalRecebimento(id) { document.getElementById('id-pedido-recebimento').value = id; document.getElementById('input-foto-recebimento').value = ''; document.getElementById('nome-arquivo-recebimento').innerText = 'Tirar foto dos produtos'; document.getElementById('modal-recebimento').style.display = 'flex'; }
async function salvarRecebimento() {
    const id = document.getElementById('id-pedido-recebimento').value; const f = document.getElementById('input-foto-recebimento');
    if (f.files.length === 0) return mostrarAviso('A foto é obrigatória!', 'erro');
    setCarregamento('btn-confirma-recebimento', true, 'Confirmando...');
    try { const url = await fazerUploadDrive(f.files[0], 'entrega'); await supabaseClient.from('pedidos').update({ status: 'Entregue', foto_recebimento_url: url }).eq('id', id); mostrarAviso('Confirmada!', 'sucesso'); document.getElementById('modal-recebimento').style.display = 'none'; carregarPedidos(true); } 
    catch (e) { mostrarAviso('Erro no recebimento.', 'erro'); } finally { setCarregamento('btn-confirma-recebimento', false); }
}

function abrirModalReprovar(id) { document.getElementById('id-pedido-reprovar').value = id; document.getElementById('modal-reprovar').style.display = 'flex'; }
async function confirmarReprovacao() {
    const id = document.getElementById('id-pedido-reprovar').value;
    setCarregamento('btn-confirma-reprovacao', true, 'Reprovando...');
    try { await supabaseClient.from('pedidos').update({ status: 'Reprovado' }).eq('id', id); mostrarAviso('Reprovado.', 'sucesso'); document.getElementById('modal-reprovar').style.display = 'none'; carregarPedidos(true); } 
    catch (e) { mostrarAviso('Erro ao reprovar.', 'erro'); } finally { setCarregamento('btn-confirma-reprovacao', false); }
}

// ==========================================
// 8. RELATÓRIOS E EXPORTAÇÃO EXCEL
// ==========================================
function exportarExcel() {
    const dadosFiltrados = memoriaPedidos; 
    if (dadosFiltrados.length === 0) return mostrarAviso('Nenhum pedido na tela para exportar.', 'erro');
    
    mostrarAviso('Montando relatório...', 'sucesso');
    
    const dadosExcel = dadosFiltrados.map(p => {
        const loja = p.lojas ? p.lojas.nome : 'Loja Excluída';
        const supervisor = p.lojas && p.lojas.usuarios ? p.lojas.usuarios.nome : 'Sem Supervisor';
        const promotor = p.lojas ? p.lojas.promotor_nome : '';
        const dataPedido = new Date(p.created_at).toLocaleDateString('pt-BR');
        
        return {
            "ID do Pedido": p.id,
            "Data da Solicitação": dataPedido,
            "Status": p.status,
            "Destino (Loja)": loja,
            "Supervisor Responsável": supervisor,
            "Promotor na Loja": promotor,
            "Itens Solicitados": p.detalhes.replace('[⚠️ CONTÉM ITEM SEM ESTOQUE]', '(CONTÉM RUPTURA DE ESTOQUE)'),
            "Rastreio de Envio": p.codigo_rastreio || 'N/A'
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(dadosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos Logística");
    
    const larguraColunas = [{wch: 15}, {wch: 20}, {wch: 15}, {wch: 35}, {wch: 25}, {wch: 25}, {wch: 80}, {wch: 25}];
    worksheet['!cols'] = larguraColunas;

    const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    XLSX.writeFile(workbook, `Relatorio_Logistica_OPPO_${dataHoje}.xlsx`);
}