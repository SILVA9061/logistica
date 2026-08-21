// ==========================================
// 1. CONFIGURAÇÃO SUPABASE E GOOGLE DRIVE
// ==========================================
const supabaseUrl = 'https://qrmywcvsvkrqtapgkmnj.supabase.co';
const supabaseKey = 'sb_publishable_HvS_fAvGc9ToE-CXLkDDzw_EstUEqoN';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const URL_GOOGLE_SCRIPT = 'https://script.google.com/macros/s/AKfycbyTYb1WBCcYWBGtpDG8Xyktc6UuFvltMYKd1W5E0OeVzg1iJFvmKoxw6Fr2QCbUmJwNbw/exec';

let usuarioLogado = null;
let abaAtualPedidos = 'ativos';
let filtroSupIdSelecionado = '';
let filtroCardAtivo = null;

let memoriaPedidos = [];
let paginaAtualPedidos = 0;
const itensPorPagina = 20;
let carregandoPedidos = false;
let todosPedidosCarregados = false;

let chartLojas = null;
let chartStatus = null;
let chartMateriais = null;

document.getElementById('tela-pedidos').addEventListener('scroll', function() {
    if (this.scrollHeight - this.scrollTop - this.clientHeight < 100) { carregarPedidos(false); }
});

// ==========================================
// 2. FUNÇÕES AUXILIARES E MENUS SUSPENSOS
// ==========================================

document.addEventListener('click', function(e) { 
    const trigger = e.target.closest('.custom-select-trigger');
    if (trigger) {
        const wrapper = trigger.closest('.custom-select-wrapper');
        const options = wrapper.querySelector('.custom-options');
        document.querySelectorAll('.custom-options').forEach(opt => { if (opt !== options) opt.classList.remove('show'); });
        if (options) options.classList.toggle('show');
        return; 
    }
    if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.custom-options').forEach(opt => opt.classList.remove('show'));
    }
});

function toggleMenuMobile() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('menu-overlay');
    if (sidebar.classList.contains('aberto')) { sidebar.classList.remove('aberto'); overlay.style.display = 'none'; } 
    else { sidebar.classList.add('aberto'); overlay.style.display = 'block'; }
}

function mostrarAviso(mensagem, tipo = 'erro') {
    const container = document.getElementById('toast-container'); if (!container) return;
    const toast = document.createElement('div');
    toast.style.cssText = `background: ${tipo === 'sucesso' ? '#00e5b0' : '#ff4d4d'}; color: ${tipo === 'sucesso' ? '#002b22' : '#ffffff'}; padding: 15px 20px; border-radius: 8px; font-weight: bold; display: flex; align-items: center; gap: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); opacity: 0; transform: translateY(20px); transition: all 0.3s; z-index: 99999; cursor: pointer;`;
    const icone = tipo === 'sucesso' ? '<i data-lucide="check-circle"></i>' : '<i data-lucide="alert-circle"></i>';
    toast.innerHTML = `${icone} <span style="flex: 1;">${mensagem}</span><div class="toast-progress"></div>`;
    toast.onclick = () => { toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; setTimeout(() => toast.remove(), 300); };
    container.appendChild(toast); if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 10);
    setTimeout(() => { if(toast.parentElement) { toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; setTimeout(() => toast.remove(), 300); } }, 4000);
}

function toggleSenha(inputId, iconeId) {
    const input = document.getElementById(inputId);
    const icone = document.getElementById(iconeId);
    if (input.type === 'password') { input.type = 'text'; icone.setAttribute('data-lucide', 'eye-off'); } 
    else { input.type = 'password'; icone.setAttribute('data-lucide', 'eye'); }
    lucide.createIcons();
}

let callbackConfirmacaoAtual = null;
function confirmarAcao(mensagem, callback) { document.getElementById('texto-confirmacao').innerText = mensagem; callbackConfirmacaoAtual = callback; document.getElementById('modal-confirmacao').style.display = 'flex'; lucide.createIcons(); }
function fecharConfirmacao() { document.getElementById('modal-confirmacao').style.display = 'none'; callbackConfirmacaoAtual = null; }
document.getElementById('btn-confirmar-sim').addEventListener('click', () => { if (callbackConfirmacaoAtual) callbackConfirmacaoAtual(); fecharConfirmacao(); });

function setCarregamento(btnId, isCarregando, textoCarregando = 'Aguarde...') {
    const btn = document.getElementById(btnId); if (!btn) return;
    if (isCarregando) {
        if (!btn.dataset.textoOriginal) btn.dataset.textoOriginal = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="loader" class="lucide-sm spinner"></i> ${textoCarregando}`;
        btn.style.pointerEvents = 'none'; btn.style.opacity = '0.7';
    } else {
        btn.innerHTML = btn.dataset.textoOriginal || 'Confirmar'; btn.style.pointerEvents = 'auto'; btn.style.opacity = '1';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// LIGHTBOX E FOTOS
// ==========================================
function abrirLightbox(urlOriginal) {
    const overlay = document.getElementById('lightbox-overlay');
    const img = document.getElementById('lightbox-img');
    const btnDownload = document.getElementById('btn-download-lightbox');
    
    let linkDownload = urlOriginal; let id = '';
    if (urlOriginal.includes('/d/')) id = urlOriginal.split('/d/')[1].split('/')[0];
    else if (urlOriginal.includes('id=')) id = urlOriginal.split('id=')[1].split('&')[0];
    
    if (id) { linkDownload = `https://drive.google.com/uc?export=download&id=${id}`; img.src = `https://drive.google.com/thumbnail?id=${id}&sz=w1920`; } 
    else { img.src = urlOriginal; }
    
    btnDownload.href = linkDownload; overlay.style.display = 'flex'; lucide.createIcons();
}

function fecharLightbox(forcar = false, evento = null) {
    if (forcar || (evento && evento.target.id === 'lightbox-overlay')) {
        document.getElementById('lightbox-overlay').style.display = 'none'; document.getElementById('lightbox-img').src = '';
    }
}

let arquivosBancada = [];
function lidarComSelecaoDeFotos(input) { if (input.files) { Array.from(input.files).forEach(file => { if(file.type.startsWith('image/')) arquivosBancada.push(file); }); } input.value = ''; renderizarMiniaturasBancada(); }
function removerFotoBancada(index) { arquivosBancada.splice(index, 1); renderizarMiniaturasBancada(); }

function renderizarMiniaturasBancada() {
    const container = document.getElementById('preview-fotos-bancada'); const span = document.getElementById('nome-arquivo-pedido'); container.innerHTML = '';
    if (arquivosBancada.length === 1) span.innerText = `1 arquivo selecionado`; else if (arquivosBancada.length > 1) span.innerText = `${arquivosBancada.length} arquivos selecionados`; else span.innerText = "Clique ou arraste as fotos da bancada";
    arquivosBancada.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div'); div.className = 'preview-img-wrapper';
            div.innerHTML = `<img src="${e.target.result}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 2px solid rgba(0, 229, 176, 0.4);"><button type="button" class="btn-remover-foto" onclick="removerFotoBancada(${index})" title="Remover"><i data-lucide="x" style="width:14px;height:14px;"></i></button>`;
            container.appendChild(div); lucide.createIcons();
        }; reader.readAsDataURL(file);
    });
}

function atualizarNomeArquivo(input, idTexto) {
    const span = document.getElementById(idTexto);
    if (input.files.length === 1) span.innerText = "Arquivo: " + input.files[0].name; else if (input.files.length > 1) span.innerText = `${input.files.length} arquivos selecionados`; else span.innerText = "Clique para anexar foto";
}

async function fazerUploadDrive(file, prefixo) {
    const fotoComprimida = await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 1920, useWebWorker: true, initialQuality: 0.8 });
    const base64 = await new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(fotoComprimida); });
    const resposta = await fetch(URL_GOOGLE_SCRIPT, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ base64: base64, nomeArquivo: `${prefixo}_${Date.now()}.jpg`, mimeType: fotoComprimida.type }) });
    const dados = await resposta.json();
    if (!dados.sucesso) throw new Error("Falha no Google Drive.");
    return dados.url;
}

// ==========================================
// COMPONENTES CUSTOMIZADOS (FILTROS)
// ==========================================

function selecionarFiltroSupervisorCustom(id, nome) { 
    document.getElementById('filtro-sup-texto').innerHTML = `<i data-lucide="filter" class="lucide-sm" style="display:inline-block; vertical-align:middle; margin-right:5px; margin-top:-2px;"></i> <span class="texto-capitalizado">${nome}</span>`; 
    filtroSupIdSelecionado = id; 
    document.getElementById('custom-options-sup').classList.remove('show'); 
    carregarFiltroSupervisoresCustom(); carregarPedidos(true); 
}

async function carregarFiltroSupervisoresCustom() {
    const caixaOpts = document.getElementById('custom-options-sup'); if(!caixaOpts) return; 
    const { data } = await supabaseClient.from('usuarios').select('id, nome').eq('cargo', 'Supervisor').order('nome');
    
    let html = `<div class="custom-option ${filtroSupIdSelecionado === '' ? 'selecionado' : ''}" onclick="selecionarFiltroSupervisorCustom('', 'Todos os Supervisores')">
                    <i data-lucide="users" style="width:16px; height:16px;"></i> Todos os Supervisores 
                    ${filtroSupIdSelecionado === '' ? '<i data-lucide="check" style="margin-left:auto; width:16px; height:16px; color:var(--primary);"></i>' : ''}
                </div>`; 
                
    if (data) {
        data.forEach(s => { 
            const isSelected = String(filtroSupIdSelecionado) === String(s.id);
            html += `<div class="custom-option ${isSelected ? 'selecionado' : ''}" onclick="selecionarFiltroSupervisorCustom('${s.id}', '${s.nome}')">
                        <i data-lucide="user" style="width:14px; height:14px; opacity: 0.7;"></i> 
                        <span class="texto-capitalizado">${s.nome}</span> 
                        ${isSelected ? '<i data-lucide="check" style="margin-left:auto; width:16px; height:16px; color:var(--primary);"></i>' : ''}
                    </div>`; 
        });
    }
    caixaOpts.innerHTML = html; lucide.createIcons();
}

let ordemCatalogoAdmin = 'AZ';
function selecionarOrdemCustom(valor, texto, elemento) {
    document.getElementById('filtro-ordem-texto').innerHTML = `<i data-lucide="arrow-down-az" class="lucide-sm" style="display:inline-block; vertical-align:middle; margin-right:5px; margin-top:-2px;"></i> ${texto}`;
    const opcoes = document.querySelectorAll('#custom-options-ordem .custom-option');
    opcoes.forEach(opt => opt.classList.remove('selecionado'));
    if(elemento) elemento.classList.add('selecionado');
    document.getElementById('custom-options-ordem').classList.remove('show');
    
    ordemCatalogoAdmin = valor; renderizarVitrine(); lucide.createIcons();
}

async function carregarLojasSelect() {
    const caixaOpts = document.getElementById('custom-options-loja'); 
    if(!caixaOpts) return; 
    
    caixaOpts.innerHTML = '<div class="custom-option" style="justify-content:center;"><i data-lucide="loader" class="spinner lucide-sm"></i></div>';
    lucide.createIcons();

    let q = supabaseClient.from('lojas').select('id, nome').order('nome'); 
    if (usuarioLogado.cargo === 'Supervisor') q = q.eq('supervisor_id', usuarioLogado.id);
    const { data } = await q; 
    
    let html = `<div class="custom-option" onclick="selecionarLojaCustom('', 'Selecione a unidade...')">Selecione a unidade...</div>`; 
    if(data) {
        data.forEach(l => { 
            html += `<div class="custom-option" onclick="selecionarLojaCustom('${l.id}', '${l.nome}')">
                        <i data-lucide="store" style="width:14px; height:14px; opacity: 0.7;"></i> 
                        <span class="texto-capitalizado">${l.nome}</span>
                     </div>`; 
        });
    }
    caixaOpts.innerHTML = html; lucide.createIcons();
}

function selecionarLojaCustom(id, nome) {
    document.getElementById('select-loja').value = id;
    const spanTexto = document.getElementById('loja-selecionada-texto');
    
    if(id === '') {
        spanTexto.innerHTML = `Selecione a unidade...`;
        spanTexto.style.color = 'var(--cor-secundaria)';
    } else {
        spanTexto.innerHTML = `<i data-lucide="store" class="lucide-sm" style="display:inline-block; vertical-align:middle; margin-right:5px; color:var(--primary);"></i> <strong style="color:#fff;" class="texto-capitalizado">${nome}</strong>`;
        spanTexto.style.color = '#fff';
    }
    
    document.getElementById('custom-options-loja').classList.remove('show');
    lucide.createIcons();
}

