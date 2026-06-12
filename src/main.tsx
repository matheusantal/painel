import React, { FormEvent, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient, type User } from '@supabase/supabase-js'
import logoUrl from './assets/darvig-molas.svg'
import './styles.css'

type View = 'dashboard' | 'estoque'
type AuthMode = 'login' | 'reset'
type Notice = { kind: 'success' | 'error'; text: string }
type Cliente = { id: string; nome: string | null; cnpj?: string | null; telefones?: string[] | null; emails?: string[] | null; endereco?: string | null; site?: string | null }
type Pedido = { id: string; numero_os?: string | null; numero_pedido?: string | null; nome_empresa?: string | null; cliente_id?: string | null; status?: string | null; data_pedido?: string | null; created_at?: string | null }
type Estoque = {
  id: string
  categoria: string
  cliente_id?: string | null
  nome_empresa?: string | null
  numero_os?: string | null
  numero_pedido?: string | null
  arquivo_os_url?: string | null
  denominacao?: string | null
  material?: string | null
  quantidade_pecas?: number | null
  peso_lote_kg?: number | null
  peso_disponivel_kg?: number | null
  fornecedor?: string | null
  nota_fiscal_numero?: string | null
  status?: string | null
  observacoes?: string | null
  bitola_mm?: number | null
  classe_especificacao?: string | null
  tipo_material?: string | null
  data_entrada_em?: string | null
  created_at?: string | null
}
type StockForm = {
  categoria: 'Molas' | 'Aramados' | 'Material'
  denominacao: string
  cliente: string
  numeroOs: string
  pedido: string
  material: string
  bitola: string
  peso: string
  quantidade: string
  fornecedor: string
  notaFiscal: string
  classe: string
  observacoes: string
}

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

