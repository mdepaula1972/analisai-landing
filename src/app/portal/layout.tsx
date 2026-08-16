'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Tenant, TenantUser, RoleUsuario, PLANO_LABELS, PLANO_CORES, canAccess } from '@/types/tenant';
import {
  LayoutDashboard, FileText, TrendingUp, Zap, User,
  LogOut, ChevronLeft, ChevronRight, CreditCard,
  DollarSign, Receipt, Menu, X, Loader2
} from 'lucide-react';

// ── Context do Portal ─────────────────────────────────────────

interface PortalContextType {
  tenant: Tenant | null;
  role: RoleUsuario | null;
  userId: string | null;
  loading: boolean;
}

const PortalContext = createContext<PortalContextType>({
  tenant: null, role: null, userId: null, loading: true,
});

export function usePortal() { return useContext(PortalContext); }

// ── Nav Items ─────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/portal', label: 'Visão Geral', icon: LayoutDashboard, plano: null },
  { href: '/portal/contas', label: 'Contas a Pagar', icon: Receipt, plano: null },
  { href: '/portal/receber', label: 'Contas a Receber', icon: DollarSign, plano: null },
  { href: '/portal/dre', label: 'DRE Gerencial', icon: TrendingUp, plano: 'gestao' as const },
  { href: '/portal/simulador', label: 'Simulador', icon: Zap, plano: 'estrategico' as const },
  { href: '/portal/creditos', label: 'Créditos', icon: CreditCard, plano: null },
  { href: '/portal/perfil', label: 'Perfil', icon: User, plano: null },
];

// ── Sidebar ───────────────────────────────────────────────────

function PortalSidebar({
  tenant, collapsed, onToggle
}: {
  tenant: Tenant | null;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <aside className={`
      fixed left-0 top-0 h-full z-40 flex flex-col
      bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/80
      transition-all duration-300 ease-in-out
      ${collapsed ? 'w-16' : 'w-60'}
    `}>
      {/* Logo + Toggle */}
      <div className={`flex items-center h-16 px-3 border-b border-slate-800/80 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-white font-bold text-sm truncate leading-tight">AnalisAI.me</span>
              <span className="text-[9px] font-extrabold text-amber-400 uppercase tracking-widest leading-none">v2.5.0 BPO</span>
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Tenant info */}
      {tenant && !collapsed && (
        <div className="px-3 py-3 border-b border-slate-800/60">
          <p className="text-xs text-slate-500 truncate">{tenant.razao_social}</p>
          <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${PLANO_CORES[tenant.plano]}`}>
            {PLANO_LABELS[tenant.plano]}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          // Verificar acesso pelo plano
          const bloqueado = item.plano && tenant
            ? !canAccess(tenant.plano, item.plano === 'gestao' ? 'dre' : 'simulador')
            : false;

          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={bloqueado ? '#' : item.href}
              title={collapsed ? item.label : undefined}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group
                ${isActive
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  : bloqueado
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                }
              `}
              onClick={e => bloqueado && e.preventDefault()}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-amber-400' : bloqueado ? 'text-slate-700' : ''}`} />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {bloqueado && (
                    <span className="ml-auto text-[9px] font-bold text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      {item.plano === 'gestao' ? 'Gestão' : 'Estratégico'}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-slate-800/80">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Sair' : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}

// ── Header ────────────────────────────────────────────────────

function PortalHeader({
  tenant, onMobileMenuToggle
}: {
  tenant: Tenant | null;
  onMobileMenuToggle: () => void;
}) {
  const pathname = usePathname();
  const pageLabel = NAV_ITEMS.find(i => pathname === i.href || pathname.startsWith(i.href + '/'))?.label || 'Portal';

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 flex items-center px-4 gap-4">
      <button
        onClick={onMobileMenuToggle}
        className="lg:hidden w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400"
      >
        <Menu className="w-4 h-4" />
      </button>

      <div className="flex-1 min-w-0">
        <h2 className="text-base font-bold text-white truncate">{pageLabel}</h2>
        {tenant && (
          <p className="text-xs text-slate-500 truncate">{tenant.nome_fantasia || tenant.razao_social}</p>
        )}
      </div>

      {tenant && (
        <div className="hidden sm:flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${PLANO_CORES[tenant.plano]}`}>
            {PLANO_LABELS[tenant.plano]}
          </span>
        </div>
      )}
    </header>
  );
}

// ── Layout Principal ──────────────────────────────────────────

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [role, setRole] = useState<RoleUsuario | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadUserContext() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login?from=/portal');
        return;
      }

      setUserId(user.id);

      // Busca vínculo tenant_user
      const { data: tu } = await supabase
        .from('tenant_users')
        .select('role, tenant_id')
        .eq('user_id', user.id)
        .single();

      if (tu) {
        setRole(tu.role as RoleUsuario);

        // admin_bpo: redireciona para admin
        if (tu.role === 'admin_bpo') {
          router.replace('/admin');
          return;
        }

        // Busca dados do tenant
        const { data: t } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', tu.tenant_id)
          .single();

        if (t) setTenant(t as Tenant);
      }

      setLoading(false);
    }

    loadUserContext();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-slate-400 text-sm">Carregando portal...</p>
        </div>
      </div>
    );
  }

  return (
    <PortalContext.Provider value={{ tenant, role, userId, loading }}>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Sidebar desktop */}
        <div className="hidden lg:block">
          <PortalSidebar
            tenant={tenant}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-60 flex-shrink-0">
              <PortalSidebar
                tenant={tenant}
                collapsed={false}
                onToggle={() => setMobileMenuOpen(false)}
              />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="absolute top-3 right-3 text-slate-400 z-10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo principal */}
        <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60'}`}>
          <PortalHeader tenant={tenant} onMobileMenuToggle={() => setMobileMenuOpen(true)} />
          <main className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)]">
            {children}
          </main>
        </div>
      </div>
    </PortalContext.Provider>
  );
}