function selecionarMotivoCustom(valor, elemento) {
    document.getElementById('motivo-reversa').value = valor;
    document.getElementById('motivo-selecionado-texto').innerText = valor;
    
    const opcoes = document.querySelectorAll('#custom-options-motivo .custom-option');
    opcoes.forEach(opt => opt.classList.remove('selecionado'));
    if(elemento) elemento.classList.add('selecionado');
    
    document.getElementById('custom-options-motivo').classList.remove('show');
}


// ==========================================
// 3. NAVEGAÇÃO E LOGIN 
// ==========================================
function alternarTelaLogin(isCadastro) { document.getElementById('form-login').style.display = isCadastro ? 'none' : 'block'; document.getElementById('form-cadastro').style.display = isCadastro ? 'block' : 'none'; }
window.onload = () => { const sessao = localStorage.getItem('usuarioLogado'); if (sessao) { usuarioLogado = JSON.parse(sessao); iniciarAplicativo(); } };

async function fazerLogin() {
    const email = document.getElementById('login-email').value.trim(); const senha = document.getElementById('login-senha').value.trim();
    const erroCard = document.getElementById('login-erro-card'); erroCard.style.display = 'none';

    if (!email || !senha) return mostrarAviso('Preencha e-mail e senha!', 'erro');
    setCarregamento('btn-login', true, 'Autenticando...');
    try {
        const { data, error } = await supabaseClient.from('usuarios').select('*').eq('email', email).eq('senha', senha).single();
        if (error || !data) throw new Error();
        usuarioLogado = data; localStorage.setItem('usuarioLogado', JSON.stringify(data));
        mostrarAviso(`Bem-vindo, ${data.nome}!`, 'sucesso'); iniciarAplicativo();
    } catch (erro) { 
        erroCard.style.display = 'flex'; mostrarAviso('Credenciais inválidas.', 'erro'); 
    } finally { setCarregamento('btn-login', false); }
}

async function fazerCadastro() {
    const nome = document.getElementById('cad-nome').value.trim(); const email = document.getElementById('cad-email').value.trim(); const senha = document.getElementById('cad-senha').value.trim();
    if (!nome || !email || !senha) return mostrarAviso('Preencha todos os campos!', 'erro');
    setCarregamento('btn-cadastrar', true, 'Criando...');
    try {
        const { data, error } = await supabaseClient.from('usuarios').insert([{ nome, email, senha, cargo: 'Supervisor' }]).select().single();
        if (error) throw error; usuarioLogado = data; localStorage.setItem('usuarioLogado', JSON.stringify(data)); iniciarAplicativo();
    } catch (erro) { mostrarAviso('Erro ao criar conta ou e-mail já existe.', 'erro'); } finally { setCarregamento('btn-cadastrar', false); }
}

function iniciarAplicativo() {
    document.getElementById('tela-login').style.display = 'none'; document.getElementById('tela-app').style.display = 'flex';
    document.getElementById('label-nome-usuario').innerHTML = `${usuarioLogado.nome}<br><span style="color:var(--primary)">${usuarioLogado.cargo}</span>`;
    renderizarMenuDinamico(); lucide.createIcons(); carregarPedidos(true); carregarLojasSelect(); carregarVitrineAdmin(); carregarNotificacoes();
}

function fazerLogout() { localStorage.removeItem('usuarioLogado'); window.location.reload(); }

function renderizarMenuDinamico() {
    const menu = document.getElementById('sidebar-menu-dinamico');
    let html = `<a href="#" class="sidebar-link ativo" onclick="mostrarTela('tela-pedidos')"><i data-lucide="clipboard-list"></i> Pedidos <span id="badge-menu-pedidos" class="menu-badge" style="display:none;">0</span></a>`;

    if (usuarioLogado.cargo === 'Logistica' || usuarioLogado.cargo === 'Diretor' || usuarioLogado.cargo === 'Master') {
        html += `<a href="#" class="sidebar-link" onclick="mostrarTela('tela-gerenciar-catalogo')"><i data-lucide="settings"></i> Catálogo</a>`;
        html += `<a href="#" class="sidebar-link" onclick="mostrarTela('tela-auditoria')"><i data-lucide="activity"></i> Auditoria de Estoque</a>`;
        html += `<a href="#" class="sidebar-link" onclick="mostrarTela('tela-relatorios')"><i data-lucide="pie-chart"></i> Análise (BI)</a>`;
        html += `<a href="#" class="sidebar-link" onclick="mostrarTela('tela-gerenciar-usuarios')"><i data-lucide="users"></i> Equipe e Lojas</a>`;
    } else if (usuarioLogado.cargo === 'Supervisor') {
        html += `<a href="#" class="sidebar-link" onclick="mostrarTela('tela-fazer-pedido')"><i data-lucide="shopping-cart"></i> Novo Pedido</a>`;
        html += `<a href="#" class="sidebar-link" onclick="mostrarTela('tela-gerenciar-usuarios')"><i data-lucide="store"></i> Minhas Lojas</a>`;
    }

    menu.innerHTML = html;
    
    const btnExportar = document.getElementById('btn-exportar-excel');
    if (btnExportar) {
        if (usuarioLogado.cargo === 'Diretor' || usuarioLogado.cargo === 'Logistica' || usuarioLogado.cargo === 'Master') btnExportar.style.display = 'flex';
        else btnExportar.style.display = 'none';
    }

    const filtroSupCustom = document.getElementById('filtro-supervisor-custom');
    if (filtroSupCustom && usuarioLogado.cargo !== 'Supervisor') { filtroSupCustom.style.display = 'block'; carregarFiltroSupervisoresCustom(); }
    
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
    const sidebar = document.getElementById('sidebar'); if (sidebar && sidebar.classList.contains('aberto')) toggleMenuMobile();
    ['tela-pedidos', 'tela-fazer-pedido', 'tela-gerenciar-catalogo', 'tela-gerenciar-usuarios', 'tela-auditoria', 'tela-relatorios'].forEach(tela => { const el = document.getElementById(tela); if (el) el.style.display = (tela === idTela) ? 'block' : 'none'; });
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('ativo')); if (event && event.currentTarget) event.currentTarget.classList.add('ativo');
    
    if (idTela === 'tela-pedidos') carregarPedidos(true); 
    if (idTela === 'tela-fazer-pedido') { carregarLojasSelect(); carregarCatalogoPedido(); }
    if (idTela === 'tela-gerenciar-catalogo') carregarVitrineAdmin(); 
    if (idTela === 'tela-gerenciar-usuarios') { carregarTabelaUsuarios(); carregarTabelaLojas(); carregarSupervisoresModal(); }
    if (idTela === 'tela-auditoria') carregarAuditoria();
    if (idTela === 'tela-relatorios') carregarRelatorios();
}

// ==========================================
// 4. MOTOR DE AGRUPAMENTO DE PRODUTOS
// ==========================================
function agruparCatalogo(dados_brutos) {
    const grupos = {};
    dados_brutos.forEach(item => {
        let baseName = item.nome ? item.nome.trim() : 'Material Sem Nome'; let varName = 'Único';
        const match = baseName.match(/^(.*) \((.*)\)$/); if (match) { baseName = match[1].trim(); varName = match[2].trim(); }
        const categoriaSegura = item.categoria ? item.categoria.trim() : 'Geral'; const chave = baseName.toLowerCase() + '_' + categoriaSegura.toLowerCase();
        if (!grupos[chave]) { grupos[chave] = { nome_base: baseName, categoria: categoriaSegura, subcategoria: item.subcategoria ? item.subcategoria.split(' | ')[0].trim() : '', foto_url: item.foto_url, ids_grupo: [], variacoes: [] }; }
        grupos[chave].ids_grupo.push(item.id); grupos[chave].variacoes.push({ id: item.id, nome_var: varName, quantidade: item.quantidade || 0, qtdSelecionada: item.qtdSelecionada || 0, nome_original: item.nome });
    });
    Object.values(grupos).forEach(g => g.variacoes.sort((a,b) => a.nome_var.localeCompare(b.nome_var)));
    return Object.values(grupos);
}

// ==========================================
// 4.1. VITRINE (ADMIN) E CATEGORIAS DINÂMICAS
// ==========================================
let memoriaCatalogo = []; let categoriaAtivaAdmin = 'Todos';

function abrirModalNovoProduto() {
    document.getElementById('input-nome-produto').value = ''; document.getElementById('input-subcategoria').value = ''; document.getElementById('input-qtd-produto').value = '0'; document.getElementById('container-grade-tamanhos').innerHTML = ''; document.getElementById('input-foto-produto').value = ''; document.getElementById('nome-arquivo-produto').innerText = 'Clique para anexar foto'; document.getElementById('input-categoria').style.display = 'block'; document.getElementById('input-nova-categoria').style.display = 'none'; document.getElementById('input-nova-categoria').value = ''; document.getElementById('btn-toggle-categoria').innerText = '+ Criar Nova Categoria'; document.getElementById('btn-toggle-categoria').style.color = 'var(--primary)';
    verificarEstoqueGlobal(); carregarCategoriasSelect(); document.getElementById('modal-novo-produto').style.display = 'flex'; lucide.createIcons();
}

function toggleNovaCategoria(prefix) {
    const sel = document.getElementById(`${prefix}-categoria`); const inp = document.getElementById(`${prefix}-nova-categoria`); const btn = document.getElementById(`btn-toggle-${prefix === 'edit' ? 'edit-' : ''}categoria`);
    if (sel.style.display === 'none') { sel.style.display = 'block'; inp.style.display = 'none'; inp.value = ''; btn.innerText = '+ Criar Nova Categoria'; btn.style.color = 'var(--primary)'; } 
    else { sel.style.display = 'none'; inp.style.display = 'block'; btn.innerText = 'Voltar para lista'; btn.style.color = 'var(--cor-secundaria)'; }
}