const emptyForm: StockForm = {
  categoria: 'Molas',
  denominacao: '',
  cliente: '',
  numeroOs: '',
  pedido: '',
  material: '',
  bitola: '',
  peso: '',
  quantidade: '',
  fornecedor: '',
  notaFiscal: '',
  classe: '',
  observacoes: '',
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    setLoading(true)

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` })
      setLoading(false)
      setNotice(error ? { kind: 'error', text: 'Nao foi possivel enviar o link agora.' } : { kind: 'success', text: 'Enviamos o link de redefinicao para o email informado.' })
      return
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error || !data.user) {
      setNotice({ kind: 'error', text: 'Nao foi possivel entrar. Confira seus dados e tente novamente.' })
      return
    }
    setUser(data.user)
    setPassword('')
  }

  if (user) return <Panel user={user} onUserChange={setUser} />

  return (
    <main className="page-shell">
      <section className="login-stage" aria-label="Login">
        <form className="login-panel" onSubmit={submitAuth}>
          <img className="login-logo" src={logoUrl} alt="Darvig Molas" />
          <div className="heading-group">
            <p className="eyebrow">Darvig Molas</p>
            <h1>{mode === 'login' ? 'Entrar' : 'Redefinir senha'}</h1>
            <p>{mode === 'login' ? 'Acesse sua conta com email e senha.' : 'Informe seu email para receber o link.'}</p>
          </div>
          <label className="field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          {mode === 'login' && <label className="field"><span>Senha</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>}
          {notice && <p className={`notice ${notice.kind}`}>{notice.text}</p>}
          <button className="primary-action" disabled={loading}>{loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Enviar link'}</button>
          <button className="text-action" type="button" onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setNotice(null) }}>{mode === 'login' ? 'Esqueci minha senha' : 'Voltar ao login'}</button>
        </form>
      </section>
    </main>
  )
}

function Panel({ user, onUserChange }: { user: User; onUserChange: (user: User | null) => void }) {
  const [view, setView] = useState<View>('dashboard')
  const [items, setItems] = useState<Estoque[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [company, setCompany] = useState<Cliente | null>(null)
  const [quickAdd, setQuickAdd] = useState(false)
  const name = getName(user)

  async function loadData() {
    const [stock, orders, clients] = await Promise.all([
      supabase.from('estoque').select('*').order('created_at', { ascending: false }),
      supabase.from('pedidos').select('*').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nome', { ascending: true }),
    ])
    setItems((stock.data ?? []) as Estoque[])
    setPedidos((orders.data ?? []) as Pedido[])
    setClientes((clients.data ?? []) as Cliente[])
  }

  useEffect(() => { loadData() }, [])

  async function logout() {
    await supabase.auth.signOut()
    onUserChange(null)
  }

  const notifications = useMemo(() => {
    const missingDocs = items.filter((item) => item.numero_os && !item.arquivo_os_url).length
    const open = pedidos.filter((pedido) => normalize(pedido.status).includes('aberto')).length
    return [
      open ? `${open} pedido(s) em aberto` : null,
      missingDocs ? `${missingDocs} OS sem arquivo` : null,
      `${items.length} item(ns) em estoque`,
    ].filter(Boolean) as string[]
  }, [items, pedidos])

  return (
    <main className="app-dashboard">
      <header className="zenith-topbar">
        <div className="top-actions">
          <div className="notification-area">
            <button className="icon-button notification-button" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notificacoes"><Bell />{notifications.length > 0 && <span>{notifications.length}</span>}</button>
            {notificationsOpen && <div className="notifications-popover"><div className="notifications-head"><strong>Notificacoes</strong><span>{notifications.length}</span></div><div className="notifications-list">{notifications.map((item) => <button className="notification-item" key={item} onClick={() => setNotificationsOpen(false)}><span /><strong>{item}</strong></button>)}</div></div>}
          </div>
          <button className="icon-button" aria-label="Configuracoes"><Gear /></button>
          <div className="profile-area">
            <button className="profile-avatar-button" onClick={() => setProfileOpen(!profileOpen)} aria-label="Perfil"><Avatar user={user} /></button>
            {profileOpen && <ProfilePopover user={user} onSaved={onUserChange} />}
          </div>
        </div>
      </header>
      <aside className="zenith-sidebar">
        <button className="workspace-badge" onClick={() => setView('dashboard')}><img src={logoUrl} alt="" /><strong>Darvig Molas</strong></button>
        <nav className="zenith-menu">
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><DashboardIcon /><span>Dashboard</span></button>
          <button className={view === 'estoque' ? 'active' : ''} onClick={() => setView('estoque')}><BoxIcon /><span>Estoque</span></button>
        </nav>
        <div className="sidebar-footer"><button onClick={logout}><LogoutIcon /><span>Log out</span></button></div>
      </aside>
      <section className="zenith-main">
        {view === 'dashboard' ? <Dashboard name={name} pedidos={pedidos} items={items} clientes={clientes} onAdd={() => setQuickAdd(true)} onCompany={setCompany} /> : <StockPage items={items} clientes={clientes} onReload={loadData} onCompany={setCompany} />}
      </section>
      {quickAdd && <StockModal clientes={clientes} onClose={() => setQuickAdd(false)} onSaved={() => { setQuickAdd(false); loadData() }} />}
      {company && <CompanyModal company={company} onClose={() => setCompany(null)} />}
    </main>
  )
}

function Dashboard({ name, pedidos, items, clientes, onAdd, onCompany }: { name: string; pedidos: Pedido[]; items: Estoque[]; clientes: Cliente[]; onAdd: () => void; onCompany: (cliente: Cliente) => void }) {
  const open = pedidos.filter((pedido) => normalize(pedido.status).includes('aberto')).length
  const delivered = pedidos.filter((pedido) => ['entregue', 'finalizado', 'concluido'].some((status) => normalize(pedido.status).includes(status))).length
  const weight = items.reduce((sum, item) => sum + Number(item.peso_disponivel_kg ?? item.peso_lote_kg ?? 0), 0)
  const weekDiff = getWeekDiff(pedidos)
  const levels = items.slice(0, 5).map((item) => ({ item, value: Math.min(100, Math.max(8, Number(item.peso_disponivel_kg ?? item.quantidade_pecas ?? 0))) }))

  return <>
    <section className="hero-card fade-in"><div><h1>Bem-vindo de volta, {name.split(' ')[0] || 'Usuario'}!</h1><p>Seu espaco de trabalho esta conectado ao Supabase com dados reais de pedidos e estoque.</p><div className="hero-actions"><button className="blue-button" onClick={onAdd}>Adicionar item</button><button className="soft-button">Ver Relatorios</button></div></div></section>
    <section className="metric-grid">
      <Metric icon={<InboxIcon />} title="Pedidos Abertos" value={String(open)} detail={`${pedidos.length} pedido(s) cadastrado(s)`} badge={`${weekDiff >= 0 ? '+' : ''}${weekDiff} esta semana`} tone={weekDiff < 0 ? 'red' : 'blue'} />
      <Metric icon={<TruckIcon />} title="Pedidos Entregues" value={String(delivered)} detail="Calculado pelo status dos pedidos" badge="Esta Semana" />
      <Metric icon={<BoxIcon />} title="Estoque" value={`${items.length} item(ns)`} detail={`${format(weight)} kg disponiveis`} badge={items.length ? 'OK' : 'Vazio'} tone={items.length ? 'green' : ''} />
    </section>
    <section className="dashboard-grid">
      <article className="stock-card"><div className="card-title-row"><div><h3>Niveis de Estoque</h3><p>Distribuicao de materiais principais</p></div><AnalyticsIcon /></div><div className="stock-list">{levels.length === 0 && <p className="muted">Nenhum item cadastrado.</p>}{levels.map(({ item, value }) => <div className="stock-row" key={item.id}><div><span>{item.denominacao || item.material || item.categoria}</span><strong>{Math.round(value)}%</strong></div><div className="progress-track"><span style={{ width: `${Math.round(value)}%` }} /></div><small>{format(Number(item.peso_disponivel_kg ?? item.peso_lote_kg ?? 0))} kg</small></div>)}</div></article>
      <article className="orders-card"><div className="card-title-row"><h3>Ultimos Pedidos</h3></div><table className="orders-table"><tbody>{pedidos.slice(0, 5).map((pedido) => <tr key={pedido.id}><td><strong>{pedido.numero_pedido || `OS ${pedido.numero_os || '-'}`}</strong><small>{renderCompany(pedido.nome_empresa, pedido.cliente_id, clientes, onCompany)}</small></td><td><span className={`status-pill ${statusClass(pedido.status)}`}>{pedido.status || 'Sem status'}</span></td></tr>)}</tbody></table></article>
    </section>
  </>
}

function StockPage({ items, clientes, onReload, onCompany }: { items: Estoque[]; clientes: Cliente[]; onReload: () => void; onCompany: (cliente: Cliente) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [editing, setEditing] = useState<Estoque | null>(null)
  const [details, setDetails] = useState<Estoque | null>(null)
  const [quantity, setQuantity] = useState<Estoque | null>(null)
  const list = items.filter((item) => (filter === 'Todos' || item.categoria === filter) && normalize([item.categoria, item.nome_empresa, item.numero_os, item.material, item.denominacao, item.fornecedor, item.nota_fiscal_numero].join(' ')).includes(normalize(query)))

  async function remove(item: Estoque) {
    if (!window.confirm('Confirmar exclusao deste item?')) return
    const { error } = await supabase.from('estoque').delete().eq('id', item.id)
    if (error) window.alert('Nao foi possivel excluir. Verifique se ha pedidos vinculados.')
    await onReload()
  }

  return <section className="inventory-page">
    <div className="inventory-head"><div><h1>Estoque</h1><p>Cadastre, edite e acompanhe Molas, Aramados e Material.</p></div><BoxIcon /></div>
    <StockModal clientes={clientes} onSaved={onReload} />
    <article className="inventory-browser"><div className="inventory-toolbar"><label className="search-field"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por cliente, OS, material, fornecedor ou NF" /></label><div className="category-filter">{['Todos', 'Molas', 'Aramados', 'Material'].map((name) => <button className={filter === name ? 'active' : ''} onClick={() => setFilter(name)} key={name}>{name}</button>)}</div></div><div className="inventory-grid">{list.map((item) => <article className="inventory-card" key={item.id}><div className="inventory-card-top"><span className="category-pill">{item.categoria}</span><button className="icon-button small" onClick={() => setDetails(item)}><InfoIcon /></button></div><div className="inventory-card-body"><h3>{item.denominacao || item.material || item.tipo_material || 'Item de estoque'}</h3><dl><div><dt>{item.categoria === 'Material' ? 'Fornecedor' : 'Cliente'}</dt><dd>{renderCompany(item.nome_empresa || item.fornecedor, item.cliente_id, clientes, onCompany)}</dd></div><div><dt>{item.categoria === 'Material' ? 'NF' : 'OS'}</dt><dd>{item.nota_fiscal_numero || item.numero_os || '-'}</dd></div><div><dt>Material</dt><dd>{item.material || item.tipo_material || '-'}</dd></div><div><dt>Quantidade</dt><dd>{item.categoria === 'Material' ? `${format(Number(item.peso_disponivel_kg ?? 0))} kg` : `${item.quantidade_pecas ?? 0} pcs`}</dd></div></dl></div><div className="modal-actions"><button className="secondary-action" onClick={() => setEditing(item)}>Editar</button><button className="secondary-action" onClick={() => setQuantity(item)}>Qtd</button><button className="danger-action" onClick={() => remove(item)}>Excluir</button></div></article>)}{list.length === 0 && <div className="empty-state"><BoxIcon /><strong>Nenhum item encontrado</strong><p>Ajuste os filtros ou cadastre um novo item.</p></div>}</div></article>
    {editing && <StockModal item={editing} clientes={clientes} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onReload() }} />}
    {details && <DetailsModal item={details} onClose={() => setDetails(null)} />}
    {quantity && <QuantityModal item={quantity} onClose={() => setQuantity(null)} onSaved={() => { setQuantity(null); onReload() }} />}
  </section>
}

function StockModal({ item, clientes, onClose, onSaved }: { item?: Estoque; clientes: Cliente[]; onClose?: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<StockForm>(() => item ? formFromItem(item) : emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const isMaterial = form.categoria === 'Material'

  function change(key: keyof StockForm, value: string) {
    setForm((current) => ({ ...current, [key]: key === 'numeroOs' ? maskOs(value) : value }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    let clienteId = item?.cliente_id ?? null
    let clienteName = form.cliente.trim()
    if (!isMaterial && clienteName) {
      let cliente = clientes.find((row) => normalize(row.nome) === normalize(clienteName))
      if (!cliente) {
        const created = await supabase.from('clientes').insert({ nome: clienteName }).select('id,nome').single()
        cliente = created.data as Cliente | null
      }
      clienteId = cliente?.id ?? null
      clienteName = cliente?.nome || clienteName
    }
    let arquivoUrl = item?.arquivo_os_url ?? null
    if (!isMaterial && file) {
      const path = `${form.numeroOs.replace('/', '-')}-${Date.now()}-${file.name}`
      const upload = await supabase.storage.from('documentos-os').upload(path, file, { upsert: true, contentType: file.type })
      if (!upload.error) arquivoUrl = supabase.storage.from('documentos-os').getPublicUrl(path).data.publicUrl
    }
    const payload = {
      categoria: form.categoria,
      cliente_id: isMaterial ? null : clienteId,
      nome_empresa: isMaterial ? null : clienteName,
      numero_os: isMaterial ? null : form.numeroOs,
      numero_pedido: isMaterial ? null : form.pedido || null,
      arquivo_os_url: isMaterial ? null : arquivoUrl,
      denominacao: form.denominacao || null,
      material: isMaterial ? form.tipoMaterial || form.material : form.material,
      tipo_material: isMaterial ? form.material : null,
      fornecedor: isMaterial ? form.fornecedor || null : null,
      nota_fiscal_numero: isMaterial ? form.notaFiscal || null : null,
      classe_especificacao: form.classe || null,
      bitola_mm: parseNumber(form.bitola),
      peso_lote_kg: parseNumber(form.peso),
      peso_disponivel_kg: isMaterial ? parseNumber(form.peso) : parseNumber(form.peso),
      quantidade_pecas: isMaterial ? null : Math.max(0, Number.parseInt(form.quantidade || '0', 10)),
      data_entrada: new Date().toISOString(),
      data_entrada_em: new Date().toISOString(),
      status: 'Em Estoque',
      observacoes: form.observacoes || null,
    }
    const result = item ? await supabase.from('estoque').update(payload).eq('id', item.id) : await supabase.from('estoque').insert(payload).select('id').single()
    if (!result.error && !item) await supabase.from('estoque_historico').insert({ estoque_id: (result.data as { id?: string } | null)?.id, tipo: 'entrada', quantidade: payload.quantidade_pecas, peso_kg: payload.peso_disponivel_kg, observacao: 'Entrada inicial' })
    setSaving(false)
    if (result.error) window.alert('Nao foi possivel salvar o item.')
    else { setForm(emptyForm); onSaved() }
  }

  const content = <form className="inventory-form" onSubmit={save}><div className="inventory-form-head"><div><h2>{item ? 'Editar item' : 'Criar item'}</h2><p>Dados salvos no Supabase.</p></div>{onClose && <button className="icon-button small" type="button" onClick={onClose}><CloseIcon /></button>}</div><div className="form-grid"><label className="field compact"><span>Categoria</span><select value={form.categoria} onChange={(event) => change('categoria', event.target.value)}><option>Molas</option><option>Aramados</option><option>Material</option></select></label><label className="field compact"><span>Denominacao</span><input value={form.denominacao} onChange={(event) => change('denominacao', event.target.value)} /></label>{!isMaterial && <><label className="field compact"><span>Cliente</span><input list="clientes" value={form.cliente} onChange={(event) => change('cliente', event.target.value)} required /></label><label className="field compact"><span>OS</span><input value={form.numeroOs} onChange={(event) => change('numeroOs', event.target.value)} placeholder="00/00" required /></label><label className="field compact"><span>Pedido</span><input value={form.pedido} onChange={(event) => change('pedido', event.target.value)} /></label></>}{isMaterial && <><label className="field compact"><span>Fornecedor</span><input value={form.fornecedor} onChange={(event) => change('fornecedor', event.target.value)} required /></label><label className="field compact"><span>Nota fiscal No</span><input value={form.notaFiscal} onChange={(event) => change('notaFiscal', event.target.value)} /></label></>}<label className="field compact"><span>Material</span><input value={form.material} onChange={(event) => change('material', event.target.value)} required /></label><label className="field compact"><span>Bitola mm</span><input value={form.bitola} onChange={(event) => change('bitola', event.target.value)} placeholder="1,20" /></label><label className="field compact"><span>{isMaterial ? 'Peso total kg' : 'Peso kg'}</span><input value={form.peso} onChange={(event) => change('peso', event.target.value)} /></label>{!isMaterial && <label className="field compact"><span>Quantidade</span><input value={form.quantidade} onChange={(event) => change('quantidade', event.target.value.replace(/\D/g, ''))} /></label>}<label className="field compact"><span>Classe/especificacao</span><input value={form.classe} onChange={(event) => change('classe', event.target.value)} /></label>{!isMaterial && <label className="field compact"><span>Arquivo da OS</span><input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>}</div><label className="field"><span>Observacoes</span><textarea value={form.observacoes} onChange={(event) => change('observacoes', event.target.value)} /></label><button className="primary-action" disabled={saving}>{saving ? 'Salvando...' : item ? 'Salvar alteracoes' : 'Cadastrar item'}</button><datalist id="clientes">{clientes.map((cliente) => <option value={cliente.nome || ''} key={cliente.id} />)}</datalist></form>
  if (onClose) return <div className="modal-backdrop"><div className="inventory-modal">{content}</div></div>
  return content
}

function ProfilePopover({ user, onSaved }: { user: User; onSaved: (user: User | null) => void }) {
  const [fullName, setFullName] = useState(getName(user))
  const [username, setUsername] = useState(String(user.user_metadata?.username ?? ''))
  const [avatar, setAvatar] = useState(String(user.user_metadata?.avatar_url ?? ''))
  const [notice, setNotice] = useState<Notice | null>(null)
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const { data, error } = await supabase.auth.updateUser({ data: { full_name: fullName, name: fullName, username, avatar_url: avatar } }); setNotice(error ? { kind: 'error', text: 'Nao foi possivel salvar.' } : { kind: 'success', text: 'Perfil atualizado.' }); if (data.user) onSaved(data.user) }
  async function reset() { await supabase.auth.resetPasswordForEmail(user.email || '', { redirectTo: `${window.location.origin}/` }); setNotice({ kind: 'success', text: 'Email de redefinicao enviado.' }) }
  return <div className="profile-popover"><form onSubmit={save}><div className="profile-popover-head"><Avatar user={user} /><div><strong>{fullName}</strong><span>{user.email}</span></div></div><label className="field compact"><span>Foto</span><input value={avatar} onChange={(event) => setAvatar(event.target.value)} placeholder="URL da foto" /></label><label className="field compact"><span>Nome</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label className="field compact"><span>Usuario</span><input value={username} onChange={(event) => setUsername(event.target.value)} /></label><label className="field compact"><span>Email da conta</span><input value={user.email || ''} disabled readOnly /></label>{notice && <p className={`notice ${notice.kind}`}>{notice.text}</p>}<div className="profile-actions"><button className="secondary-action" type="button" onClick={reset}>Redefinir senha</button><button className="primary-action small">Salvar</button></div></form></div>
}

function DetailsModal({ item, onClose }: { item: Estoque; onClose: () => void }) {
  return <div className="modal-backdrop"><div className="inventory-modal"><div className="modal-head"><h2>{item.denominacao || item.material || 'Item'}</h2><button className="icon-button small" onClick={onClose}><CloseIcon /></button></div><dl className="details-list">{Object.entries(item).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value ?? '-')}</dd></div>)}</dl></div></div>
}

function QuantityModal({ item, onClose, onSaved }: { item: Estoque; onClose: () => void; onSaved: () => void }) {
  const isMaterial = item.categoria === 'Material'
  const [value, setValue] = useState(String(isMaterial ? item.peso_disponivel_kg ?? 0 : item.quantidade_pecas ?? 0))
  async function save() { const parsed = isMaterial ? parseNumber(value) : Number.parseInt(value, 10); const payload = isMaterial ? { peso_disponivel_kg: parsed } : { quantidade_pecas: parsed }; const { error } = await supabase.from('estoque').update(payload).eq('id', item.id); if (!error) await supabase.from('estoque_historico').insert({ estoque_id: item.id, tipo: 'entrada', quantidade: isMaterial ? null : parsed, peso_kg: isMaterial ? parsed : null, observacao: 'Ajuste de quantidade' }); onSaved() }
  return <div className="modal-backdrop"><div className="inventory-modal"><div className="modal-head"><h2>Alterar quantidade</h2><button className="icon-button small" onClick={onClose}><CloseIcon /></button></div><label className="field"><span>{isMaterial ? 'Kg disponiveis' : 'Pecas'}</span><input value={value} onChange={(event) => setValue(event.target.value)} /></label><div className="modal-actions"><button className="secondary-action" onClick={onClose}>Cancelar</button><button className="primary-action small" onClick={save}>Salvar</button></div></div></div>
}

function CompanyModal({ company, onClose }: { company: Cliente; onClose: () => void }) {
  return <div className="modal-backdrop"><div className="inventory-modal company-modal"><div className="modal-head"><h2>{company.nome}</h2><button className="icon-button small" onClick={onClose}><CloseIcon /></button></div><dl className="details-list"><div><dt>CNPJ</dt><dd>{company.cnpj || '-'}</dd></div><div><dt>Telefones</dt><dd>{company.telefones?.join(', ') || '-'}</dd></div><div><dt>Emails</dt><dd>{company.emails?.join(', ') || '-'}</dd></div><div><dt>Endereco</dt><dd>{company.endereco || '-'}</dd></div><div><dt>Site</dt><dd>{company.site || '-'}</dd></div></dl></div></div>
}

function Metric({ icon, title, value, detail, badge, tone = '' }: { icon: React.ReactNode; title: string; value: string; detail: string; badge: string; tone?: string }) { return <article className="metric-card fade-in"><div className="metric-top">{icon}<span className={`metric-badge ${tone}`}>{badge}</span></div><div><p>{title}</p><h2>{value}</h2><small>{detail}</small></div></article> }
function Avatar({ user }: { user: User }) { const avatar = String(user.user_metadata?.avatar_url ?? ''); return avatar ? <img src={avatar} alt="Foto de perfil" /> : <div className="avatar-fallback">{getInitials(getName(user) || user.email || 'U')}</div> }
function renderCompany(name: string | null | undefined, id: string | null | undefined, clientes: Cliente[], onCompany: (cliente: Cliente) => void) { const client = clientes.find((item) => item.id === id || normalize(item.nome) === normalize(name)); return client ? <button className="company-link" onClick={() => onCompany(client)}>{client.nome}</button> : name || '-' }
function getName(user: User) { return String(user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.username || user.email || 'Usuario') }
function getInitials(value: string) { return value.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U' }
function normalize(value: unknown) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() }
function parseNumber(value: string) { const parsed = Number(value.replace(/\./g, '').replace(',', '.')); return Number.isFinite(parsed) ? parsed : null }
function format(value: number) { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value) }
function maskOs(value: string) { const digits = value.replace(/\D/g, '').slice(0, 4); return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits }
function formFromItem(item: Estoque): StockForm { return { categoria: item.categoria === 'Material' ? 'Material' : item.categoria === 'Aramados' ? 'Aramados' : 'Molas', denominacao: item.denominacao || '', cliente: item.nome_empresa || '', numeroOs: item.numero_os || '', pedido: item.numero_pedido || '', material: item.material || item.tipo_material || '', bitola: item.bitola_mm ? String(item.bitola_mm).replace('.', ',') : '', peso: String(item.peso_disponivel_kg ?? item.peso_lote_kg ?? ''), quantidade: String(item.quantidade_pecas ?? ''), fornecedor: item.fornecedor || '', notaFiscal: item.nota_fiscal_numero || '', classe: item.classe_especificacao || '', observacoes: item.observacoes || '' } }
function statusClass(status: string | null | undefined) { const text = normalize(status); if (text.includes('entregue') || text.includes('finalizado')) return 'done'; if (text.includes('process') || text.includes('producao')) return 'processing'; return 'pending' }
function getWeekDiff(pedidos: Pedido[]) { const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); start.setHours(0, 0, 0, 0); const prev = new Date(start); prev.setDate(start.getDate() - 7); const next = new Date(start); next.setDate(start.getDate() + 7); const dateOf = (pedido: Pedido) => new Date(pedido.data_pedido || pedido.created_at || 0); return pedidos.filter((pedido) => dateOf(pedido) >= start && dateOf(pedido) < next).length - pedidos.filter((pedido) => dateOf(pedido) >= prev && dateOf(pedido) < start).length }
function Svg({ children }: { children: React.ReactNode }) { return <svg className="line-icon" viewBox="0 0 24 24" aria-hidden="true">{children}</svg> }
function Bell() { return <Svg><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M10 19a2 2 0 0 0 4 0" /></Svg> }
function Gear() { return <Svg><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" /><path d="M19 15a2 2 0 0 0 .4 2l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a2 2 0 0 0-2-.4 2 2 0 0 0-1.1 1.7V21a2 2 0 1 1-4 0v-.1a2 2 0 0 0-1.1-1.7 2 2 0 0 0-2 .4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a2 2 0 0 0 .4-2A2 2 0 0 0 3 13.5H3a2 2 0 1 1 0-4h.1A2 2 0 0 0 4.8 8a2 2 0 0 0-.4-2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a2 2 0 0 0 2 .4A2 2 0 0 0 10.5 2h3a2 2 0 0 0 1.1 1.6 2 2 0 0 0 2-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a2 2 0 0 0-.4 2 2 2 0 0 0 1.7 1.1H21a2 2 0 1 1 0 4h-.1A2 2 0 0 0 19 15Z" /></Svg> }
function DashboardIcon() { return <Svg><path d="M4 5h7v7H4z" /><path d="M13 5h7v4h-7z" /><path d="M13 11h7v8h-7z" /><path d="M4 14h7v5H4z" /></Svg> }
function BoxIcon() { return <Svg><path d="M5 4h14v4H5z" /><path d="M6 8h12v12H6z" /><path d="M10 12h4" /></Svg> }
function InboxIcon() { return <Svg><path d="M4 4h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M4 13h5l2 3h2l2-3h5" /></Svg> }
function TruckIcon() { return <Svg><path d="M3 7h11v10H3z" /><path d="M14 10h4l3 3v4h-7z" /><path d="M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /><path d="M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /></Svg> }
function AnalyticsIcon() { return <Svg><path d="M4 19V5h16v14z" /><path d="M8 16v-4" /><path d="M12 16V9" /><path d="M16 16v-6" /></Svg> }
function LogoutIcon() { return <Svg><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Svg> }
function SearchIcon() { return <Svg><path d="m21 21-4.3-4.3" /><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" /></Svg> }
function InfoIcon() { return <Svg><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="M12 11v5" /><path d="M12 8h.01" /></Svg> }
function CloseIcon() { return <Svg><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg> }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