async function carregarCategoriasSelect() {
    try { const { data } = await supabaseClient.from('catalogo').select('categoria').eq('ativo', true); if (data) { const categorias = [...new Set(data.map(i => i.categoria).filter(Boolean))].sort(); ['input-categoria', 'edit-categoria'].forEach(selId => { const el = document.getElementById(selId); if (el) { el.innerHTML = '<option value="Geral">Geral</option>'; categorias.forEach(c => { if(c !== 'Geral') el.innerHTML += `<option value="${c}">${c}</option>`; }); } }); } } catch (e) {}
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

function verificarEstoqueGlobal() { const linhas = document.querySelectorAll('#container-grade-tamanhos > div'); const boxGlobal = document.getElementById('container-estoque-global'); if (boxGlobal) { if (linhas.length > 0) boxGlobal.style.display = 'none'; else boxGlobal.style.display = 'block'; } }
function verificarEstoqueGlobalEdit() { const linhas = document.querySelectorAll('#container-grade-edit > div'); const boxGlobal = document.getElementById('container-estoque-global-edit'); if (boxGlobal) { if (linhas.length > 0) boxGlobal.style.display = 'none'; else boxGlobal.style.display = 'block'; } }

function consertarLinkGoogleDrive(url) { if (!url) return ''; let id = ''; if (url.includes('/d/')) id = url.split('/d/')[1].split('/')[0]; else if (url.includes('id=')) id = url.split('id=')[1].split('&')[0]; return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w800` : url; }

async function carregarVitrineAdmin() {
    const vitrine = document.getElementById('vitrine-admin'); if(!vitrine) return; vitrine.innerHTML = '<div style="color: var(--cor-secundaria); padding: 20px;"><i data-lucide="loader" class="spinner"></i> Organizando prateleiras...</div>'; lucide.createIcons();
    try { const { data, error } = await supabaseClient.from('catalogo').select('*').eq('ativo', true).order('categoria').order('nome'); if (error) throw error; memoriaCatalogo = data || []; renderizarCategoriasAdmin(); renderizarVitrine(); } catch (e) { vitrine.innerHTML = `<div style="color: #ff4d4d; padding: 20px;">Erro ao carregar catálogo: ${e.message || 'Desconhecido'}</div>`; }
}

function renderizarCategoriasAdmin() {
    const nav = document.getElementById('nav-categorias-admin'); if(!nav) return; const categorias = [...new Set(memoriaCatalogo.map(i => i.categoria || 'Geral'))].sort();
    let html = `<button class="categoria-pill ${categoriaAtivaAdmin === 'Todos' ? 'ativo' : ''}" onclick="filtrarVitrineAdmin('Todos')">Todos os Itens</button>`;
    categorias.forEach(c => { html += `<button class="categoria-pill ${categoriaAtivaAdmin === c ? 'ativo' : ''}" onclick="filtrarVitrineAdmin('${c}')">${c}</button>`; }); nav.innerHTML = html;
}

function filtrarVitrineAdmin(cat) { categoriaAtivaAdmin = cat; renderizarCategoriasAdmin(); renderizarVitrine(); }

function renderizarVitrine() {
    const vitrine = document.getElementById('vitrine-admin'); const catalogAgrupado = agruparCatalogo(memoriaCatalogo); let filtrados = catalogAgrupado;
    if (categoriaAtivaAdmin !== 'Todos') filtrados = catalogAgrupado.filter(i => (i.categoria || 'Geral') === categoriaAtivaAdmin);
    
    filtrados.forEach(g => { g.totalEstoque = g.variacoes.reduce((s, v) => s + v.quantidade, 0); });
    if (ordemCatalogoAdmin === 'AZ') { filtrados.sort((a, b) => a.nome_base.localeCompare(b.nome_base)); } 
    else if (ordemCatalogoAdmin === 'MENOR') { filtrados.sort((a, b) => a.totalEstoque - b.totalEstoque); } 
    else if (ordemCatalogoAdmin === 'MAIOR') { filtrados.sort((a, b) => b.totalEstoque - a.totalEstoque); }

    vitrine.innerHTML = ''; if (filtrados.length === 0) { vitrine.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><i data-lucide="ghost"></i><p>Nenhum material encontrado no catálogo.</p></div>`; lucide.createIcons(); return; }

    filtrados.forEach(grupo => {
        const linkCorrigido = consertarLinkGoogleDrive(grupo.foto_url); const fotoHtml = linkCorrigido ? `<img src="${linkCorrigido}" loading="lazy" onerror="this.onerror=null; this.outerHTML='<div class=\\'produto-img-placeholder\\'><span>Sem Imagem</span></div>';">` : `<div class="produto-img-placeholder"><span>Sem Imagem</span></div>`;
        let chipsHtml = ''; 
        
        grupo.variacoes.forEach(v => { 
            let classeEstoque = '';
            if (v.quantidade <= 0) classeEstoque = 'falta';
            else if (v.quantidade <= 15) classeEstoque = 'alerta';
            chipsHtml += `<span class="var-chip ${classeEstoque}">${v.nome_var === 'Único' ? 'UN' : v.nome_var}: ${v.quantidade}</span>`; 
        });
        
        const objStr = JSON.stringify(grupo).replace(/"/g, '&quot;');
        vitrine.innerHTML += `<div class="produto-card"><div class="produto-img-container"><div class="badge-total-estoque">Total: ${grupo.totalEstoque}</div>${fotoHtml}</div><div class="produto-info"><h4>${grupo.nome_base}</h4><p>${grupo.categoria || 'Geral'} ${grupo.subcategoria ? '> ' + grupo.subcategoria : ''}</p><div class="var-chips-container">${chipsHtml}</div></div><div class="produto-acoes"><button onclick="abrirModalEditarProduto('${objStr}')"><i data-lucide="edit-2" class="lucide-sm"></i> Editar Lote</button><button class="btn-excluir-prod" onclick="excluirProdutoGrupo('${JSON.stringify(grupo.ids_grupo)}', this)"><i data-lucide="trash-2" class="lucide-sm"></i> Excluir Lote</button></div></div>`;
    }); lucide.createIcons();
}

async function salvarProduto() {
    const nomeBase = document.getElementById('input-nome-produto').value.trim(); const subCatBase = document.getElementById('input-subcategoria').value.trim(); const qtdGlobal = parseInt(document.getElementById('input-qtd-produto').value) || 0; const inputFoto = document.getElementById('input-foto-produto');
    let categoria = document.getElementById('input-nova-categoria').style.display === 'block' ? document.getElementById('input-nova-categoria').value.trim() : document.getElementById('input-categoria').value; if (!categoria) categoria = 'Geral';
    if (!nomeBase) return mostrarAviso('Digite o nome do material.', 'erro');
    
    setCarregamento('btn-salvar-produto', true, 'Processando...');
    try {
        let fotoUrl = null; 
        if (inputFoto.files.length > 0) { mostrarAviso('Enviando foto ao Google Drive...', 'sucesso'); try { fotoUrl = await fazerUploadDrive(inputFoto.files[0], 'catalogo'); } catch (errDrive) { console.error("Erro no Drive:", errDrive); mostrarAviso('Falha no link de imagem. Salvando material sem foto.', 'erro'); } }
        
        const linhasGrade = document.querySelectorAll('#container-grade-tamanhos > div');
        const inserts = [];

        if (linhasGrade.length > 0) {
            for (let linha of linhasGrade) {
                const varName = linha.querySelector('.input-tamanho').value.trim(); const qtd = parseInt(linha.querySelector('.input-qtd-tamanho').value) || 0;
                if(varName) inserts.push({ nome: `${nomeBase} (${varName})`, categoria: categoria, subcategoria: subCatBase ? `${subCatBase} | ${varName}` : `${varName}`, quantidade: qtd, foto_url: fotoUrl, ativo: true, secao: '' });
            }
        } else { 
            inserts.push({ nome: nomeBase, categoria: categoria, subcategoria: subCatBase, quantidade: qtdGlobal, foto_url: fotoUrl, ativo: true, secao: '' }); 
        }

        const { error } = await supabaseClient.from('catalogo').insert(inserts);
        if(error) throw error;

        mostrarAviso('Material adicionado!', 'sucesso'); document.getElementById('modal-novo-produto').style.display = 'none'; carregarVitrineAdmin();
    } catch (e) { console.error("ERRO NO BANCO:", e); mostrarAviso('Erro ao salvar no banco. Verifique o console.', 'erro'); } finally { setCarregamento('btn-salvar-produto', false); }
}

async function abrirModalEditarProduto(grupoStr) {
    const g = JSON.parse(grupoStr); await carregarCategoriasSelect();
    document.getElementById('edit-ids-grupo').value = JSON.stringify(g.ids_grupo); document.getElementById('edit-nome-produto').value = g.nome_base; document.getElementById('edit-subcategoria').value = g.subcategoria || ''; document.getElementById('edit-categoria').style.display = 'block'; document.getElementById('edit-nova-categoria').style.display = 'none'; document.getElementById('btn-toggle-edit-categoria').innerText = '+ Criar Nova Categoria'; document.getElementById('btn-toggle-edit-categoria').style.color = 'var(--primary)';
    
    const selCat = document.getElementById('edit-categoria'); const catExiste = Array.from(selCat.options).some(opt => opt.value === g.categoria); if(catExiste) selCat.value = g.categoria; else selCat.value = 'Geral';
    const containerEdit = document.getElementById('container-grade-edit'); containerEdit.innerHTML = '';
    
    if (g.variacoes.length === 1 && g.variacoes[0].nome_var === 'Único') { document.getElementById('edit-qtd-produto').value = g.variacoes[0].quantidade; } else { g.variacoes.forEach(v => { if(v.nome_var !== 'Único') adicionarLinhaGradeEdit(v.nome_var, v.quantidade); }); }
    verificarEstoqueGlobalEdit(); document.getElementById('modal-editar-produto').style.display = 'flex'; lucide.createIcons();
}

async function salvarEdicaoProduto() {
    const idsAntigosRaw = document.getElementById('edit-ids-grupo').value; const nomeBase = document.getElementById('edit-nome-produto').value.trim(); const subCatBase = document.getElementById('edit-subcategoria').value.trim(); const qtdGlobal = parseInt(document.getElementById('edit-qtd-produto').value) || 0;
    let categoria = document.getElementById('edit-nova-categoria').style.display === 'block' ? document.getElementById('edit-nova-categoria').value.trim() : document.getElementById('edit-categoria').value; if (!categoria) categoria = 'Geral';
    if (!nomeBase) return mostrarAviso('O nome é obrigatório.', 'erro');
    
    setCarregamento('btn-salvar-edicao-produto', true, 'Salvando...');
    try {
        const idsAntigos = JSON.parse(idsAntigosRaw);
        const { data: oldData } = await supabaseClient.from('catalogo').select('foto_url').eq('id', idsAntigos[0]).single(); const oldFotoUrl = oldData ? oldData.foto_url : null;
        const { error: errDel } = await supabaseClient.from('catalogo').update({ ativo: false }).in('id', idsAntigos); if(errDel) throw errDel;
        
        const linhasGrade = document.querySelectorAll('#container-grade-edit > div');
        const inserts = [];

        if (linhasGrade.length > 0) {
            for (let linha of linhasGrade) {
                const varName = linha.querySelector('.edit-tamanho').value.trim(); const qtd = parseInt(linha.querySelector('.edit-qtd-tamanho').value) || 0;
                if(varName) inserts.push({ nome: `${nomeBase} (${varName})`, categoria: categoria, subcategoria: subCatBase ? `${subCatBase} | ${varName}` : `${varName}`, quantidade: qtd, foto_url: oldFotoUrl, ativo: true, secao: '' });
            }
        } else { inserts.push({ nome: nomeBase, categoria: categoria, subcategoria: subCatBase, quantidade: qtdGlobal, foto_url: oldFotoUrl, ativo: true, secao: '' }); }

        const { error } = await supabaseClient.from('catalogo').insert(inserts);
        if(error) throw error;

        mostrarAviso('Atualizado com sucesso!', 'sucesso'); document.getElementById('modal-editar-produto').style.display = 'none'; carregarVitrineAdmin(); carregarCatalogoPedido();
    } catch(e) { console.error("ERRO EDIÇÃO:", e); mostrarAviso('Erro ao editar. Verifique console.', 'erro'); } finally { setCarregamento('btn-salvar-edicao-produto', false); }
}

async function excluirProdutoGrupo(idsArrStr, btn) {
    confirmarAcao("Excluir este lote de materiais permanentemente da vitrine?", async () => {
        const ids = JSON.parse(idsArrStr); const htmlOriginal = btn.innerHTML; btn.innerHTML = '<i data-lucide="loader" class="lucide-sm spinner"></i>'; btn.style.pointerEvents = 'none';
        try { const { error } = await supabaseClient.from('catalogo').update({ ativo: false }).in('id', ids); if(error) throw error; mostrarAviso('Lote Removido.', 'sucesso'); carregarVitrineAdmin(); carregarCatalogoPedido(); } 
        catch(e) { console.error("ERRO EXCLUSAO:", e); mostrarAviso('Erro ao excluir.', 'erro'); btn.innerHTML = htmlOriginal; btn.style.pointerEvents = 'auto'; lucide.createIcons(); }
    });
}

// ==========================================
// 5. LOJAS E USUÁRIOS
// ==========================================
async function carregarTabelaLojas() {
    const tbody = document.getElementById('tabela-lojas-admin'); if(!tbody) return; let q = supabaseClient.from('lojas').select('*, usuarios(nome)').order('nome'); if (usuarioLogado.cargo === 'Supervisor') q = q.eq('supervisor_id', usuarioLogado.id); 
    const { data } = await q; tbody.innerHTML = '';
    
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2"><div class="empty-state"><i data-lucide="store"></i><p>Nenhuma loja cadastrada.</p></div></td></tr>`;
        lucide.createIcons(); return;
    }
    
    data.forEach(loja => {
        const promotor = loja.promotor_nome ? ` | Prom: ${loja.promotor_nome}` : ''; const lojaStr = JSON.stringify(loja).replace(/"/g, '&quot;');
        let botoesAcao = `<button onclick="abrirModalEditarLoja('${lojaStr}')" style="background:transparent; border:none; color:var(--primary); cursor:pointer;" title="Editar Loja"><i data-lucide="edit" class="lucide-sm"></i></button>`;
        if (usuarioLogado.cargo === 'Diretor' || usuarioLogado.cargo === 'Logistica' || usuarioLogado.cargo === 'Master') botoesAcao += `<button onclick="excluirLoja(${loja.id}, this)" style="background:transparent; border:none; color:#ff4d4d; cursor:pointer; margin-left:10px;" title="Excluir Loja"><i data-lucide="trash-2" class="lucide-sm"></i></button>`;
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

function abrirModalNovaLoja() {
    document.getElementById('loja-nome').value = ''; document.getElementById('loja-promotor').value = ''; document.getElementById('loja-contato').value = ''; document.getElementById('loja-cep').value = ''; document.getElementById('loja-rua').value = ''; document.getElementById('loja-bairro').value = ''; document.getElementById('loja-cidade').value = ''; document.getElementById('loja-estado').value = '';
    if (usuarioLogado.cargo === 'Supervisor') { document.getElementById('container-supervisor-loja').style.display = 'none'; } else { document.getElementById('container-supervisor-loja').style.display = 'block'; }
    document.getElementById('modal-nova-loja').style.display = 'flex';
}

async function salvarLoja() {
    let supervisor_id = document.getElementById('loja-supervisor').value;
    if (usuarioLogado.cargo === 'Supervisor') supervisor_id = usuarioLogado.id;
    const dados = { nome: document.getElementById('loja-nome').value.trim(), supervisor_id: supervisor_id, promotor_nome: document.getElementById('loja-promotor').value.trim(), promotor_contato: document.getElementById('loja-contato').value.trim(), cep: document.getElementById('loja-cep').value.trim(), rua: document.getElementById('loja-rua').value.trim(), bairro: document.getElementById('loja-bairro').value.trim(), cidade: document.getElementById('loja-cidade').value.trim(), estado: document.getElementById('loja-estado').value.trim() };
    if (!dados.nome || !dados.supervisor_id) return mostrarAviso('Loja e Supervisor obrigatórios!', 'erro');
    setCarregamento('btn-salvar-loja', true, 'Salvando...');
    try { const { error } = await supabaseClient.from('lojas').insert([dados]); if (error) throw error; mostrarAviso('Loja criada!', 'sucesso'); document.getElementById('modal-nova-loja').style.display = 'none'; carregarTabelaLojas(); } catch (e) { mostrarAviso('Erro ao criar loja.', 'erro'); } finally { setCarregamento('btn-salvar-loja', false); }
}

function abrirModalEditarLoja(lojaStr) {
    const loja = JSON.parse(lojaStr);
    document.getElementById('edit-id-loja').value = loja.id; document.getElementById('edit-loja-nome').value = loja.nome; document.getElementById('edit-loja-promotor').value = loja.promotor_nome || ''; document.getElementById('edit-loja-contato').value = loja.promotor_contato || ''; document.getElementById('edit-loja-cep').value = loja.cep || ''; document.getElementById('edit-loja-rua').value = loja.rua || ''; document.getElementById('edit-loja-bairro').value = loja.bairro || ''; document.getElementById('edit-loja-cidade').value = loja.cidade || ''; document.getElementById('edit-loja-estado').value = loja.estado || '';
    if (usuarioLogado.cargo === 'Diretor' || usuarioLogado.cargo === 'Logistica' || usuarioLogado.cargo === 'Master') { document.getElementById('container-edit-supervisor-loja').style.display = 'block'; document.getElementById('edit-loja-supervisor').value = loja.supervisor_id; } else { document.getElementById('container-edit-supervisor-loja').style.display = 'none'; }
    document.getElementById('modal-editar-loja').style.display = 'flex';
}

async function salvarEdicaoLoja() {
    const id = document.getElementById('edit-id-loja').value; let supervisor_id = document.getElementById('edit-loja-supervisor').value;
    if (usuarioLogado.cargo === 'Supervisor') supervisor_id = usuarioLogado.id;
    const dados = { nome: document.getElementById('edit-loja-nome').value.trim(), supervisor_id: supervisor_id, promotor_nome: document.getElementById('edit-loja-promotor').value.trim(), promotor_contato: document.getElementById('edit-loja-contato').value.trim(), cep: document.getElementById('edit-loja-cep').value.trim(), rua: document.getElementById('edit-loja-rua').value.trim(), bairro: document.getElementById('edit-loja-bairro').value.trim(), cidade: document.getElementById('edit-loja-cidade').value.trim(), estado: document.getElementById('edit-loja-estado').value.trim() };
    setCarregamento('btn-salvar-edicao-loja', true, 'Salvando...');
    try { const { error } = await supabaseClient.from('lojas').update(dados).eq('id', id); if (error) throw error; mostrarAviso('Atualizado com sucesso!', 'sucesso'); document.getElementById('modal-editar-loja').style.display = 'none'; carregarTabelaLojas(); } catch(e) { mostrarAviso('Erro ao editar loja.', 'erro'); } finally { setCarregamento('btn-salvar-edicao-loja', false); }
}

async function carregarTabelaUsuarios() {
    const tbody = document.getElementById('tabela-usuarios-admin'); if(!tbody) return;
    const { data } = await supabaseClient.from('usuarios').select('*').order('nome'); tbody.innerHTML = ''; 
    
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><i data-lucide="users"></i><p>Nenhum usuário ativo.</p></div></td></tr>`;
        lucide.createIcons(); return;
    }
    
    data.forEach(u => {
        if (u.cargo === 'Master' && usuarioLogado.cargo !== 'Master') return;
        if (usuarioLogado.cargo === 'Logistica' && (u.cargo === 'Diretor' || u.cargo === 'Master')) return;
        if (usuarioLogado.cargo === 'Diretor' && u.cargo === 'Master') return;

        const userStr = JSON.stringify(u).replace(/"/g, '&quot;'); 
        let botoesAcao = ''; let podeEditar = false;
        
        if (usuarioLogado.cargo === 'Master') podeEditar = true;
        else if (usuarioLogado.cargo === 'Diretor') { if (u.cargo === 'Logistica' || u.cargo === 'Supervisor') podeEditar = true; } 
        else if (usuarioLogado.cargo === 'Logistica') { if (u.cargo === 'Supervisor') podeEditar = true; }

        if (!podeEditar) { botoesAcao = '<span style="font-size:11px; color:var(--cor-secundaria); font-weight:bold;">Acesso Restrito</span>'; } 
        else { botoesAcao = `<button onclick="abrirModalEditarUsuario('${userStr}')" style="background:transparent; border:none; color:var(--primary); cursor:pointer;" title="Editar Usuário"><i data-lucide="edit" class="lucide-sm"></i></button><button onclick="excluirUsuario(${u.id}, this)" style="background:transparent; border:none; color:#ff4d4d; cursor:pointer; margin-left:10px;" title="Excluir Usuário"><i data-lucide="trash-2" class="lucide-sm"></i></button>`; }
        
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

function abrirModalNovoUsuario() {
    document.getElementById('input-nome-user').value = ''; document.getElementById('input-email-user').value = ''; document.getElementById('input-senha-user').value = '';
    const selectCargo = document.getElementById('select-cargo-user'); selectCargo.innerHTML = '';
    if (usuarioLogado.cargo === 'Master') { selectCargo.innerHTML = `<option value="Diretor">Diretor</option><option value="Logistica">Logística</option><option value="Supervisor">Supervisor</option><option value="Master">Master</option>`; } 
    else if (usuarioLogado.cargo === 'Diretor') { selectCargo.innerHTML = `<option value="Logistica">Logística</option><option value="Supervisor">Supervisor</option>`; } 
    else if (usuarioLogado.cargo === 'Logistica') { selectCargo.innerHTML = `<option value="Supervisor">Supervisor</option>`; }
    document.getElementById('modal-novo-usuario').style.display = 'flex';
}

function abrirModalEditarUsuario(userStr) {
    const user = JSON.parse(userStr); document.getElementById('edit-id-user').value = user.id; document.getElementById('edit-nome-user').value = user.nome; document.getElementById('edit-email-user').value = user.email; document.getElementById('edit-senha-user').value = user.senha; 
    const cargoSelect = document.getElementById('edit-cargo-user'); cargoSelect.innerHTML = '';
    
    if (usuarioLogado.cargo === 'Master') { cargoSelect.innerHTML = `<option value="Diretor">Diretor</option><option value="Logistica">Logística</option><option value="Supervisor">Supervisor</option><option value="Master">Master</option>`; } 
    else if (usuarioLogado.cargo === 'Diretor') { cargoSelect.innerHTML = `<option value="Logistica">Logística</option><option value="Supervisor">Supervisor</option>`; } 
    else if (usuarioLogado.cargo === 'Logistica') { cargoSelect.innerHTML = `<option value="Supervisor">Supervisor</option>`; }
    
    if (!Array.from(cargoSelect.options).some(opt => opt.value === user.cargo)) { cargoSelect.innerHTML += `<option value="${user.cargo}">${user.cargo}</option>`; }
    cargoSelect.value = user.cargo; 
    
    const isLogadoAdmin = (usuarioLogado.cargo && usuarioLogado.cargo.toLowerCase().includes('diretor')) || usuarioLogado.cargo === 'Master';
    if (!isLogadoAdmin) { cargoSelect.disabled = true; cargoSelect.style.opacity = '0.5'; cargoSelect.title = "Apenas diretores/masters podem alterar cargos"; } else { cargoSelect.disabled = false; cargoSelect.style.opacity = '1'; cargoSelect.title = ""; }
    document.getElementById('modal-editar-usuario').style.display = 'flex';
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
// 6. E-COMMERCE E CARRINHO DE SOLICITAÇÃO
// ==========================================
let memoriaCatalogoPedido = [];
let categoriaAtivaPedido = 'Todos';

async function carregarCatalogoPedido() {
    const vitrine = document.getElementById('vitrine-pedido'); if(!vitrine) return;
    vitrine.innerHTML = '<div style="color: var(--cor-secundaria); padding: 20px;"><i data-lucide="loader" class="spinner"></i> Carregando produtos...</div>'; lucide.createIcons();
    try { const { data, error } = await supabaseClient.from('catalogo').select('*').eq('ativo', true).order('categoria').order('nome'); if (error) throw error; memoriaCatalogoPedido = data || []; memoriaCatalogoPedido.forEach(item => item.qtdSelecionada = 0); renderizarCategoriasPedido(); renderizarVitrinePedido(); } catch (e) { vitrine.innerHTML = `<div style="color: #ff4d4d; padding: 20px;">Erro ao carregar catálogo.</div>`; }
}

function renderizarCategoriasPedido() {
    const nav = document.getElementById('nav-categorias-pedido'); if(!nav) return; const categorias = [...new Set(memoriaCatalogoPedido.map(i => i.categoria || 'Geral'))].sort();
    let html = `<button class="categoria-pill ${categoriaAtivaPedido === 'Todos' ? 'ativo' : ''}" onclick="filtrarVitrinePedido('Todos')">Todos os Itens</button>`;
    categorias.forEach(c => { html += `<button class="categoria-pill ${categoriaAtivaPedido === c ? 'ativo' : ''}" onclick="filtrarVitrinePedido('${c}')">${c}</button>`; }); nav.innerHTML = html;
}

function filtrarVitrinePedido(cat) { categoriaAtivaPedido = cat; renderizarCategoriasPedido(); renderizarVitrinePedido(); }

function alterarQtdPedido(id, delta) {
    const item = memoriaCatalogoPedido.find(i => i.id == id); if(!item) return;
    item.qtdSelecionada += delta; if(item.qtdSelecionada < 0) item.qtdSelecionada = 0;
    const input = document.getElementById(`qtd-pedido-${item.id}`); if(input) input.value = item.qtdSelecionada;
    let baseName = item.nome || 'Sem Nome';
    if (baseName.includes('(') && baseName.endsWith(')')) { const match = baseName.match(/^(.*) \((.*)\)$/); if (match) baseName = match[1].trim(); }
    const idCardHtml = `card-pedido-${baseName}_${item.categoria || 'Geral'}`.replace(/[^a-zA-Z0-9]/g, ''); const cardBase = document.getElementById(idCardHtml);
    if(cardBase) { 
        const temAlgum = memoriaCatalogoPedido.some(i => { let bn = i.nome || ''; if (bn.includes('(') && bn.endsWith(')')) bn = bn.match(/^(.*) \((.*)\)$/)?.[1]?.trim() || bn; return bn === baseName && (i.categoria || 'Geral') === (item.categoria || 'Geral') && i.qtdSelecionada > 0; });
        if(temAlgum) cardBase.classList.add('selecionado'); else cardBase.classList.remove('selecionado'); 
    }
}

function digitarQtdPedido(id, inputElement) {
    const item = memoriaCatalogoPedido.find(i => i.id == id); if(!item) return;
    let novoValor = parseInt(inputElement.value);
    if (isNaN(novoValor) || novoValor < 0) novoValor = 0; 
    item.qtdSelecionada = novoValor; inputElement.value = novoValor;
    
    let baseName = item.nome || 'Sem Nome';
    if (baseName.includes('(') && baseName.endsWith(')')) { const match = baseName.match(/^(.*) \((.*)\)$/); if (match) baseName = match[1].trim(); }
    const idCardHtml = `card-pedido-${baseName}_${item.categoria || 'Geral'}`.replace(/[^a-zA-Z0-9]/g, ''); 
    const cardBase = document.getElementById(idCardHtml);
    if(cardBase) { 
        const temAlgum = memoriaCatalogoPedido.some(i => { let bn = i.nome || ''; if (bn.includes('(') && bn.endsWith(')')) bn = bn.match(/^(.*) \((.*)\)$/)?.[1]?.trim() || bn; return bn === baseName && (i.categoria || 'Geral') === (item.categoria || 'Geral') && i.qtdSelecionada > 0; });
        if(temAlgum) cardBase.classList.add('selecionado'); else cardBase.classList.remove('selecionado'); 
    }
}

function renderizarVitrinePedido() {
    const vitrine = document.getElementById('vitrine-pedido'); const catalogAgrupado = agruparCatalogo(memoriaCatalogoPedido); let filtrados = catalogAgrupado;
    if (categoriaAtivaPedido !== 'Todos') filtrados = catalogAgrupado.filter(i => (i.categoria || 'Geral') === categoriaAtivaPedido);
    vitrine.innerHTML = ''; if (filtrados.length === 0) { vitrine.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><i data-lucide="package-search"></i><p>Nenhum material disponível para solicitação.</p></div>`; lucide.createIcons(); return; }

    filtrados.forEach(grupo => {
        const linkCorrigido = consertarLinkGoogleDrive(grupo.foto_url); const fotoHtml = linkCorrigido ? `<img src="${linkCorrigido}" loading="lazy" onerror="this.onerror=null; this.outerHTML='<div class=\\'produto-img-placeholder\\'><span>Sem Imagem</span></div>';">` : `<div class="produto-img-placeholder"><span>Sem Imagem</span></div>`;
        let variacoesHtml = '<div class="variacoes-lista">'; let selecionadoGeral = false;

        grupo.variacoes.forEach(v => {
            if(v.qtdSelecionada > 0) selecionadoGeral = true; const classeFalta = v.quantidade <= 0 ? 'color: #ff4d4d;' : '';
            let textoEstoque = usuarioLogado.cargo === 'Supervisor' ? (v.quantidade > 0 ? 'Disponível' : 'Indisponível (Falta)') : `${v.quantidade} disponíveis`;
            variacoesHtml += `<div class="variacao-item">
                <div class="linha-clicavel" style="display:flex; flex-direction:column; max-width: 60%;" onclick="alterarQtdPedido('${v.id}', 1)" title="Clique para adicionar +1">
                    <span class="var-nome">${v.nome_var === 'Único' ? 'Unidade Padrão' : v.nome_var}</span>
                    <span class="var-estoque" style="${classeFalta}">${textoEstoque}</span>
                </div>
                <div class="qtd-selector" style="padding: 2px;">
                    <button type="button" class="qtd-btn" style="width:25px;height:25px;font-size:16px;" onclick="alterarQtdPedido('${v.id}', -1)">-</button>
                    <input type="number" class="qtd-input" id="qtd-pedido-${v.id}" value="${v.qtdSelecionada}" min="0" oninput="digitarQtdPedido('${v.id}', this)" onfocus="this.select()">
                    <button type="button" class="qtd-btn" style="width:25px;height:25px;font-size:16px;" onclick="alterarQtdPedido('${v.id}', 1)">+</button>
                </div>
            </div>`;
        }); variacoesHtml += '</div>';
        const idCardHtml = `card-pedido-${grupo.nome_base}_${grupo.categoria}`.replace(/[^a-zA-Z0-9]/g, '');

        vitrine.innerHTML += `<div class="produto-card ${selecionadoGeral ? 'selecionado' : ''}" id="${idCardHtml}"><div class="produto-img-container">${fotoHtml}</div><div class="produto-info"><h4>${grupo.nome_base}</h4><p style="margin-bottom: 5px;">${grupo.categoria || 'Geral'} ${grupo.subcategoria ? '> ' + grupo.subcategoria : ''}</p>${variacoesHtml}</div></div>`;
    }); lucide.createIcons();
}

async function salvarSolicitacao() {
    const lojaId = document.getElementById('select-loja').value; const itensSelecionados = memoriaCatalogoPedido.filter(i => i.qtdSelecionada > 0);
    if (!lojaId) return mostrarAviso('Selecione a Loja/Destino!', 'erro'); if (itensSelecionados.length === 0) return mostrarAviso('Adicione pelo menos um material!', 'erro'); if (arquivosBancada.length === 0) return mostrarAviso('Anexe as fotos da bancada!', 'erro');
    
    let itensPedido = []; let atualizacoesEstoque = []; let temFalta = false;
    itensSelecionados.forEach(item => {
        const qtdPedida = item.qtdSelecionada; const estoqueAtual = item.quantidade; let nomeFinalFormato = item.nome;
        const matchVar = item.nome.match(/^(.*) \((.*)\)$/); if (matchVar && matchVar[2] !== 'Único') { nomeFinalFormato = `${matchVar[1].trim()} - Var: ${matchVar[2].trim()}`; }
        itensPedido.push(`${qtdPedida}x ${nomeFinalFormato}`); if (estoqueAtual <= 0 || qtdPedida > estoqueAtual) temFalta = true;
        const novoEstoque = estoqueAtual - qtdPedida; atualizacoesEstoque.push({ id: item.id, quantidade: novoEstoque < 0 ? 0 : novoEstoque, nome: nomeFinalFormato, baixado: qtdPedida });
    });

    let detalhes = itensPedido.join(', '); if (temFalta) detalhes = `[CONTÉM ITEM SEM ESTOQUE] ` + detalhes;
    setCarregamento('btn-enviar-pedido', true, 'Processando Pedido...');

    try {
        let urlsBancada = [];
        try { 
            const uploadPromises = arquivosBancada.map((file, i) => fazerUploadDrive(file, `bancada_${i+1}`)); urlsBancada = await Promise.all(uploadPromises);
        } catch (errDrive) { console.error("Erro Drive:", errDrive); mostrarAviso('Falha no upload das fotos. Enviando sem imagens.', 'erro'); }
        
        const { error: erroInsert } = await supabaseClient.from('pedidos').insert([{ loja_id: lojaId, detalhes, foto_url: urlsBancada.join(','), status: 'Pendente' }]); 
        if (erroInsert) throw erroInsert;
        
        const promessasBD = [];
        atualizacoesEstoque.forEach(item => {
            promessasBD.push(supabaseClient.from('catalogo').update({ quantidade: item.quantidade }).eq('id', item.id));
            try {
                promessasBD.push(supabaseClient.from('logs_estoque').insert([{ material: item.nome, quantidade_movimentada: -item.baixado, responsavel: usuarioLogado.nome, motivo: 'Solicitação de Pedido' }]));
            } catch (errLog) {}
        });
        await Promise.allSettled(promessasBD);

        mostrarAviso('Pedido Enviado com Sucesso!', 'sucesso'); 
        document.getElementById('select-loja').value = ''; 
        document.getElementById('loja-selecionada-texto').innerHTML = 'Selecione a unidade...';
        document.getElementById('loja-selecionada-texto').style.color = 'var(--cor-secundaria)';
        arquivosBancada = []; renderizarMiniaturasBancada(); memoriaCatalogoPedido.forEach(item => item.qtdSelecionada = 0); mostrarTela('tela-pedidos');
    } catch (e) { console.error("ERRO AO ENVIAR:", e); mostrarAviso('Erro no envio. Verifique a conexão.', 'erro'); } finally { setCarregamento('btn-enviar-pedido', false); }
}

// ==========================================
// 7. DASHBOARD, WORKFLOW E NOTIFICAÇÕES
// ==========================================
function filtrarPorCard(status) {
    if (filtroCardAtivo === status) { filtroCardAtivo = null; document.getElementById('card-' + status).classList.remove('card-ativo'); }
    else {
        ['Pendente', 'Enviado', 'Reversa', 'Entregue', 'Alerta'].forEach(id => { const c = document.getElementById('card-' + id); if(c) c.classList.remove('card-ativo'); });
        filtroCardAtivo = status; document.getElementById('card-' + status).classList.add('card-ativo');
    } carregarPedidos(true);
}

function mudarAbaPedidos(aba) {
    abaAtualPedidos = aba; filtroCardAtivo = null;
    ['Pendente', 'Enviado', 'Reversa', 'Entregue', 'Alerta'].forEach(id => { const c = document.getElementById('card-' + id); if(c) c.classList.remove('card-ativo'); });
    document.getElementById('aba-ativos').classList.remove('ativo'); document.getElementById('aba-historico').classList.remove('ativo');
    document.getElementById(`aba-${aba}`).classList.add('ativo'); carregarPedidos(true);
}

async function carregarNotificacoes() {
    let q = supabaseClient.from('pedidos').select('id, status, created_at, lojas!inner(nome, supervisor_id)').order('created_at', { ascending: false }).limit(10);
    
    if (usuarioLogado.cargo === 'Supervisor') {
        q = q.eq('lojas.supervisor_id', usuarioLogado.id).in('status', ['Enviado', 'Reprovado', 'Reversa Concluída']);
    } else {
        q = q.in('status', ['Pendente', 'Aguardando Reversa']);
    }

    const { data } = await q;
    const lista = document.getElementById('lista-notificacoes-corpo');
    const badgeMobile = document.getElementById('badge-notificacao-mobile');
    const badgeDesktop = document.getElementById('badge-notificacao-desktop');
    
    lista.innerHTML = '';
    
    if (!data || data.length === 0) {
        lista.innerHTML = `<div class="empty-state" style="padding: 30px;"><i data-lucide="bell-off"></i><p>Tudo tranquilo por aqui.</p></div>`;
        badgeMobile.style.display = 'none'; badgeDesktop.style.display = 'none';
        lucide.createIcons(); return;
    }

    badgeMobile.innerText = data.length; badgeMobile.style.display = 'flex';
    badgeDesktop.innerText = data.length; badgeDesktop.style.display = 'flex';

    data.forEach(n => {
        let icone = 'bell'; let cor = 'var(--cor-secundaria)';
        if(n.status === 'Pendente') { icone = 'shopping-cart'; cor = '#f59e0b'; }
        if(n.status === 'Enviado') { icone = 'truck'; cor = '#3b82f6'; }
        if(n.status === 'Aguardando Reversa') { icone = 'rotate-ccw'; cor = '#a855f7'; }
        
        lista.innerHTML += `<div class="notificacao-item" onclick="abrirModalVerPedido(${n.id}); fecharNotificacoesFora({target: document.getElementById('modal-notificacoes')});">
            <div style="display:flex; align-items:center; gap:10px;">
                <i data-lucide="${icone}" style="color:${cor}; width:18px; height:18px;"></i>
                <div><strong style="color:#fff;">Pedido #${n.id}</strong> - ${n.lojas.nome}<br><span style="color:${cor}; font-size:11px;">Status: ${n.status}</span></div>
            </div>
        </div>`;
    }); lucide.createIcons();
}

function abrirModalNotificacoes() { document.getElementById('modal-notificacoes').style.display = 'block'; }
function fecharNotificacoesFora(e) { if(e.target.id === 'modal-notificacoes') { document.getElementById('modal-notificacoes').style.display = 'none'; } }

async function carregarPedidos(reset = true) {
    if (reset) {
        paginaAtualPedidos = 0; todosPedidosCarregados = false; memoriaPedidos = [];
        document.getElementById('tabela-dados-corpo').innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--cor-secundaria); padding: 20px;"><i data-lucide="loader" class="spinner"></i> Carregando pedidos...</td></tr>';
        lucide.createIcons();
        
        let qStats = supabaseClient.from('pedidos').select('status, detalhes, lojas!inner(supervisor_id)');
        if (usuarioLogado.cargo === 'Supervisor') qStats = qStats.eq('lojas.supervisor_id', usuarioLogado.id);
        else if (filtroSupIdSelecionado) qStats = qStats.eq('lojas.supervisor_id', filtroSupIdSelecionado);
        
        const { data: stats } = await qStats;
        if(stats) {
            let pendentes = 0, enviados = 0, reversas = 0, entregues = 0, alertas = 0;
            stats.forEach(p => { 
                if (p.status === 'Pendente') pendentes++; 
                if (p.status === 'Enviado') enviados++; 
                if (p.status === 'Aguardando Reversa') reversas++; 
                if (p.status === 'Entregue' || p.status === 'Reversa Concluída') entregues++; 
                if (p.detalhes.includes('ESTOQUE')) alertas++; 
            });
            document.getElementById('dash-pendentes').innerText = pendentes; 
            document.getElementById('dash-enviados').innerText = enviados; 
            document.getElementById('dash-reversas').innerText = reversas; 
            document.getElementById('dash-entregues').innerText = entregues; 
            document.getElementById('dash-alertas').innerText = alertas;
            
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

    if (filtroCardAtivo) { 
        if (filtroCardAtivo === 'Alerta') q = q.like('detalhes', '%ESTOQUE%'); 
        else if (filtroCardAtivo === 'Entregue') q = q.in('status', ['Entregue', 'Reversa Concluída']);
        else if (filtroCardAtivo === 'Reversa') q = q.eq('status', 'Aguardando Reversa');
        else q = q.eq('status', filtroCardAtivo); 
    } 
    else { 
        if (abaAtualPedidos === 'ativos') q = q.in('status', ['Pendente', 'Enviado', 'Aguardando Reversa']); 
        else q = q.in('status', ['Entregue', 'Reversa Concluída', 'Reprovado']); 
    }

    q = q.order('created_at', { ascending: false }).range(paginaAtualPedidos * itensPorPagina, (paginaAtualPedidos + 1) * itensPorPagina - 1);
    const { data } = await q;

    if (reset) tbody.innerHTML = '';
    else { const loadingRow = document.getElementById('linha-carregando-mais'); if(loadingRow) loadingRow.remove(); }

    if (!data || data.length === 0) {
        todosPedidosCarregados = true;
        if (reset) {
            tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i data-lucide="package-search"></i><p>Nenhum pedido encontrado.</p></div></td></tr>`;
            lucide.createIcons();
        } else {
            tbody.innerHTML += '<tr><td colspan="4" style="text-align:center; color:var(--cor-secundaria); padding: 15px; font-size: 12px;">Fim da lista.</td></tr>';
        }
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
        if (p.detalhes.includes('||_REV_')) {
            avisoFalta = `<span class="tag-reversa" style="margin-top: 5px;"><i data-lucide="rotate-ccw" style="width:10px; height:10px;"></i> Devolução Registrada</span>`;
        } else if (p.detalhes.includes('[ATENDIMENTO PARCIAL]')) {
            avisoFalta = `<span class="tag-parcial" style="margin-top: 5px;">Expedição Parcial</span>`;
        } else if (p.detalhes.includes('ESTOQUE')) {
            avisoFalta = `<span class="tag-alerta" style="margin-top: 5px;">Atenção: Ruptura na Origem</span>`;
        }

        let btnLista = `<button class="btn-ver-lista" onclick="abrirModalVerPedido(${p.id})"><i data-lucide="file-text" class="lucide-sm"></i> Ver Lista</button> <br>${avisoFalta}`;

        let acaoHtml = `<span style="font-weight:bold; color:#f59e0b;">${p.status}</span>`; 
        const isAdminLog = ['Logistica', 'Diretor', 'Master'].includes(usuarioLogado.cargo);
        
        if (p.status === 'Pendente' && isAdminLog) { 
            acaoHtml = `<div style="display:flex; flex-direction:column; gap:5px;"><button onclick="abrirModalDespacho(${p.id})" style="background:#3b82f6; color:#fff; padding:6px 12px; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Despachar</button><button onclick="abrirModalReprovar(${p.id})" style="background:transparent; color:#ff4d4d; border: 1px solid #ff4d4d; padding:4px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Reprovar</button></div>`; 
        } 
        else if (p.status === 'Enviado') { 
            acaoHtml = `<span style="font-weight:bold; color:#3b82f6;">Enviado</span>`; 
            if (usuarioLogado.cargo === 'Supervisor') acaoHtml = `<button onclick="abrirModalRecebimento(${p.id})" style="background:#10b981; color:#fff; padding:6px 12px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; width:100%;">Recebido <i data-lucide="camera" class="lucide-sm"></i></button>`; 
        } 
        else if (p.status === 'Entregue') { 
            acaoHtml = `<span style="font-weight:bold; color:#10b981;"><i data-lucide="check-circle" class="lucide-sm"></i> Entregue</span>`; 
            if (usuarioLogado.cargo === 'Supervisor') acaoHtml += `<br><button onclick="abrirModalSolicitarReversa(${p.id})" style="background:transparent; border:1px solid #a855f7; color:#a855f7; padding:4px 8px; border-radius:6px; font-size:11px; margin-top:5px; cursor:pointer; font-weight:bold;"><i data-lucide="rotate-ccw" class="lucide-sm"></i> Devolver Item</button>`;
        }
        else if (p.status === 'Aguardando Reversa') {
            acaoHtml = `<span style="font-weight:bold; color:#a855f7;"><i data-lucide="rotate-ccw" class="lucide-sm"></i> Aguardando Reversa</span>`;
            if (isAdminLog) acaoHtml += `<br><button onclick="abrirModalConfirmarReversa(${p.id})" style="background:#a855f7; color:#fff; padding:6px 12px; border:none; border-radius:6px; margin-top:5px; cursor:pointer; font-weight:bold; font-size:12px;">Confirmar Retorno</button>`;
        }
        else if (p.status === 'Reversa Concluída') {
            acaoHtml = `<span style="font-weight:bold; color:#10b981;"><i data-lucide="check-circle" class="lucide-sm"></i> Reversa Concluída</span>`;
        }
        else if (p.status === 'Reprovado') {
            acaoHtml = `<span style="font-weight:bold; color:#ff4d4d;"><i data-lucide="x-circle" class="lucide-sm"></i> Reprovado</span>`;
        }

        tbody.innerHTML += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);"><td style="padding: 15px; vertical-align: top;">${nomeEDono}</td><td style="padding: 15px; vertical-align: top;">${dataF}${infoExtra}</td><td style="padding: 15px; vertical-align: top;">${btnLista}</td><td style="padding: 15px; vertical-align: top;">${acaoHtml}</td></tr>`;
    }); 
    lucide.createIcons(); paginaAtualPedidos++; carregandoPedidos = false;
}

function abrirModalVerPedido(id) {
    const p = memoriaPedidos.find(x => x.id === id); if (!p) return;
    
    const dataF = new Date(p.created_at).toLocaleDateString('pt-BR');
    let statusCor = p.status === 'Pendente' ? '#f59e0b' : (p.status === 'Enviado' ? '#3b82f6' : (p.status === 'Entregue' || p.status === 'Reversa Concluída' ? '#10b981' : (p.status === 'Reprovado' ? '#ff4d4d' : '#a855f7')));
    let tagStatus = `<span style="background: ${statusCor}22; color: ${statusCor}; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; border: 1px solid ${statusCor}55;">${p.status}</span>`;

    let detalhesLimpos = p.detalhes.split('||_REV_')[0];
    let reversaJson = p.detalhes.includes('||_REV_') ? JSON.parse(p.detalhes.split('||_REV_')[1]) : null;

    let listaItensRaw = detalhesLimpos.replace('[CONTÉM ITEM SEM ESTOQUE]', '').replace('[ATENDIMENTO PARCIAL]', '').trim();
    if(listaItensRaw.startsWith(',')) listaItensRaw = listaItensRaw.substring(1).trim();
    
    let listaHtml = `<ul style="list-style: none; padding: 0; margin-bottom: 15px;">`;
    listaItensRaw.split(',').forEach(item => { 
        let str = item.trim(); let partes = str.split('- Var:');
        if(partes.length > 1) {
            listaHtml += `<li style="background: rgba(255,255,255,0.05); padding: 10px 12px; margin-bottom: 6px; border-radius: 6px; border-left: 3px solid var(--primary); display: flex; flex-direction: column;"><strong style="color:#fff; font-size: 14px;">${partes[0].trim()}</strong><span style="color:var(--cor-secundaria); font-size: 12px; margin-top: 4px;"><i data-lucide="corner-down-right" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>Variação: <span style="color:var(--primary); font-weight:bold;">${partes[1].trim()}</span></span></li>`;
        } else { listaHtml += `<li style="background: rgba(255,255,255,0.05); padding: 10px 12px; margin-bottom: 6px; border-radius: 6px; border-left: 3px solid var(--primary);"><strong style="color:#fff; font-size: 14px;">${str}</strong></li>`; }
    }); listaHtml += `</ul>`;

    let reversaHtml = '';
    if (reversaJson) {
        reversaHtml += `<div style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); padding: 15px; border-radius: 8px; margin-bottom: 15px;"><p style="margin: 0 0 10px 0; color: #a855f7; font-size: 12px; font-weight: bold;"><i data-lucide="rotate-ccw" class="lucide-sm" style="display:inline-block; vertical-align:middle; margin-right:4px;"></i> LOGÍSTICA REVERSA SOLICITADA</p><ul style="list-style: none; padding: 0; margin: 0;">`;
        reversaJson.itens.forEach(rev => {
            let partesRev = rev.nome.split('- Var:'); let nomeLimpoRev = partesRev.length > 1 ? `${partesRev[0]} <span style="color:var(--primary); font-size: 11px;">(${partesRev[1].trim()})</span>` : rev.nome;
            reversaHtml += `<li style="font-size: 13px; color: #fff; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px;"><strong>${rev.qtd}x ${nomeLimpoRev}</strong> <br><span style="color:var(--cor-secundaria); font-size: 11px;">Motivo: ${rev.motivo}</span></li>`;
        }); reversaHtml += `</ul></div>`;
    }
    
    const end = p.lojas; 
    let endHtml = end ? `${end.rua || 'S/N'}<br><span style="color:var(--cor-secundaria); font-size: 12px;">${end.bairro || ''} • ${end.cidade || ''}/${end.estado || ''} • CEP: ${end.cep || ''}</span>` : 'Endereço não cadastrado';
    
    let contatoStr = end && end.promotor_contato ? end.promotor_contato.trim() : 'S/N';
    contatoStr = contatoStr.replace(/\(+|\[+/g, '(').replace(/\)+|\]+/g, ')'); 
    if (contatoStr !== 'S/N' && !contatoStr.startsWith('(')) contatoStr = `(${contatoStr})`;
    let prom = end ? `${end.promotor_nome || 'Não informado'} <span style="color:var(--primary); font-size: 11px; margin-left: 4px;">${contatoStr}</span>` : '';
    
    let galeriaHtml = '';
    if (p.foto_url) { galeriaHtml += `<p style="margin: 15px 0 5px 0; color: var(--primary); font-size: 12px; font-weight: bold;">FOTOS DA BANCADA</p><div class="galeria-fotos">`; p.foto_url.split(',').forEach(url => { galeriaHtml += `<div class="img-zoom-wrapper" onclick="abrirLightbox('${url.trim()}')"><img src="${consertarLinkGoogleDrive(url.trim())}" loading="lazy"></div>`; }); galeriaHtml += `</div>`; }
    if (p.foto_recebimento_url) { galeriaHtml += `<p style="margin: 15px 0 5px 0; color: #10b981; font-size: 12px; font-weight: bold;">FOTO DA ENTREGA</p><div class="galeria-fotos">`; p.foto_recebimento_url.split(',').forEach(url => { galeriaHtml += `<div class="img-zoom-wrapper" onclick="abrirLightbox('${url.trim()}')"><img src="${consertarLinkGoogleDrive(url.trim())}" loading="lazy" style="border-color: #10b981;"></div>`; }); galeriaHtml += `</div>`; }
    if (reversaJson && reversaJson.foto_url) { galeriaHtml += `<p style="margin: 15px 0 5px 0; color: #a855f7; font-size: 12px; font-weight: bold;">FOTO DA DEVOLUÇÃO</p><div class="galeria-fotos">`; galeriaHtml += `<div class="img-zoom-wrapper" onclick="abrirLightbox('${reversaJson.foto_url}')"><img src="${consertarLinkGoogleDrive(reversaJson.foto_url)}" loading="lazy" style="border-color: #a855f7;"></div></div>`; }
    
    document.getElementById('picking-list-conteudo').innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
            <div><p style="margin: 0; color: var(--cor-secundaria); font-size: 12px;">Romaneio de Solicitação</p><h2 style="margin: 5px 0 0 0; color: #fff; font-size: 20px;">Pedido #${p.id}</h2><p style="margin: 2px 0 0 0; color: var(--cor-secundaria); font-size: 12px;"><i data-lucide="calendar" class="lucide-sm" style="display:inline-block; vertical-align:middle; width:12px;"></i> ${dataF}</p></div><div>${tagStatus}</div>
        </div>
        <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: var(--primary); font-size: 11px; font-weight: bold; text-transform: uppercase;">Destino / Loja</p><h4 style="color: #fff; margin: 5px 0 2px 0; font-size: 15px;">${end ? end.nome : 'Excluída'}</h4><p style="margin: 0; font-size: 13px; line-height: 1.5;">${endHtml}</p>
            <p style="margin: 10px 0 0 0; font-size: 13px; color: var(--cor-secundaria); border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 10px;"><i data-lucide="user" class="lucide-sm" style="display:inline-block; vertical-align:middle; width:14px; margin-right: 4px;"></i> Promotor: ${prom}</p>
        </div>
        <div style="margin-bottom: 15px;"><p style="margin: 0 0 10px 0; color: var(--primary); font-size: 12px; font-weight: bold;">LISTA DE SEPARAÇÃO</p>${listaHtml}</div>${reversaHtml}${galeriaHtml}
    `;
    
    const btnEtiqueta = document.getElementById('btn-imprimir-etiqueta');
    if (btnEtiqueta) {
        if (usuarioLogado.cargo === 'Logistica' || usuarioLogado.cargo === 'Diretor' || usuarioLogado.cargo === 'Master') {
            btnEtiqueta.style.display = 'inline-block';
            btnEtiqueta.onclick = () => prepararImpressaoEtiqueta(p);
        } else { btnEtiqueta.style.display = 'none'; }
    }
    
    document.getElementById('modal-ver-pedido').style.display = 'flex'; lucide.createIcons();
}

function imprimirRomaneio() {
    document.body.classList.remove('modo-etiqueta');
    document.body.classList.add('modo-romaneio');
    window.print();
    document.body.classList.remove('modo-romaneio');
}

function prepararImpressaoEtiqueta(pedido) {
    const end = pedido.lojas;
    document.getElementById('etiqueta-loja').innerText = end ? end.nome : 'Loja Desconhecida';
    document.getElementById('etiqueta-endereco').innerText = end ? `${end.rua}, ${end.bairro} - ${end.cidade}/${end.estado}` : 'Endereço não cadastrado';
    document.getElementById('etiqueta-cep').innerText = end ? `CEP: ${end.cep}` : 'CEP: N/A';
    document.getElementById('etiqueta-contato').innerText = end ? `Contato: ${end.promotor_nome} (${end.promotor_contato})` : '';
    document.getElementById('etiqueta-rastreio').innerText = pedido.codigo_rastreio ? `Rastreio: ${pedido.codigo_rastreio}` : '';
    document.getElementById('etiqueta-pedido-id').innerText = `Ref: Pedido #${pedido.id} | Criado em ${new Date(pedido.created_at).toLocaleDateString('pt-BR')}`;
    
    document.body.classList.remove('modo-romaneio');
    document.body.classList.add('modo-etiqueta');
    window.print();
    document.body.classList.remove('modo-etiqueta');
}

function abrirModalDespacho(id) {
    document.getElementById('id-pedido-despacho').value = id; document.getElementById('input-rastreio').value = '';
    const pedido = memoriaPedidos.find(p => p.id === id); if (!pedido) return;

    let itensRaw = pedido.detalhes.split('||_REV_')[0].replace('[CONTÉM ITEM SEM ESTOQUE]', '').replace('[ATENDIMENTO PARCIAL]', '').trim();
    if(itensRaw.startsWith(',')) itensRaw = itensRaw.substring(1).trim();

    const listaContainer = document.getElementById('lista-conferencia'); listaContainer.innerHTML = '';

    itensRaw.split(',').forEach((itemStr, index) => {
        itemStr = itemStr.trim(); if (!itemStr) return;
        const match = itemStr.match(/^(\d+)x\s+(.+)$/);
        if (match) {
            const qtdPedida = parseInt(match[1]); const nomeItem = match[2];
            listaContainer.innerHTML += `<div class="linha-conferencia"><span style="flex: 2;"><strong>${nomeItem}</strong><br><small style="color: var(--cor-secundaria);">Pedido: ${qtdPedida} un.</small></span><div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 11px; color: var(--cor-secundaria); flex: none;">Enviando:</span><input type="number" class="input-conferencia" id="conf-qtd-${index}" value="${qtdPedida}" min="0" max="${qtdPedida}" data-nome="${nomeItem}" data-original="${qtdPedida}"></div></div>`;
        } else { listaContainer.innerHTML += `<div class="linha-conferencia"><span style="flex: 2;"><strong>${itemStr}</strong></span></div>`; }
    });
    document.getElementById('modal-despacho').style.display = 'flex'; lucide.createIcons();
}

async function confirmarDespacho() {
    const id = document.getElementById('id-pedido-despacho').value; const rastreio = document.getElementById('input-rastreio').value.trim(); const pedidoOriginal = memoriaPedidos.find(p => p.id == id);
    if (!pedidoOriginal) return;
    setCarregamento('btn-confirma-despacho', true, 'Aferindo Estoque...');
    try {
        let houveRuptura = false; let novoDetalhes = []; const inputs = document.querySelectorAll('.input-conferencia');
        const promessasBD = [];
        for (let input of inputs) {
            const nomeItem = input.getAttribute('data-nome'); const qtdOriginal = parseInt(input.getAttribute('data-original')); const qtdEnviada = parseInt(input.value) || 0;
            if (qtdEnviada < qtdOriginal) {
                houveRuptura = true; const diferenca = qtdOriginal - qtdEnviada;
                const { data: catData } = await supabaseClient.from('catalogo').select('id, quantidade').eq('nome', nomeItem).single();
                if (catData) {
                    const novoEstoque = catData.quantidade + diferenca;
                    promessasBD.push(supabaseClient.from('catalogo').update({ quantidade: novoEstoque }).eq('id', catData.id));
                    try { promessasBD.push(supabaseClient.from('logs_estoque').insert([{ material: nomeItem, quantidade_movimentada: diferenca, responsavel: usuarioLogado.nome, motivo: 'Estorno: Ruptura no Despacho' }])); } catch(e){}
                }
                if (qtdEnviada === 0) { novoDetalhes.push(`0x ${nomeItem} (Ruptura Total)`); } else { novoDetalhes.push(`${qtdEnviada}x ${nomeItem} (Pediu ${qtdOriginal})`); }
            } else { novoDetalhes.push(`${qtdOriginal}x ${nomeItem}`); }
        }
        let stringFinal = novoDetalhes.join(', ');
        if (houveRuptura) { stringFinal = '[ATENDIMENTO PARCIAL] ' + stringFinal; } else if (pedidoOriginal.detalhes.includes('[CONTÉM ITEM SEM ESTOQUE]')) { stringFinal = '[CONTÉM ITEM SEM ESTOQUE] ' + stringFinal; }

        promessasBD.push(supabaseClient.from('pedidos').update({ status: 'Enviado', codigo_rastreio: rastreio, detalhes: stringFinal }).eq('id', id));
        await Promise.allSettled(promessasBD);
        mostrarAviso('Conferência e Despacho realizados!', 'sucesso'); document.getElementById('modal-despacho').style.display = 'none'; carregarPedidos(true); carregarCatalogoPedido(); carregarVitrineAdmin(); 
    } catch (e) { mostrarAviso('Erro ao registrar conferência.', 'erro'); console.error(e); } finally { setCarregamento('btn-confirma-despacho', false); }
}

function abrirModalRecebimento(id) { document.getElementById('id-pedido-recebimento').value = id; document.getElementById('input-foto-recebimento').value = ''; document.getElementById('nome-arquivo-recebimento').innerText = 'Tirar foto dos produtos'; document.getElementById('modal-recebimento').style.display = 'flex'; }
async function salvarRecebimento() {
    const id = document.getElementById('id-pedido-recebimento').value; const f = document.getElementById('input-foto-recebimento');
    if (f.files.length === 0) return mostrarAviso('A foto é obrigatória!', 'erro');
    setCarregamento('btn-confirma-recebimento', true, 'Confirmando...');
    try { 
        let url = null; try { url = await fazerUploadDrive(f.files[0], 'entrega'); } catch (errDrive) { mostrarAviso('Erro no upload da foto. Confirmando entrega sem imagem.', 'erro'); }
        await supabaseClient.from('pedidos').update({ status: 'Entregue', foto_recebimento_url: url }).eq('id', id); mostrarAviso('Confirmada!', 'sucesso'); document.getElementById('modal-recebimento').style.display = 'none'; carregarPedidos(true); 
    } catch (e) { mostrarAviso('Erro no recebimento.', 'erro'); } finally { setCarregamento('btn-confirma-recebimento', false); }
}

function abrirModalReprovar(id) { document.getElementById('id-pedido-reprovar').value = id; document.getElementById('modal-reprovar').style.display = 'flex'; }
async function confirmarReprovacao() {
    const id = document.getElementById('id-pedido-reprovar').value; setCarregamento('btn-confirma-reprovacao', true, 'Reprovando...');
    try { await supabaseClient.from('pedidos').update({ status: 'Reprovado' }).eq('id', id); mostrarAviso('Reprovado.', 'sucesso'); document.getElementById('modal-reprovar').style.display = 'none'; carregarPedidos(true); } 
    catch (e) { mostrarAviso('Erro ao reprovar.', 'erro'); } finally { setCarregamento('btn-confirma-reprovacao', false); }
}

function abrirModalSolicitarReversa(id) {
    document.getElementById('id-pedido-reversa').value = id;
    
    document.getElementById('motivo-reversa').value = 'Material com Defeito';
    document.getElementById('motivo-selecionado-texto').innerText = 'Material com Defeito';
    const opcoesMotivo = document.querySelectorAll('#custom-options-motivo .custom-option');
    opcoesMotivo.forEach(opt => opt.classList.remove('selecionado'));
    if(opcoesMotivo.length > 0) opcoesMotivo[0].classList.add('selecionado');
    
    document.getElementById('input-foto-reversa').value = ''; document.getElementById('nome-arquivo-reversa').innerText = 'Anexar foto da reversa';
    
    const pedido = memoriaPedidos.find(p => p.id === id); if (!pedido) return;
    const listaContainer = document.getElementById('lista-reversa-req'); listaContainer.innerHTML = '';
    let detalhesLimpos = pedido.detalhes.split('||_REV_')[0].replace('[CONTÉM ITEM SEM ESTOQUE]', '').replace('[ATENDIMENTO PARCIAL]', '').trim();
    if(detalhesLimpos.startsWith(',')) detalhesLimpos = detalhesLimpos.substring(1).trim();

    detalhesLimpos.split(',').forEach((itemStr, index) => {
        itemStr = itemStr.trim();
        const match = itemStr.match(/^(\d+)x\s+(.+?)(?:\s+\(Pediu \d+\)|\s+\(Ruptura Total\))?$/);
        if (match) {
            const qtdEnviada = parseInt(match[1]); const nomeItem = match[2].trim();
            if (qtdEnviada > 0) {
                listaContainer.innerHTML += `<div class="linha-conferencia"><span style="flex: 2; color: #a855f7;"><strong>${nomeItem}</strong><br><small style="color: var(--cor-secundaria);">Entregue: ${qtdEnviada} un.</small></span><div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 11px; color: var(--cor-secundaria); flex: none;">Devolver:</span><input type="number" class="input-conferencia" id="rev-qtd-${index}" value="0" min="0" max="${qtdEnviada}" data-nome="${nomeItem}" style="border-color:#a855f7;"></div></div>`;
            }
        }
    });
    document.getElementById('modal-solicitar-reversa').style.display = 'flex'; lucide.createIcons();
}

async function salvarSolicitacaoReversa() {
    const id = document.getElementById('id-pedido-reversa').value; const motivo = document.getElementById('motivo-reversa').value; const pedidoOriginal = memoriaPedidos.find(p => p.id == id); if (!pedidoOriginal) return;

    let itensDevolvidos = []; const inputs = document.querySelectorAll('#lista-reversa-req .input-conferencia');
    for (let input of inputs) { const nomeItem = input.getAttribute('data-nome'); const qtdDevolvida = parseInt(input.value) || 0; if (qtdDevolvida > 0) { itensDevolvidos.push({ nome: nomeItem, qtd: qtdDevolvida, motivo: motivo }); } }
    if (itensDevolvidos.length === 0) return mostrarAviso('Aponte pelo menos 1 item para devolução.', 'erro');

    setCarregamento('btn-enviar-reversa', true, 'Solicitando...');
    try {
        let fotoUrl = null; const f = document.getElementById('input-foto-reversa');
        if (f.files.length > 0) { try { fotoUrl = await fazerUploadDrive(f.files[0], 'reversa'); } catch(e) { console.error(e); } }
        const payloadReversa = { itens: itensDevolvidos, foto_url: fotoUrl };
        const detalhesAtualizados = pedidoOriginal.detalhes.split('||_REV_')[0] + ' ||_REV_' + JSON.stringify(payloadReversa);
        await supabaseClient.from('pedidos').update({ status: 'Aguardando Reversa', detalhes: detalhesAtualizados }).eq('id', id);
        mostrarAviso('Logística Reversa Solicitada!', 'sucesso'); document.getElementById('modal-solicitar-reversa').style.display = 'none'; carregarPedidos(true);
    } catch (e) { mostrarAviso('Erro ao solicitar reversa.', 'erro'); console.error(e); } finally { setCarregamento('btn-enviar-reversa', false); }
}

function abrirModalConfirmarReversa(id) {
    document.getElementById('id-confirmar-reversa').value = id; const pedido = memoriaPedidos.find(p => p.id === id); if (!pedido) return;
    if (!pedido.detalhes.includes('||_REV_')) return mostrarAviso('Dados da reversa não encontrados.', 'erro');
    const revData = JSON.parse(pedido.detalhes.split('||_REV_')[1]); const listaContainer = document.getElementById('conteudo-confirmar-reversa'); listaContainer.innerHTML = '';
    revData.itens.forEach(item => { listaContainer.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px;"><span style="color:#fff;">${item.qtd}x <strong>${item.nome}</strong></span><span style="color:var(--cor-secundaria); font-size:12px;">${item.motivo}</span></div>`; });
    document.getElementById('modal-confirmar-reversa').style.display = 'flex'; lucide.createIcons();
}

async function confirmarReversaLogistica() {
    const id = document.getElementById('id-confirmar-reversa').value; const pedido = memoriaPedidos.find(p => p.id == id); if (!pedido) return;
    setCarregamento('btn-finalizar-reversa', true, 'Estornando...');
    try {
        const revData = JSON.parse(pedido.detalhes.split('||_REV_')[1]); const promessasBD = [];
        for (let item of revData.itens) {
            const { data: catData } = await supabaseClient.from('catalogo').select('id, quantidade').eq('nome', item.nome).single();
            if (catData) {
                const novoEstoque = catData.quantidade + item.qtd;
                promessasBD.push(supabaseClient.from('catalogo').update({ quantidade: novoEstoque }).eq('id', catData.id));
                try { promessasBD.push(supabaseClient.from('logs_estoque').insert([{ material: item.nome, quantidade_movimentada: item.qtd, responsavel: usuarioLogado.nome, motivo: `Logística Reversa: ${item.motivo}` }])); } catch(e){}
            }
        }
        promessasBD.push(supabaseClient.from('pedidos').update({ status: 'Reversa Concluída' }).eq('id', id)); await Promise.allSettled(promessasBD);
        mostrarAviso('Estoque estornado com sucesso!', 'sucesso'); document.getElementById('modal-confirmar-reversa').style.display = 'none'; carregarPedidos(true); carregarCatalogoPedido(); carregarVitrineAdmin();
    } catch (e) { mostrarAviso('Erro ao processar reversa.', 'erro'); console.error(e); } finally { setCarregamento('btn-finalizar-reversa', false); }
}

// ==========================================
// 8. ABA DE AUDITORIA E LOGS (REDESENHADA)
// ==========================================
let memoriaAuditoria = [];

async function carregarAuditoria() {
    const container = document.getElementById('lista-auditoria-corpo'); if(!container) return;
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--cor-secundaria);"><i data-lucide="loader" class="spinner" style="width:32px; height:32px;"></i></div>'; lucide.createIcons();
    
    try {
        const { data, error } = await supabaseClient.from('logs_estoque').select('*').order('created_at', { ascending: false }).limit(200);
        if (error) throw error;
        memoriaAuditoria = data || [];
        renderizarAuditoria();
    } catch(e) {
        container.innerHTML = `<div class="empty-state" style="color:#ff4d4d;"><i data-lucide="alert-triangle"></i><p>Erro ao carregar auditoria.</p></div>`; lucide.createIcons();
    }
}

function renderizarAuditoria() {
    const container = document.getElementById('lista-auditoria-corpo');
    const termoBusca = document.getElementById('filtro-texto-auditoria').value.toLowerCase();
    const tipoFiltro = document.getElementById('filtro-tipo-auditoria').value;
    
    container.innerHTML = '';
    
    if(memoriaAuditoria.length === 0) {
        container.innerHTML = `<div class="empty-state"><i data-lucide="history"></i><p>Nenhuma movimentação registrada.</p></div>`;
        lucide.createIcons(); return;
    }

    let filtrados = memoriaAuditoria.filter(log => {
        const textoAlvo = `${log.material} ${log.responsavel} ${log.motivo}`.toLowerCase();
        const passaTexto = textoAlvo.includes(termoBusca);
        let passaTipo = true;
        if (tipoFiltro === 'ENTRADA') passaTipo = log.quantidade_movimentada > 0;
        if (tipoFiltro === 'SAIDA') passaTipo = log.quantidade_movimentada < 0;
        return passaTexto && passaTipo;
    });

    if(filtrados.length === 0) {
        container.innerHTML = `<div class="empty-state"><i data-lucide="search-x"></i><p>Nenhum log encontrado para este filtro.</p></div>`;
        lucide.createIcons(); return;
    }

    filtrados.forEach(log => {
        const dateObj = new Date(log.created_at);
        const dataFormatada = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ', ' + dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' });
        const ehEntrada = log.quantidade_movimentada > 0;
        const classeTipo = ehEntrada ? 'entrada' : 'saida';
        const iconeSrc = ehEntrada ? 'arrow-up-right' : 'arrow-down-right';
        const sinal = ehEntrada ? '+' : '';
        
        container.innerHTML += `
        <div class="log-item ${classeTipo}">
            <div class="log-icon"><i data-lucide="${iconeSrc}"></i></div>
            <div class="log-content">
                <div class="log-header"><span class="log-material">${log.material}</span><span class="log-data">${dataFormatada}</span></div>
                <div class="log-footer"><span class="tag-motivo">${log.motivo}</span><span class="log-user"><i data-lucide="user" style="width:12px; height:12px;"></i> ${log.responsavel}</span></div>
            </div>
            <div class="log-qtd">${sinal}${log.quantidade_movimentada}</div>
        </div>`;
    }); 
    lucide.createIcons();
}

// ==========================================
// 9. ABA DE RELATÓRIOS E BI (REDESENHADA)
// ==========================================
async function carregarRelatorios() {
    const ctxLojas = document.getElementById('chartTopLojas'); const ctxStatus = document.getElementById('chartStatus'); const ctxMateriais = document.getElementById('chartTopMateriais');
    if(!ctxLojas || !ctxStatus || !ctxMateriais) return;

    try {
        const { data: pedidos } = await supabaseClient.from('pedidos').select('status, detalhes, lojas(nome)');
        const { count: countLojas } = await supabaseClient.from('lojas').select('*', { count: 'exact', head: true });
        if(!pedidos) return;

        let rupturas = 0;
        pedidos.forEach(p => { if(p.detalhes.includes('ESTOQUE') || p.detalhes.includes('PARCIAL')) rupturas++; });
        document.getElementById('kpi-total-pedidos').innerText = pedidos.length;
        document.getElementById('kpi-lojas-ativas').innerText = countLojas || 0;
        document.getElementById('kpi-rupturas').innerText = rupturas;

        // LÓGICA DE TELA VAZIA (EMPTY STATE)
        const containers = [ctxLojas.parentElement, ctxStatus.parentElement, ctxMateriais.parentElement];
        if (pedidos.length === 0) {
            ctxLojas.style.display = 'none'; ctxStatus.style.display = 'none'; ctxMateriais.style.display = 'none';
            containers.forEach(c => {
                if (!c.querySelector('.grafico-vazio')) {
                    const div = document.createElement('div'); div.className = 'grafico-vazio';
                    div.style.cssText = 'flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--cor-secundaria); opacity:0.5; margin-top:20px;';
                    div.innerHTML = '<i data-lucide="bar-chart-2" style="width:40px;height:40px;margin-bottom:10px;"></i><p style="margin:0;font-size:13px;">Aguardando dados da operação</p>';
                    c.appendChild(div);
                }
            });
            lucide.createIcons();
            return; // Para a função aqui e não tenta desenhar os gráficos
        } else {
            ctxLojas.style.display = 'block'; ctxStatus.style.display = 'block'; ctxMateriais.style.display = 'block';
            containers.forEach(c => { const v = c.querySelector('.grafico-vazio'); if(v) v.remove(); });
        }

        const contagemLojas = {};
        pedidos.forEach(p => { const nome = p.lojas ? p.lojas.nome : 'Loja Excluída'; contagemLojas[nome] = (contagemLojas[nome] || 0) + 1; });
        const lojasOrdenadas = Object.entries(contagemLojas).sort((a, b) => b[1] - a[1]).slice(0, 5);
        
        const contagemStatus = { 'Pendente': 0, 'Enviado': 0, 'Entregue': 0, 'Reprovado': 0, 'Reversa': 0 };
        pedidos.forEach(p => { if(p.status.includes('Reversa')) contagemStatus['Reversa']++; else if(contagemStatus[p.status] !== undefined) contagemStatus[p.status]++; });

        const contagemMateriais = {};
        pedidos.forEach(p => {
            let detalhesLimpos = p.detalhes.split('||_REV_')[0].replace(/\[.*?\]/g, '').trim();
            if(detalhesLimpos.startsWith(',')) detalhesLimpos = detalhesLimpos.substring(1).trim();
            
            detalhesLimpos.split(',').forEach(itemStr => {
                const match = itemStr.trim().match(/^(\d+)x\s+(.+)$/);
                if (match) {
                    let qtd = parseInt(match[1]);
                    let nome = match[2].replace(/\s+\(Pediu \d+\)|\s+\(Ruptura Total\)/g, '').trim();
                    contagemMateriais[nome] = (contagemMateriais[nome] || 0) + qtd;
                }
            });
        });
        const materiaisOrdenados = Object.entries(contagemMateriais).sort((a, b) => b[1] - a[1]).slice(0, 5);

        Chart.defaults.color = '#718096'; Chart.defaults.font.family = "'Inter', sans-serif";

        if(chartLojas) chartLojas.destroy();
        chartLojas = new Chart(ctxLojas, {
            type: 'bar',
            data: { labels: lojasOrdenadas.map(l => l[0].substring(0, 12) + '...'), datasets: [{ label: 'Pedidos', data: lojasOrdenadas.map(l => l[1]), backgroundColor: 'rgba(0, 229, 176, 0.8)', borderRadius: 6, borderSkipped: false }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { color: 'rgba(255,255,255,0.05)', borderDash: [5, 5] }, border: {display: false} }, x: { grid: { display: false }, border: {display: false} } } }
        });

        if(chartStatus) chartStatus.destroy();
        chartStatus = new Chart(ctxStatus, {
            type: 'doughnut',
            data: { labels: Object.keys(contagemStatus), datasets: [{ data: Object.values(contagemStatus), backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ff4d4d', '#a855f7'], borderColor: '#131920', borderWidth: 4, hoverOffset: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, padding: 20 } } } }
        });

        if(chartMateriais) chartMateriais.destroy();
        chartMateriais = new Chart(ctxMateriais, {
            type: 'bar',
            data: { labels: materiaisOrdenados.map(m => m[0].substring(0, 15) + '...'), datasets: [{ label: 'Unidades', data: materiaisOrdenados.map(m => m[1]), backgroundColor: 'rgba(59, 130, 246, 0.8)', borderRadius: 6 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { color: 'rgba(255,255,255,0.05)' }, border: {display: false} }, y: { grid: { display: false }, border: {display: false} } } }
        });

    } catch(e) { console.error("Erro no BI", e); }
}

// ==========================================
// 10. EXPORTAÇÃO EXCEL
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
        
        let stringLimpa = p.detalhes.split('||_REV_')[0].replace('[CONTÉM ITEM SEM ESTOQUE]', '(RUPTURA NA ORIGEM)');
        
        return { "ID do Pedido": p.id, "Data da Solicitação": dataPedido, "Status": p.status, "Destino (Loja)": loja, "Supervisor Responsável": supervisor, "Promotor na Loja": promotor, "Itens Solicitados": stringLimpa, "Rastreio de Envio": p.codigo_rastreio || 'N/A' };
    });

    const worksheet = XLSX.utils.json_to_sheet(dadosExcel); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos Logística");
    worksheet['!cols'] = [{wch: 15}, {wch: 20}, {wch: 15}, {wch: 35}, {wch: 25}, {wch: 25}, {wch: 80}, {wch: 25}];
    const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-'); XLSX.writeFile(workbook, `Relatorio_Logistica_OPPO_${dataHoje}.xlsx`);
}