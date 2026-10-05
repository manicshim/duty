import { DragEvent, FormEvent, TouchEvent, useEffect, useMemo, useRef, useState } from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3300';
const oauthProviders = ['google', 'naver', 'kakao'] as const;

type ActorRole = 'member' | 'master';
type SectionId = 'calendar' | 'calendarView' | 'upload' | 'logs' | 'wantedLeave' | 'dayoff' | 'grades';
type UploadStatus = 'idle' | 'selected' | 'uploading' | 'success' | 'error';

interface DutyMember {
  id: number;
  name: string;
  department: string | null;
  sortOrder: number | null;
  duties: Record<string, string>;
}

interface DutyMonth {
  year: number;
  month: number;
  days: number[];
  members: DutyMember[];
}

interface DutyCalendarDay {
  date: string;
  day: number;
  weekday: number;
  duties: Array<{
    memberId: number;
    memberName: string;
    dutyCode: string;
    dutyShortCode: string;
    dutyLabel: string | null;
  }>;
}

type DutyDayDetail = { day: DutyCalendarDay; duties: DutyCalendarDay['duties']; emptyLabel: string };

const koreanPublicHolidayNames = new Map([
  ['2026-01-01', '신정'],
  ['2026-02-16', '설날 연휴'],
  ['2026-02-17', '설날'],
  ['2026-02-18', '설날 연휴'],
  ['2026-03-01', '삼일절'],
  ['2026-03-02', '삼일절 대체휴일'],
  ['2026-05-01', '노동절'],
  ['2026-05-05', '어린이날'],
  ['2026-05-24', '부처님오신날'],
  ['2026-05-25', '부처님오신날 대체휴일'],
  ['2026-06-03', '지방선거일'],
  ['2026-06-06', '현충일'],
  ['2026-07-17', '제헌절'],
  ['2026-08-15', '광복절'],
  ['2026-08-17', '광복절 대체휴일'],
  ['2026-09-24', '추석 연휴'],
  ['2026-09-25', '추석'],
  ['2026-09-26', '추석 연휴'],
  ['2026-09-27', '추석 연휴'],
  ['2026-10-03', '개천절'],
  ['2026-10-05', '개천절 대체휴일'],
  ['2026-10-09', '한글날'],
  ['2026-12-25', '성탄절'],
]);

interface DutyCalendarMonth {
  year: number;
  month: number;
  weeks: Array<Array<DutyCalendarDay | null>>;
}

interface UploadLog {
  id: number;
  originalName: string;
  targetYear: number;
  targetMonth: number;
  rowCount: number;
  status: string;
  createdAt: string;
}

interface UploadResultSummary {
  savedCount: number;
  year: number;
  month: number;
  fileName: string;
}

interface TesterMember {
  id: number;
  email: string | null;
  name: string;
  hidden: boolean;
  linked: boolean;
  updatedAt: string;
}

interface MasterSignupRequest {
  id: number;
  email: string;
  provider: 'google' | 'naver' | 'kakao' | 'email';
  name: string;
  level: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface Actor {
  role: ActorRole;
  lv: number;
  name: string;
}

interface AuthUser extends Actor {
  email: string;
  provider: 'google' | 'naver' | 'kakao' | 'email';
}

interface SectionPolicy {
  id: SectionId;
  label: string;
  description: string;
  icon: string;
  group: 'shared' | 'master';
  minMemberLv?: number;
  minMasterLv?: number;
}

const sectionPolicies: SectionPolicy[] = [
  { id: 'calendarView', label: '달력보기', description: '날짜별 근무자 요약', icon: '▦', group: 'shared', minMemberLv: 1, minMasterLv: 1 },
  { id: 'calendar', label: '근무표', description: '월별 duty 캘린더', icon: '□', group: 'shared', minMemberLv: 1, minMasterLv: 1 },
  { id: 'wantedLeave', label: '원티드 휴가', description: '희망 휴가 신청/검토', icon: '○', group: 'shared', minMemberLv: 1, minMasterLv: 2 },
  { id: 'upload', label: '엑셀 업로드', description: '근무표 파일 등록', icon: '↑', group: 'master', minMasterLv: 4 },
  { id: 'dayoff', label: '휴무 관리', description: '지정 휴무와 메모', icon: '◇', group: 'master', minMasterLv: 3 },
  { id: 'logs', label: '업로드 로그', description: '등록 이력 추적', icon: '≡', group: 'master', minMasterLv: 3 },
  { id: 'grades', label: '등급 관리', description: '권한과 접근 제어', icon: '↕', group: 'master', minMasterLv: 5 },
];

const signupActors: Actor[] = [
  { role: 'master', lv: 5, name: '관리자' },
  { role: 'master', lv: 4, name: '업로드 관리자' },
  { role: 'master', lv: 3, name: '운영 관리자' },
  { role: 'master', lv: 2, name: '검토 관리자' },
  { role: 'master', lv: 1, name: '조회 관리자' },
  { role: 'member', lv: 2, name: '선임근무자' },
  { role: 'member', lv: 1, name: '근무자' },
];

function buildOAuthStartUrl(provider: Exclude<AuthUser['provider'], 'email'>, mode: 'login' | 'signup', role: ActorRole, lv: number) {
  const params = new URLSearchParams({
    mode,
    role,
    level: String(lv),
  });
  return `${apiBaseUrl}/auth/oauth/${provider}/start?${params.toString()}`;
}

function isGoogleBlockedInAppBrowser() {
  const ua = window.navigator.userAgent;
  return /KAKAOTALK|NAVER|FBAN|FBAV|Instagram|Line\/|; wv\)|\bwv\b/i.test(ua);
}

function openOAuthInExternalBrowser(provider: Exclude<AuthUser['provider'], 'email'>, mode: 'login' | 'signup', role: ActorRole, lv: number) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete('oauthResult');
  nextUrl.searchParams.set('openOAuth', provider);
  nextUrl.searchParams.set('mode', mode);
  nextUrl.searchParams.set('role', role);
  nextUrl.searchParams.set('level', String(lv));

  if (/Android/i.test(window.navigator.userAgent)) {
    const scheme = nextUrl.protocol.replace(':', '');
    const urlWithoutScheme = nextUrl.toString().replace(/^https?:\/\//, '');
    window.location.href = `intent://${urlWithoutScheme}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(nextUrl.toString())};end`;
    return true;
  }

  return false;
}

export function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const saved = window.sessionStorage.getItem('duty-auth-user');
    if (saved && !new URLSearchParams(window.location.search).has('oauthResult')) {
      try {
        setAuthUser(JSON.parse(saved) as AuthUser);
      } catch {
        window.sessionStorage.removeItem('duty-auth-user');
      }
    }
    setAuthReady(true);
  }, []);

  function login(user: AuthUser) {
    window.sessionStorage.setItem('duty-auth-user', JSON.stringify(user));
    setAuthUser(user);
  }

  function logout() {
    window.sessionStorage.removeItem('duty-auth-user');
    setAuthUser(null);
  }

  if (!authReady || !authUser) {
    return <IntroLogin onLogin={login} />;
  }

  return <AuthenticatedApp authUser={authUser} onLogout={logout} />;
}

function IntroLogin({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [showLogin, setShowLogin] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [provider, setProvider] = useState<AuthUser['provider']>('google');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<ActorRole>('member');
  const [lv, setLv] = useState(1);
  const [authStep, setAuthStep] = useState<'email' | 'code' | 'profile'>('email');
  const [code, setCode] = useState('');
  const [profileToken, setProfileToken] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const providerStyles: Record<AuthUser['provider'], string> = {
    google: 'border-slate-300 bg-white text-slate-800 shadow-sm',
    naver: 'border-[#03c75a] bg-[#03c75a] text-white shadow-sm',
    kakao: 'border-[#fee500] bg-[#fee500] text-[#191919] shadow-sm',
    email: 'border-slate-800 bg-slate-900 text-white shadow-sm',
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get('oauthResult');
    const openOAuth = params.get('openOAuth');
    if (!oauthResult && oauthProviders.some((item) => item === openOAuth)) {
      const nextProvider = openOAuth as Exclude<AuthUser['provider'], 'email'>;
      const nextMode = params.get('mode') === 'signup' ? 'signup' : 'login';
      const nextRole = params.get('role') === 'master' ? 'master' : 'member';
      const nextLv = Number(params.get('level') ?? 1) || 1;
      window.history.replaceState({}, '', window.location.pathname);
      setShowLogin(true);
      setAuthMode(nextMode);
      setProvider(nextProvider);
      setRole(nextRole);
      setLv(nextLv);
      setAuthMessage('외부 브라우저에서 SNS 인증을 이어갑니다.');
      window.setTimeout(() => {
        window.location.href = buildOAuthStartUrl(nextProvider, nextMode, nextRole, nextLv);
      }, 250);
      return;
    }
    if (!oauthResult) return;
    window.history.replaceState({}, '', window.location.pathname);
    try {
      const result = JSON.parse(oauthResult) as {
        user?: AuthUser;
        requiresProfile?: boolean;
        email?: string;
        provider?: AuthUser['provider'];
        profileToken?: string;
        name?: string;
        role?: ActorRole;
        level?: number;
        message?: string;
      };
      if (result.user) {
        onLogin(result.user);
        return;
      }
      if (result.requiresProfile) {
        setShowLogin(true);
        setAuthMode('signup');
        setAuthStep('profile');
        setEmail(result.email ?? '');
        setProvider(result.provider ?? 'google');
        setProfileToken(result.profileToken ?? '');
        setName(result.name && !result.name.includes('@') ? result.name : '');
        setRole('member');
        setLv(result.level ?? 1);
        setAuthMessage(result.message ?? 'SNS 인증이 완료되었습니다. 가입 정보를 확인해 주세요.');
        return;
      }
      setShowLogin(true);
      setAuthMode('login');
      setAuthMessage(result.message ?? 'SNS 계정 인증 결과를 확인할 수 없습니다.');
    } catch {
      setShowLogin(true);
      setAuthMessage('SNS 인증 결과를 읽을 수 없습니다.');
    }
  }, [onLogin]);

  function selectProvider(nextProvider: AuthUser['provider']) {
    setProvider(nextProvider);
    setAuthStep('email');
    setCode('');
    setProfileToken('');
    setAuthMessage('');
  }

  function resetAuthFlow(mode = authMode) {
    setAuthMode(mode);
    setAuthStep('email');
    setCode('');
    setProfileToken('');
    setAuthMessage('');
  }

  function startOAuth(nextProvider: Exclude<AuthUser['provider'], 'email'>) {
    setProvider(nextProvider);
    if (nextProvider === 'google' && isGoogleBlockedInAppBrowser()) {
      setAuthMessage('현재 앱 내부 브라우저에서는 Google 로그인이 차단됩니다. 외부 브라우저로 열어 인증을 계속합니다.');
      const opened = openOAuthInExternalBrowser(nextProvider, authMode, role, lv);
      if (!opened) {
        setAuthMessage('Google 정책상 앱 내부 브라우저에서는 로그인이 불가합니다. 우측 상단 메뉴에서 Safari/Chrome으로 열어 다시 시도하세요.');
      }
      return;
    }
    window.location.href = buildOAuthStartUrl(nextProvider, authMode, role, lv);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (authStep !== 'profile') return;
    const nextName = name.trim();
    if (nextName.length < 2 || nextName.includes('@') || nextName.toLowerCase() === email.toLowerCase()) {
      setAuthMessage('이름은 이메일이 아닌 실제 이름으로 2자 이상 입력해 주세요.');
      return;
    }
    setAuthLoading(true);
    setAuthMessage('');
    try {
      const response = await fetch(`${apiBaseUrl}/auth/complete-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, provider, profileToken, name: nextName, role, level: lv }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? '회원 정보 등록 실패');
      if (result.pending) {
        setAuthMessage(result.message ?? '관리자 가입 요청이 승인 대기 상태입니다. 관리자에게 문의해 주세요.');
        setAuthStep('email');
        setProfileToken('');
        return;
      }
      onLogin(result.user);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : '회원 정보 등록 실패');
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-5 sm:px-6 sm:py-7">
        <header className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
            <BrandMark size="sm" />
            DutyFlow
          </div>
          <button
            type="button"
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
            onClick={() => {
              resetAuthFlow('login');
              setShowLogin(true);
            }}
          >
            로그인
          </button>
        </header>

        <section className="flex flex-1 items-center py-12 sm:py-16 lg:py-20">
          <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">DutyFlow Console</p>
              <h1 className="mt-4 max-w-2xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                병동 근무표 관리,
                <span className="block">필요한 정보만 빠르게.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
                로그인한 권한에 맞춰 근무표, 달력, 희망 휴가, 업로드 관리 화면만 보여줍니다.
                근무 데이터는 인증 전에는 노출되지 않습니다.
              </p>
              <div className="mt-8 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="h-11 rounded-lg bg-slate-950 px-6 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
                  onClick={() => {
                    resetAuthFlow('login');
                    setShowLogin(true);
                  }}
                >
                  로그인
                </button>
                <button
                  type="button"
                  className="h-11 rounded-lg border border-slate-200 bg-white px-6 text-sm font-black text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                  onClick={() => {
                    resetAuthFlow('signup');
                    setShowLogin(true);
                  }}
                >
                  회원가입
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <p className="text-xs font-black text-slate-500">오늘 근무</p>
                  <p className="mt-1 text-sm font-black text-slate-950">Day / Evening / Night</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">오늘</span>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  ['Day', '7명', 'duty-day'],
                  ['Evening', '4명', 'duty-evening'],
                  ['Mid', '0명', 'duty-mid'],
                  ['Night', '3명', 'duty-night'],
                ].map(([label, count, className]) => (
                  <div key={label} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ring-1 ${className}`}>
                    <span className="text-sm font-black">{label}</span>
                    <span className="text-sm font-black text-slate-900">{count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                <IntroStat label="Member" value="근무표" />
                <IntroStat label="Master 3+" value="휴무" />
                <IntroStat label="Master 4+" value="업로드" />
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs font-bold text-slate-500">
          <span>Private ward schedule system</span>
          <span>SNS account authentication / Role based access</span>
        </footer>
      </div>

      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          <section className="w-full rounded-t-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl sm:max-w-[440px] sm:rounded-2xl sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black tracking-tight">{authMode === 'login' ? '로그인' : '회원가입'}</h2>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                {authMode === 'login' ? '등록된 SNS 계정으로 로그인합니다.' : 'SNS 계정 인증 후 가입 정보를 확인합니다.'}
              </p>
            </div>
            <button
              type="button"
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50"
              onClick={() => {
                setShowLogin(false);
                resetAuthFlow();
              }}
            >
              닫기
            </button>
          </div>

          <div className="mb-3 grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1">
            {(['login', 'signup'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`h-9 rounded-md text-xs font-black transition ${
                  authMode === mode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
                onClick={() => resetAuthFlow(mode)}
              >
                {mode === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>

          {authMode === 'signup' && authStep !== 'profile' && (
            <div className="mb-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-500">가입 유형</label>
                <select
                  className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none ring-slate-300 focus:border-slate-300 focus:ring-2"
                  value={`${role}:${lv}`}
                  onChange={(event) => {
                    const [nextRole, nextLv] = event.target.value.split(':');
                    setRole(nextRole as ActorRole);
                    setLv(Number(nextLv));
                  }}
                >
                  {signupActors.map((item) => (
                    <option key={`${item.role}:${item.lv}`} value={`${item.role}:${item.lv}`}>
                      {item.role === 'master' ? '관리자' : '근무자'} Lv.{item.lv}
                    </option>
                  ))}
                </select>
              </div>
              <p className="self-end text-xs leading-5 text-slate-500">관리자는 기존 관리자 승인 후에만 로그인할 수 있습니다.</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1.5">
            {oauthProviders.map((item) => (
              <button
                key={item}
                type="button"
                className={`h-9 rounded-lg border text-xs font-black transition sm:h-10 ${
                  provider === item ? providerStyles[item] : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800'
                }`}
                onClick={() => startOAuth(item)}
              >
                {item === 'google' ? 'Google' : item === 'naver' ? 'Naver' : 'Kakao'}
              </button>
            ))}
          </div>

          {authStep === 'profile' && <form className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3" onSubmit={submit}>
            <div>
              <label className="text-xs font-bold text-slate-500">SNS 계정 메일</label>
              <input
                className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none ring-slate-300 focus:border-slate-300 focus:ring-2 sm:h-9"
                type="email"
                value={email}
                readOnly
                required
                placeholder="name@example.com"
              />
            </div>

              <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-slate-500">이름</label>
                  <input
                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none ring-slate-300 focus:border-slate-300 focus:ring-2 sm:h-9"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    placeholder="이름"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">가입 유형</label>
                  <select
                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none ring-slate-300 focus:border-slate-300 focus:ring-2 sm:h-9"
                    value={`${role}:${lv}`}
                    onChange={(event) => {
                      const [nextRole, nextLv] = event.target.value.split(':');
                      setRole(nextRole as ActorRole);
                      setLv(Number(nextLv));
                    }}
                  >
                    {signupActors.map((item) => (
                      <option key={`${item.role}:${item.lv}`} value={`${item.role}:${item.lv}`}>
                        {item.role === 'master' ? '관리자' : '근무자'} Lv.{item.lv}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

            {authMessage && (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-700">
                {authMessage}
              </div>
            )}

            {role === 'master' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
                관리자 가입은 승인 대기 상태로 등록됩니다. 기존 관리자 승인 전까지 로그인할 수 없습니다.
              </div>
            )}

            <button
              className={`h-9 w-full rounded-lg border text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${providerStyles[provider]}`}
              type="submit"
              disabled={authLoading}
            >
              {authLoading
                ? '처리 중'
                : role === 'master'
                  ? '관리자 승인 요청'
                  : '정보 등록 후 로그인'}
            </button>
          </form>}
          {authStep !== 'profile' && authMessage && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-700">
              {authMessage}
            </div>
          )}
        </section>
        </div>
      )}
    </main>
  );
}

function IntroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-black text-slate-900">{value}</p>
    </div>
  );
}

function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-5 w-5' : 'h-9 w-9';
  const dot = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5';
  return (
    <span className={`${box} inline-flex items-center justify-center rounded-xl bg-slate-950 shadow-sm`}>
      <span className={`${dot} rounded-full bg-blue-400`} />
    </span>
  );
}

function AuthenticatedApp({ authUser, onLogout }: { authUser: AuthUser; onLogout: () => void }) {
  const today = new Date();
  const [actor, setActor] = useState<Actor>({ role: authUser.role, lv: authUser.lv, name: authUser.name });
  const [activeSection, setActiveSection] = useState<SectionId>('calendarView');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [dutyMonth, setDutyMonth] = useState<DutyMonth | null>(null);
  const [dutyCalendar, setDutyCalendar] = useState<DutyCalendarMonth | null>(null);
  const [logs, setLogs] = useState<UploadLog[]>([]);
  const [testerMembers, setTesterMembers] = useState<TesterMember[]>([]);
  const [masterSignupRequests, setMasterSignupRequests] = useState<MasterSignupRequest[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [lastUpload, setLastUpload] = useState<UploadResultSummary | null>(null);
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const visibleSections = useMemo(() => sectionPolicies.filter((section) => canAccess(actor, section)), [actor]);
  const monthLabel = useMemo(() => `${year}년 ${month}월`, [year, month]);

  useEffect(() => {
    setActor({ role: authUser.role, lv: authUser.lv, name: authUser.name });
  }, [authUser]);

  useEffect(() => {
    if (!visibleSections.some((section) => section.id === activeSection)) {
      setActiveSection(visibleSections[0]?.id ?? 'calendarView');
    }
  }, [activeSection, visibleSections]);

  useEffect(() => {
    if (canOpen('calendar')) {
      void refreshDuties();
    }
    if (canOpen('logs')) {
      void loadLogs();
    }
    if (actor.role === 'master') {
      void loadTesterMembers();
      void loadMasterSignupRequests();
    }
  }, [year, month, actor.role, actor.lv]);

  async function loadDuties() {
    const response = await fetch(`${apiBaseUrl}/duties?year=${year}&month=${month}`);
    if (!response.ok) throw new Error(await response.text());
    setDutyMonth(await response.json());
  }

  async function loadDutyCalendar() {
    const response = await fetch(`${apiBaseUrl}/duties/calendar?year=${year}&month=${month}`);
    if (!response.ok) throw new Error(await response.text());
    setDutyCalendar(await response.json());
  }

  async function refreshDuties() {
    setIsLoading(true);
    try {
      await Promise.all([loadDuties(), loadDutyCalendar()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '근무표 조회 실패');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadLogs() {
    const response = await fetch(`${apiBaseUrl}/duties/logs`);
    if (response.ok) {
      setLogs(await response.json());
    }
  }

  async function loadTesterMembers() {
    const response = await fetch(`${apiBaseUrl}/auth/tester-members`);
    if (response.ok) {
      setTesterMembers(await response.json());
    }
  }

  async function loadMasterSignupRequests() {
    const response = await fetch(`${apiBaseUrl}/auth/master-signup-requests?approverEmail=${encodeURIComponent(authUser.email)}`);
    if (response.ok) {
      setMasterSignupRequests(await response.json());
    }
  }

  async function decideMasterSignupRequest(id: number, action: 'approve' | 'reject') {
    setMessage('');
    try {
      const response = await fetch(`${apiBaseUrl}/auth/master-signup-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverEmail: authUser.email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? '관리자 가입 요청 처리 실패');
      setMessage(result.message ?? '관리자 가입 요청을 처리했습니다.');
      await loadMasterSignupRequests();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '관리자 가입 요청 처리 실패');
    }
  }

  function changeUploadFile(nextFile: File | null) {
    setFile(nextFile);
    setUploadProgress(0);
    setUploadStatus(nextFile ? 'selected' : 'idle');
    setLastUpload(null);
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setMessage('업로드할 엑셀 파일을 선택하세요.');
      setUploadStatus('error');
      return;
    }

    const uploadFileName = file.name;
    const body = new FormData();
    body.append('file', file);
    setIsLoading(true);
    setUploadProgress(18);
    setUploadStatus('uploading');
    setLastUpload(null);
    setMessage('');
    const progressTimer = window.setInterval(() => {
      setUploadProgress((current) => (current >= 88 ? current : current + 7));
    }, 700);

    try {
      const response = await fetch(`${apiBaseUrl}/duties/upload`, {
        method: 'POST',
        body,
      });
      setUploadProgress(78);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? '업로드 실패');
      setYear(result.year);
      setMonth(result.month);
      setMessage(`${result.savedCount}건의 근무가 등록되었습니다.`);
      setFile(null);
      setLastUpload({ savedCount: result.savedCount, year: result.year, month: result.month, fileName: uploadFileName });
      await loadLogs();
      await refreshDuties();
      setUploadProgress(100);
      setUploadStatus('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '업로드 실패');
      setUploadProgress(0);
      setUploadStatus('error');
    } finally {
      window.clearInterval(progressTimer);
      setIsLoading(false);
    }
  }

  function canOpen(sectionId: SectionId) {
    const section = sectionPolicies.find((item) => item.id === sectionId);
    return section ? canAccess(actor, section) : false;
  }

  function dateKey(day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const activePolicy = sectionPolicies.find((section) => section.id === activeSection) ?? sectionPolicies[0];
  const memberCount = dutyMonth?.members.length ?? 0;
  const dutyCount = dutyMonth?.members.reduce((total, member) => total + Object.keys(member.duties).length, 0) ?? 0;

  return (
    <main className={`min-h-screen app-shell ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      <div className="mx-auto grid min-h-screen w-full max-w-[1680px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden border-r app-border app-panel p-4 shadow-sm lg:block">
          <div className="flex items-center gap-3 px-2 py-2">
            <BrandMark />
            <div>
              <p className="text-base font-black tracking-tight app-text">DutyFlow</p>
              <p className="text-xs font-medium app-muted">Ward schedule suite</p>
            </div>
          </div>

          <AccountCard authUser={authUser} actor={actor} onLogout={onLogout} />
          <Navigation sections={visibleSections} activeSection={activeSection} onSelect={setActiveSection} />
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-40 border-b app-border app-header px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 lg:hidden">
                    <BrandMark size="sm" />
                    <p className="text-sm font-black app-text">DutyFlow</p>
                  </div>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-blue-500">{activePolicy.label}</p>
                  <h2 className="truncate text-lg font-black tracking-tight app-text sm:text-xl">{monthLabel} 근무 운영</h2>
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
                  <button
                    type="button"
                    className="h-8 rounded-lg border app-border app-control px-3 text-xs font-bold shadow-sm lg:hidden"
                    onClick={onLogout}
                  >
                    로그아웃
                  </button>
                </div>
              </div>

              <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => event.preventDefault()}>
                <input
                  aria-label="연도"
                  className="h-8 w-20 rounded-lg border app-border app-input px-2 text-xs font-semibold outline-none ring-blue-400 transition focus:ring-2"
                  type="number"
                  min="2000"
                  max="2100"
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                />
                <select
                  aria-label="월"
                  className="h-8 rounded-lg border app-border app-input px-2 text-xs font-semibold outline-none ring-blue-400 transition focus:ring-2"
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>
                      {value}월
                    </option>
                  ))}
                </select>
              </form>
            </div>

            <div className="mt-3 lg:hidden">
              <MobileNavigation sections={visibleSections} activeSection={activeSection} onSelect={setActiveSection} />
            </div>
          </header>

          <div className="p-4 sm:p-5 lg:p-6">
            {activeSection !== 'calendarView' && <DashboardMetrics memberCount={memberCount} dutyCount={dutyCount} actor={actor} />}

            {message && <StatusBanner message={message} tone={message.includes('실패') ? 'error' : 'success'} />}

            {activeSection !== 'calendarView' && activeSection !== 'calendar' && actor.role === 'master' && <TesterStatusCard testers={testerMembers} />}

            <div key={activeSection} className="animate-[fadeIn_180ms_ease-out]">
              {activeSection === 'calendar' && canOpen('calendar') && (
                <>
                  <DutyCalendarTable dutyMonth={dutyMonth} dateKey={dateKey} isLoading={isLoading} canEdit={actor.role === 'master'} onChanged={refreshDuties} />
                  {actor.role === 'master' && <TesterStatusCard testers={testerMembers} className="mt-4" />}
                </>
              )}

              {activeSection === 'calendarView' && canOpen('calendarView') && (
                <>
                  <DutyMonthGrid dutyCalendar={dutyCalendar} isLoading={isLoading} actor={actor} actorName={authUser.name} />
                  <div className="mt-4 grid gap-3">
                    <DashboardMetrics memberCount={memberCount} dutyCount={dutyCount} actor={actor} className="" />
                    {actor.role === 'master' && <TesterStatusCard testers={testerMembers} className="" />}
                  </div>
                </>
              )}

              {activeSection === 'upload' && canOpen('upload') && (
                <UploadPanel
                  file={file}
                  isLoading={isLoading}
                  progress={uploadProgress}
                  status={uploadStatus}
                  lastUpload={lastUpload}
                  onFileChange={changeUploadFile}
                  onUpload={upload}
                />
              )}

              {activeSection === 'logs' && canOpen('logs') && <UploadLogs logs={logs} />}

              {activeSection === 'wantedLeave' && canOpen('wantedLeave') && (
                <PlaceholderPanel
                  title="원티드 휴가"
                  body={actor.role === 'member' ? '본인 희망 휴가를 신청하고 처리 상태를 확인하는 영역입니다.' : '근무자별 희망 휴가를 검토하는 관리자 영역입니다.'}
                />
              )}

              {activeSection === 'dayoff' && canOpen('dayoff') && (
                <PlaceholderPanel title="근무자 휴무관리" body="관리자가 근무자별 지정 휴무, 메모, 조정 이력을 관리하는 영역입니다." />
              )}

              {activeSection === 'grades' && canOpen('grades') && (
                <GradeAdminPanel
                  requests={masterSignupRequests}
                  onApprove={(id) => decideMasterSignupRequest(id, 'approve')}
                  onReject={(id) => decideMasterSignupRequest(id, 'reject')}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AccountCard({ authUser, actor, onLogout }: { authUser: AuthUser; actor: Actor; onLogout: () => void }) {
  return (
    <div className="mt-5 rounded-2xl border app-border app-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-sm font-black text-blue-700">
          {authUser.name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black app-text">{authUser.name}</p>
          <p className="truncate text-xs app-muted">{authUser.email}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-blue-500/10 px-3 py-2">
        <span className="text-xs font-bold text-blue-500">{authUser.provider.toUpperCase()}</span>
        <span className="text-xs font-black text-blue-700">{actor.role === 'master' ? 'Master' : 'Member'} Lv.{actor.lv}</span>
      </div>
      <button
        type="button"
        className="mt-3 h-8 w-full rounded-xl app-soft text-xs font-bold transition"
        onClick={onLogout}
      >
        로그아웃
      </button>
    </div>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="flex h-8 items-center gap-1 rounded-full border app-border app-control px-1.5 text-[11px] font-black shadow-sm"
      onClick={onToggle}
      aria-label="toggle color mode"
    >
      <span className={`rounded-full px-2 py-1 ${theme === 'light' ? 'bg-amber-100 text-amber-700' : 'app-muted'}`}>Light</span>
      <span className={`rounded-full px-2 py-1 ${theme === 'dark' ? 'bg-indigo-100 text-indigo-700' : 'app-muted'}`}>Dark</span>
    </button>
  );
}

function Navigation({
  sections,
  activeSection,
  onSelect,
}: {
  sections: SectionPolicy[];
  activeSection: SectionId;
  onSelect: (section: SectionId) => void;
}) {
  return (
    <nav className="mt-5 space-y-1.5">
      {sections.map((section) => {
        const isActive = activeSection === section.id;
        const isMasterOnly = section.group === 'master';
        return (
          <button
            key={section.id}
            type="button"
            className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
              isActive
                ? isMasterOnly
                  ? 'border-violet-500 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm shadow-violet-600/20'
                  : 'border-blue-500 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/20'
                : isMasterOnly
                  ? 'border-violet-200/70 bg-violet-500/8 text-violet-500 hover:bg-violet-500/14'
                  : 'border-blue-200/70 bg-blue-500/7 text-blue-500 hover:bg-blue-500/12'
            }`}
            onClick={() => onSelect(section.id)}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${
                isActive ? 'bg-white/20 text-white' : isMasterOnly ? 'bg-violet-500/12 text-violet-500' : 'bg-blue-500/12 text-blue-500'
              }`}
            >
              {section.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="block text-sm font-black">{section.label}</span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${isActive ? 'bg-white/15 text-white' : isMasterOnly ? 'bg-violet-500/12 text-violet-500' : 'bg-blue-500/12 text-blue-500'}`}>
                  {isMasterOnly ? '관리자' : '공통'}
                </span>
              </span>
              <span className={`block truncate text-xs ${isActive ? 'text-white/80' : 'app-muted'}`}>
                {section.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function MobileNavigation({
  sections,
  activeSection,
  onSelect,
}: {
  sections: SectionPolicy[];
  activeSection: SectionId;
  onSelect: (section: SectionId) => void;
}) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1.5">
      {sections.map((section) => {
        const isActive = activeSection === section.id;
        const isMasterOnly = section.group === 'master';
        return (
          <button
            key={section.id}
            type="button"
            className={`flex min-h-[52px] w-[116px] shrink-0 items-center gap-2 rounded-full border px-2.5 py-2 text-left shadow-sm backdrop-blur transition active:scale-[0.98] ${
              isActive
                ? isMasterOnly
                  ? 'border-violet-400 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-violet-600/20'
                  : 'border-blue-400 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-600/20'
                : isMasterOnly
                  ? 'border-violet-200/70 bg-violet-500/8 text-violet-500'
                  : 'border-blue-200/70 bg-blue-500/8 text-blue-500'
            }`}
            onClick={() => onSelect(section.id)}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${
              isActive
                ? 'bg-white/18 text-white ring-white/25'
                : isMasterOnly
                  ? 'bg-violet-500/10 text-violet-500 ring-violet-500/15'
                  : 'bg-blue-500/10 text-blue-500 ring-blue-500/15'
            }`}>
              <SectionIcon id={section.id} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-black leading-none">{section.label}</span>
              <span className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ${isActive ? 'bg-white/15 text-white' : isMasterOnly ? 'bg-violet-500/10 text-violet-500' : 'bg-blue-500/10 text-blue-500'}`}>
                {isMasterOnly ? '관리자' : '공통'}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function SectionIcon({ id }: { id: SectionId }) {
  const common = 'h-4 w-4';
  if (id === 'calendar') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      </svg>
    );
  }
  if (id === 'calendarView') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5h16v15H4zM4 10h16M9 5v15M15 5v15" />
      </svg>
    );
  }
  if (id === 'wantedLeave') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z" />
      </svg>
    );
  }
  if (id === 'upload') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
      </svg>
    );
  }
  if (id === 'dayoff') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 7h8M7 12h10M9 17h6M5 4h14v16H5z" />
      </svg>
    );
  }
  if (id === 'logs') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 6h14M5 12h14M5 18h9" />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'slate' | 'emerald' }) {
  const tones = {
    blue: 'bg-blue-500/10 text-blue-500',
    slate: 'bg-violet-500/10 text-violet-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
  };
  return (
    <div className="rounded-2xl border app-border app-card p-3 shadow-sm sm:p-4">
      <p className="text-[11px] font-bold app-muted">{label}</p>
      <p className="mt-1 text-xl font-black tracking-tight app-text">{value}</p>
      <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${tones[tone]}`}>상태</span>
    </div>
  );
}

function DashboardMetrics({
  memberCount,
  dutyCount,
  actor,
  className = 'mb-4',
}: {
  memberCount: number;
  dutyCount: number;
  actor: Actor;
  className?: string;
}) {
  return (
    <div className={`${className} grid gap-3 sm:grid-cols-3`}>
      <MetricCard label="근무자" value={`${memberCount}명`} tone="blue" />
      <MetricCard label="등록 duty" value={`${dutyCount}건`} tone="slate" />
      <MetricCard label="접근 등급" value={`${actor.role === 'master' ? 'Master' : 'Member'} Lv.${actor.lv}`} tone="emerald" />
    </div>
  );
}

function StatusBanner({ message, tone }: { message: string; tone: 'success' | 'error' }) {
  const styles =
    tone === 'success'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
      : 'border-rose-500/20 bg-rose-500/10 text-rose-500';
  return <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold ${styles}`}>{message}</div>;
}

function TesterStatusCard({ testers, className = 'mb-4' }: { testers: TesterMember[]; className?: string }) {
  const tester = testers[0] ?? null;
  return (
    <section className={`${className} rounded-2xl border border-violet-200/70 bg-violet-500/10 p-3 shadow-sm sm:p-4`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-violet-500">Admin Only Tester</p>
          <h3 className="mt-1 text-sm font-black app-text">근무자 기능 점검용 계정</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-violet-600 px-2.5 py-1 text-xs font-black text-white">테스터</span>
          <span className="rounded-full app-card px-2.5 py-1 text-xs font-black app-text">
            {tester?.linked ? '가입 완료' : '가입 대기'}
          </span>
          <span className="rounded-full app-card px-2.5 py-1 text-xs font-black app-text">
            {tester?.hidden ? '비노출' : '비노출 예정'}
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs font-bold app-muted">
        {tester?.email ?? 'dev.jh2oon@gmail.com'} 계정은 일반 근무표/달력에 노출되지 않고 관리자에게만 테스터로 표시됩니다.
      </p>
    </section>
  );
}

function GradeAdminPanel({
  requests,
  onApprove,
  onReject,
}: {
  requests: MasterSignupRequest[];
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  return (
    <section className="rounded-3xl border app-border app-card shadow-sm">
      <div className="border-b app-border app-panel px-4 py-4 sm:px-5">
        <p className="text-[11px] font-black uppercase tracking-wide text-violet-500">Master Approval</p>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-black app-text">관리자 가입 승인</h3>
            <p className="mt-1 text-xs font-bold app-muted">SNS 인증 후 관리자 가입 요청은 기존 관리자가 승인해야만 로그인 가능합니다.</p>
          </div>
          <span className="w-fit rounded-full bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-500">
            승인 대기 {requests.length}건
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {requests.length ? (
          <div className="grid gap-3">
            {requests.map((request) => (
              <article key={request.id} className="rounded-2xl border app-border app-soft p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black app-text">{request.name}</span>
                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-black text-violet-500">Master Lv.{request.level}</span>
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-black text-blue-500">{request.provider.toUpperCase()}</span>
                    </div>
                    <p className="mt-1 truncate text-xs font-bold app-muted">{request.email}</p>
                    <p className="mt-1 text-[11px] font-bold app-muted">
                      요청일 {new Date(request.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
                      onClick={() => onApprove(request.id)}
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      className="h-8 rounded-lg border border-rose-200 bg-rose-500/10 px-3 text-xs font-black text-rose-500 transition hover:bg-rose-500/15"
                      onClick={() => onReject(request.id)}
                    >
                      거절
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="승인 대기 요청 없음" body="관리자 회원가입 요청이 들어오면 이 영역에서 승인 또는 거절할 수 있습니다." />
        )}

        <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-500/10 px-4 py-3 text-xs font-bold leading-5 text-amber-700">
          관리자는 회원가입 직후 pending 상태로 남고, 이 화면에서 승인된 뒤에만 master 계정으로 로그인됩니다.
        </div>
      </div>
    </section>
  );
}

function TodayDutySummary({
  summary,
}: {
  summary: {
    date: string;
    day: DutyCalendarDay | null;
    targetName: string;
    targetDuty: DutyCalendarDay['duties'][number] | null;
    targetShift: string;
    shiftGroups: Array<{ key: string; label: string; className: string; duties: DutyCalendarDay['duties'] }>;
    partners: DutyCalendarDay['duties'];
  };
}) {
  const targetMeta = getDutyMeta(summary.targetDuty?.dutyCode ?? '');
  return (
    <div className="border-b app-border app-panel px-3 py-3 sm:px-4">
      <div className="grid gap-3 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-2xl border border-emerald-200/70 bg-emerald-500/10 p-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-emerald-500">내 근무</p>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl app-card px-3 py-2">
            <span className="min-w-0 truncate text-sm font-black app-text">{summary.targetName}</span>
            {summary.targetDuty ? (
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${targetMeta.className}`}>
                {summary.targetDuty.dutyShortCode}
              </span>
            ) : (
              <span className="shrink-0 rounded-full app-soft px-2.5 py-1 text-xs font-black">근무 없음</span>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-violet-200/70 bg-violet-500/10 p-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-violet-500">같이 근무</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {summary.targetDuty ? (
              summary.partners.length ? (
                summary.partners.map((duty) => <DutyMiniChip key={duty.memberId} duty={duty} />)
              ) : (
                <span className="rounded-full app-card px-2.5 py-1 text-xs font-black app-muted">같은 {summary.targetShift} 근무 없음</span>
              )
            ) : (
              <span className="rounded-full app-card px-2.5 py-1 text-xs font-black app-muted">내 근무를 찾을 수 없음</span>
            )}
          </div>
        </article>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {summary.shiftGroups.map((group) => (
          <article key={group.key} className={`rounded-2xl p-3 ring-1 ${group.className}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="shrink-0 text-[11px] font-black uppercase tracking-wide">오늘 {group.label}</p>
                <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-black leading-none opacity-80">
                  {summary.date}
                </span>
              </div>
              <span className="rounded-full bg-white/35 px-2 py-0.5 text-[10px] font-black">{group.duties.length}명</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {summary.day ? (
                group.duties.length ? (
                  group.duties.map((duty) => <DutyMiniChip key={duty.memberId} duty={duty} />)
                ) : (
                  <span className="rounded-full app-card px-2.5 py-1 text-xs font-black app-muted">없음</span>
                )
              ) : (
                <span className="rounded-full app-card px-2.5 py-1 text-xs font-black app-muted">선택 월에 오늘 없음</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function DutyMiniChip({ duty }: { duty: DutyCalendarDay['duties'][number] }) {
  const meta = getDutyMeta(duty.dutyCode);
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full app-card px-2 py-1 text-xs font-black app-text shadow-sm ring-1 ring-white/20">
      <span className="min-w-0 truncate">{duty.memberName}</span>
      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ring-1 ${meta.className}`}>{duty.dutyShortCode}</span>
    </span>
  );
}

function GroupedDutyList({ duties }: { duties: DutyCalendarDay['duties'] }) {
  const groups = groupDutiesByShift(duties);
  return (
    <div className="space-y-1.5">
      {groups.map((group) => (
        <section key={group.key} className={`rounded-xl px-1.5 py-1 ring-1 ${group.className}`}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[9px] font-black uppercase tracking-wide">{group.label}</span>
            <span className="text-[9px] font-black opacity-70">{group.duties.length}</span>
          </div>
          <div className="space-y-1">
            {group.duties.map((duty) => (
              <div key={duty.memberId} className="calendar-duty-row flex items-center justify-between gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-black shadow-sm ring-1">
                <span className="min-w-0 truncate">{duty.memberName}</span>
                <span className="calendar-duty-code shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black">{duty.dutyShortCode}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'}
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DutyDayDetailSheet({
  detail,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: {
  detail: DutyDayDetail;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}) {
  const touchStartX = useRef<number | null>(null);
  const groups = groupDutiesByShift(detail.duties);
  const isToday = isTodayDate(detail.day.date);
  const holidayName = getKoreanPublicHolidayName(detail.day.date);

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    if (touchStartX.current === null) return;
    const deltaX = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < 48) return;
    if (deltaX < 0 && hasNext) onNext();
    if (deltaX > 0 && hasPrevious) onPrevious();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" onClick={onClose}>
      <section
        className="max-h-[88vh] w-full overflow-hidden rounded-t-3xl app-card app-text shadow-2xl sm:max-w-xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="border-b app-border app-panel px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-500">Duty Detail</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="text-2xl font-black">{detail.day.day}일 근무 상세</h3>
                {isToday && <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-amber-950 shadow-sm">TODAY</span>}
                {holidayName && <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white shadow-sm shadow-red-600/25">{holidayName}</span>}
              </div>
            </div>
            <button
              type="button"
              className="rounded-full border border-rose-300 bg-rose-500 px-3 py-1.5 text-xs font-black text-white shadow-sm shadow-rose-500/25 transition hover:bg-rose-600 active:scale-95"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border app-border app-card text-blue-600 shadow-sm transition hover:bg-blue-500/10 active:scale-95 disabled:opacity-35"
              onClick={onPrevious}
              disabled={!hasPrevious}
              aria-label="이전 날짜"
            >
              <ChevronIcon direction="left" />
            </button>
            <div className="flex min-w-0 flex-wrap justify-center gap-2">
              <span className="rounded-full app-card px-3.5 py-1.5 text-base font-black">{detail.day.date}</span>
              <span className="rounded-full app-card px-3.5 py-1.5 text-base font-black">{getWeekdayLabel(detail.day.weekday)}</span>
              <span className="rounded-full app-card px-3.5 py-1.5 text-base font-black">{detail.duties.length}명</span>
            </div>
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border app-border app-card text-blue-600 shadow-sm transition hover:bg-blue-500/10 active:scale-95 disabled:opacity-35"
              onClick={onNext}
              disabled={!hasNext}
              aria-label="다음 날짜"
            >
              <ChevronIcon direction="right" />
            </button>
          </div>
        </div>

        <div className="max-h-[58vh] overflow-y-auto p-3">
          {groups.length ? (
            <div className="grid grid-cols-2 gap-2">
              {groups.map((group) => (
                <section key={group.key} className={`min-w-0 rounded-xl p-2 ring-1 sm:rounded-2xl ${group.className}`}>
                  <div className="mb-1.5 flex items-center justify-between gap-1.5">
                    <h4 className="min-w-0 truncate text-[11px] font-black uppercase tracking-wide sm:text-xs">{group.label}</h4>
                    <span className="shrink-0 rounded-full bg-white/35 px-1.5 py-0.5 text-[10px] font-black">{group.duties.length}명</span>
                  </div>
                  <div className="grid gap-1">
                    {group.duties.map((duty) => (
                      <div key={duty.memberId} className="calendar-duty-row flex items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 shadow-sm ring-1">
                        <span className="min-w-0 truncate text-sm font-black">{duty.memberName}</span>
                        <span className="calendar-duty-code shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black">{duty.dutyShortCode}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl app-soft px-4 py-8 text-center text-sm font-black">{detail.emptyLabel}</div>
          )}
        </div>
        <div className="border-t app-border app-panel px-4 py-2 text-center text-xs font-black text-blue-500 sm:hidden">
          좌우로 스와이프하면 날짜별로 이동합니다
        </div>
      </section>
    </div>
  );
}

function DutyMonthGrid({
  dutyCalendar,
  isLoading,
  actor,
  actorName,
}: {
  dutyCalendar: DutyCalendarMonth | null;
  isLoading: boolean;
  actor: Actor;
  actorName: string;
}) {
  const [viewMode, setViewMode] = useState<'all' | 'mine' | 'member'>('all');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedDetailDate, setSelectedDetailDate] = useState<string | null>(null);
  const weekLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const normalizedActorName = actorName.trim().toLocaleLowerCase('ko-KR');
  const selectableMembers = useMemo(() => {
    const members = new Map<number, string>();
    dutyCalendar?.weeks.flat().forEach((day) => {
      day?.duties.forEach((duty) => members.set(duty.memberId, duty.memberName));
    });
    return Array.from(members, ([id, name]) => ({ id, name }));
  }, [dutyCalendar]);
  const selectedMemberName = selectableMembers.find((member) => String(member.id) === selectedMemberId)?.name ?? '';
  const detailDays = useMemo<DutyDayDetail[]>(() => {
    const emptyLabel = viewMode === 'mine' ? '내 근무 없음' : viewMode === 'member' ? '지정 근무 없음' : '미등록';
    return (dutyCalendar?.weeks.flat().filter((day): day is DutyCalendarDay => Boolean(day)) ?? []).map((day) => ({
      day,
      duties:
        viewMode === 'mine'
          ? day.duties.filter((duty) => duty.memberName.trim().toLocaleLowerCase('ko-KR') === normalizedActorName)
          : viewMode === 'member'
            ? day.duties.filter((duty) => String(duty.memberId) === selectedMemberId)
          : day.duties,
      emptyLabel,
    }));
  }, [dutyCalendar, normalizedActorName, selectedMemberId, viewMode]);
  const selectedDetailIndex = selectedDetailDate ? detailDays.findIndex((detail) => detail.day.date === selectedDetailDate) : -1;
  const selectedDetail = selectedDetailIndex >= 0 ? detailDays[selectedDetailIndex] : null;
  const showPreviousDetail = () => {
    if (selectedDetailIndex > 0) setSelectedDetailDate(detailDays[selectedDetailIndex - 1].day.date);
  };
  const showNextDetail = () => {
    if (selectedDetailIndex >= 0 && selectedDetailIndex < detailDays.length - 1) setSelectedDetailDate(detailDays[selectedDetailIndex + 1].day.date);
  };
  const todaySummary = useMemo(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayDay = dutyCalendar?.weeks.flat().find((day) => day?.date === todayKey) ?? null;
    const targetName = viewMode === 'member' && selectedMemberName ? selectedMemberName : actorName;
    const normalizedTargetName = targetName.trim().toLocaleLowerCase('ko-KR');
    const targetDuty = todayDay?.duties.find((duty) => duty.memberName.trim().toLocaleLowerCase('ko-KR') === normalizedTargetName) ?? null;
    const targetShift = targetDuty ? getShift(targetDuty.dutyCode.toUpperCase()) : '';
    return {
      date: todayKey,
      day: todayDay,
      targetName,
      targetDuty,
      targetShift,
      shiftGroups: [
        { key: 'day', label: 'Day', className: 'duty-day', duties: todayDay?.duties.filter((duty) => getShift(duty.dutyCode.toUpperCase()) === 'Day') ?? [] },
        { key: 'evening', label: 'Evening', className: 'duty-evening', duties: todayDay?.duties.filter((duty) => getShift(duty.dutyCode.toUpperCase()) === 'Evening') ?? [] },
        { key: 'mid', label: 'Mid', className: 'duty-mid', duties: todayDay?.duties.filter((duty) => getShift(duty.dutyCode.toUpperCase()) === 'Mid') ?? [] },
        { key: 'night', label: 'Night', className: 'duty-night', duties: todayDay?.duties.filter((duty) => getShift(duty.dutyCode.toUpperCase()) === 'Night') ?? [] },
      ],
      partners: targetShift
        ? todayDay?.duties.filter((duty) => getShift(duty.dutyCode.toUpperCase()) === targetShift && duty.memberId !== targetDuty?.memberId) ?? []
        : [],
    };
  }, [actorName, dutyCalendar, selectedMemberName, viewMode]);

  if (isLoading && !dutyCalendar?.weeks.length) {
    return (
      <section className="rounded-2xl border app-border app-card p-4 shadow-sm">
        <div className="h-8 w-40 animate-pulse rounded-xl app-soft" />
        <div className="mt-4 grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl app-soft" />
          ))}
        </div>
      </section>
    );
  }

  if (!dutyCalendar?.weeks.length) {
    return (
      <section className="rounded-2xl border app-border app-card shadow-sm">
        <EmptyState title="달력에 표시할 근무표가 없습니다" body="근무표를 업로드하면 날짜별 근무자와 근무타입 축약어가 달력에 표시됩니다." />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border app-border app-card shadow-sm">
      <div className="flex flex-col gap-3 border-b app-border app-panel px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-blue-500">Calendar View</p>
          <h3 className="mt-1 text-lg font-black app-text">
            {dutyCalendar.year}년 {dutyCalendar.month}월 달력보기
          </h3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="inline-flex w-fit rounded-2xl border app-border app-control p-1 shadow-sm">
            {([
              ['all', '전체보기'],
              ['mine', '내 근무만'],
              ...(actor.role === 'master' ? ([['member', '근무자 지정']] as const) : []),
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`h-8 rounded-xl px-3 text-xs font-black transition ${
                  viewMode === mode
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/20'
                    : 'app-muted hover:bg-blue-500/10 hover:text-blue-500'
                }`}
                onClick={() => {
                  setViewMode(mode);
                  if (mode === 'member' && !selectedMemberId && selectableMembers[0]) {
                    setSelectedMemberId(String(selectableMembers[0].id));
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {actor.role === 'master' && viewMode === 'member' && (
            <select
              className="h-9 w-full rounded-xl border app-border app-input px-3 text-xs font-black outline-none ring-blue-500 focus:ring-2 sm:w-40"
              value={selectedMemberId}
              onChange={(event) => setSelectedMemberId(event.target.value)}
              aria-label="근무자 선택"
            >
              {selectableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          )}
          <span className="w-fit rounded-full app-soft px-3 py-1 text-xs font-black">
            {viewMode === 'mine' ? `${actorName} 근무` : viewMode === 'member' ? `${selectedMemberName || '근무자'} 근무` : '이름 · 근무축약어'}
          </span>
        </div>
      </div>

      <TodayDutySummary summary={todaySummary} />

      <div className="overflow-x-hidden p-2 sm:p-4">
        <div className="w-full min-w-0">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {weekLabels.map((label, index) => (
              <div
                key={label}
                className={`min-w-0 rounded-lg border app-border px-1 py-2 text-center text-xs font-black sm:rounded-xl sm:px-3 ${
                  index === 0 ? 'date-sunday' : index === 6 ? 'date-saturday' : 'app-soft'
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1 sm:mt-2 sm:gap-2">
            {dutyCalendar.weeks.flatMap((week, weekIndex) =>
              week.map((day, dayIndex) => {
                if (!day) {
                  return <div key={`empty-${weekIndex}-${dayIndex}`} className="aspect-square min-w-0 rounded-xl border border-dashed app-border app-soft opacity-45 sm:aspect-auto sm:min-h-28 sm:rounded-2xl" />;
                }
                const detail = detailDays.find((item) => item.day.date === day.date);
                const duties = detail?.duties ?? [];
                const emptyLabel = detail?.emptyLabel ?? '미등록';
                return (
                  <article
                    key={day.date}
                    className={`aspect-square min-w-0 cursor-pointer rounded-xl border p-1 shadow-sm transition active:scale-[0.99] sm:aspect-auto sm:min-h-28 sm:rounded-2xl sm:p-2 ${
                      getCalendarDateClass(day.date, day.weekday) || 'app-panel app-border'
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDetailDate(day.date)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedDetailDate(day.date);
                      }
                    }}
                  >
                    <div className="flex h-full min-w-0 flex-col items-center justify-center gap-1 sm:h-auto sm:flex-row sm:justify-between sm:gap-2">
                      <span className="text-sm font-black sm:text-sm">{day.day}</span>
                      <span className="calendar-count-badge rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none sm:text-[10px]">
                        {duties.length}명
                      </span>
                    </div>
                    <div className="mt-2 hidden max-h-28 overflow-y-auto pr-1 sm:block">
                      {duties.length ? (
                        <GroupedDutyList duties={duties} />
                      ) : (
                        <p className="rounded-lg app-soft px-2 py-2 text-center text-[10px] font-bold">
                          {emptyLabel}
                        </p>
                      )}
                    </div>
                  </article>
                );
              }),
            )}
          </div>
        </div>
      </div>
      {selectedDetail && (
        <DutyDayDetailSheet
          detail={selectedDetail}
          onClose={() => setSelectedDetailDate(null)}
          onPrevious={showPreviousDetail}
          onNext={showNextDetail}
          hasPrevious={selectedDetailIndex > 0}
          hasNext={selectedDetailIndex >= 0 && selectedDetailIndex < detailDays.length - 1}
        />
      )}
    </section>
  );
}

function DutyCalendarTable({
  dutyMonth,
  dateKey,
  isLoading,
  canEdit,
  onChanged,
}: {
  dutyMonth: DutyMonth | null;
  dateKey: (day: number) => string;
  isLoading: boolean;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<{ member: DutyMember; day: number; code: string } | null>(null);
  const [memberEditing, setMemberEditing] = useState<DutyMember | null>(null);
  const [orderEditing, setOrderEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'member' | 'date'>('member');
  const [saving, setSaving] = useState(false);
  const members = dutyMonth?.members ?? [];

  async function saveDateDuty(nextCode: string) {
    if (!editing) return;
    setSaving(true);
    try {
      const response = await fetch(`${apiBaseUrl}/duties/${editing.member.id}/${dateKey(editing.day)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dutyCode: nextCode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? '근무 수정 실패');
      await onChanged();
      setEditing(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '근무 수정 실패');
    } finally {
      setSaving(false);
    }
  }

  async function saveMemberDuties(nextDuties: Record<string, string>) {
    if (!memberEditing || !dutyMonth) return;
    setSaving(true);
    try {
      const response = await fetch(`${apiBaseUrl}/duties/member/${memberEditing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duties: dutyMonth.days.map((day) => ({
            date: dateKey(day),
            dutyCode: nextDuties[dateKey(day)] ?? '',
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? '근무자 월별 수정 실패');
      await onChanged();
      setMemberEditing(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '근무자 월별 수정 실패');
    } finally {
      setSaving(false);
    }
  }

  async function saveMemberOrders(nextOrders: Record<number, string>) {
    setSaving(true);
    try {
      const response = await fetch(`${apiBaseUrl}/duties/members/order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: members.map((member) => ({
            memberId: member.id,
            sortOrder: nextOrders[member.id] === '' ? null : Number(nextOrders[member.id]),
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? '순번 저장 실패');
      await onChanged();
      setOrderEditing(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '순번 저장 실패');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading && !dutyMonth?.members.length) {
    return (
      <section className="rounded-2xl border app-border app-card p-4 shadow-sm">
        <DutyLegend />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-xl app-soft" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border app-border app-card shadow-sm" aria-busy={isLoading}>
      <DutyLegend />
      <div className="flex flex-col gap-3 border-b app-border app-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-xl border app-border app-control p-1">
          {([
            ['member', '이름별'],
            ['date', '날짜별'],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`h-8 rounded-lg px-3 text-xs font-black transition ${viewMode === mode ? 'bg-blue-600 text-white shadow-sm' : 'app-muted hover:bg-blue-500/10'}`}
              onClick={() => setViewMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        {canEdit && (
          <button
            type="button"
            className="h-8 w-fit rounded-lg border app-border app-control px-3 text-xs font-black shadow-sm hover:bg-blue-500/10"
            onClick={() => setOrderEditing(true)}
          >
            순번 관리
          </button>
        )}
      </div>
      <div className={`overflow-auto ${viewMode === 'date' ? 'max-h-[68vh] overscroll-contain md:max-h-none' : ''}`}>
        {viewMode === 'member' ? (
          <table className="w-full min-w-[1050px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 h-9 min-w-32 border-b border-r app-border app-soft px-3 py-0 text-left text-xs font-black">날짜</th>
                {dutyMonth?.days.map((day) => (
                  <th key={day} className={`sticky top-0 z-10 h-9 border-b border-r app-border px-3 py-0 text-xs font-black ${getDatePriorityClass(day, dutyMonth)}`}>{day}</th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 top-9 z-20 h-9 min-w-32 border-b border-r app-border app-soft px-3 py-0 text-left text-xs font-black">요일</th>
                {dutyMonth?.days.map((day) => (
                  <th key={`weekday-${day}`} className={`sticky top-9 z-10 h-9 border-b border-r app-border px-3 py-0 text-xs font-black ${getDatePriorityClass(day, dutyMonth)}`}>
                    {getWeekdayShort(day, dutyMonth)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{members.length ? members.map((member) => (
              <tr key={member.id} className="app-row-hover">
                <MemberNameCell member={member} canEdit={canEdit} onEdit={() => setMemberEditing(member)} />
                {dutyMonth?.days.map((day) => <DutyCodeCell key={day} member={member} day={day} dutyMonth={dutyMonth} dateKey={dateKey} canEdit={canEdit} onEdit={setEditing} />)}
              </tr>
            )) : <EmptyDutyRow days={dutyMonth?.days.length ?? 0} />}</tbody>
          </table>
        ) : (
          <table className="w-full min-w-[1050px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 min-w-24 border-b border-r app-border app-soft px-3 py-2 text-left text-xs font-black shadow-[2px_0_0_var(--app-border)]">날짜</th>
                {members.map((member) => (
                  <th key={member.id} className="sticky top-0 z-20 min-w-28 border-b border-r app-border app-soft px-3 py-2 text-xs font-black shadow-[0_2px_0_var(--app-border)]">{member.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>{dutyMonth?.days.length ? dutyMonth.days.map((day) => (
              <tr key={day} className="app-row-hover">
                <th className={`sticky left-0 z-10 border-b border-r px-3 py-2 text-left text-xs font-black shadow-[2px_0_0_var(--app-border)] ${getDatePriorityClass(day, dutyMonth) || 'app-panel app-border'}`}>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span>{day}일</span>
                    <span className="text-[11px] app-muted">{getWeekdayShort(day, dutyMonth)}</span>
                  </span>
                </th>
                {members.map((member) => <DutyCodeCell key={`${member.id}-${day}`} member={member} day={day} dutyMonth={dutyMonth} dateKey={dateKey} canEdit={canEdit} onEdit={setEditing} />)}
              </tr>
            )) : <EmptyDutyRow days={members.length} />}</tbody>
          </table>
        )}
      </div>
      {orderEditing && <MemberOrderModal members={members} saving={saving} onClose={() => setOrderEditing(false)} onSave={saveMemberOrders} />}
      {editing && (
        <DutyEditModal
          editing={editing}
          mode="date"
          saving={saving}
          onClose={() => setEditing(null)}
          onSaveDate={saveDateDuty}
        />
      )}
      {memberEditing && dutyMonth && (
        <DutyEditModal
          editing={{ member: memberEditing, day: 0, code: '' }}
          mode="member"
          days={dutyMonth.days}
          dateKey={dateKey}
          saving={saving}
          onClose={() => setMemberEditing(null)}
          onSaveMember={saveMemberDuties}
        />
      )}
    </section>
  );
}

function MemberNameCell({ member, canEdit, onEdit }: { member: DutyMember; canEdit: boolean; onEdit: () => void }) {
  return (
    <th className="sticky left-0 z-10 h-9 min-w-32 border-b border-r app-border app-panel px-3 py-0 text-left font-semibold">
      {canEdit ? (
        <button type="button" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-black text-blue-600 hover:bg-blue-500/10" onClick={onEdit}>
          <span>{member.name}</span>
          {member.sortOrder !== null && (
            <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-600">{member.sortOrder}</span>
          )}
        </button>
      ) : (
        member.name
      )}
    </th>
  );
}

function DutyCodeCell({
  member,
  day,
  dutyMonth,
  dateKey,
  canEdit,
  onEdit,
}: {
  member: DutyMember;
  day: number;
  dutyMonth: DutyMonth | null;
  dateKey: (day: number) => string;
  canEdit: boolean;
  onEdit: (editing: { member: DutyMember; day: number; code: string }) => void;
}) {
  const code = member.duties[dateKey(day)] ?? '';
  const meta = getDutyMeta(code);
  return (
    <td
      title={meta.label}
      className={`horizontal-text border-b border-r app-border px-2 py-2 text-center text-xs font-bold whitespace-nowrap ${getDutyCellClass(day, dutyMonth, meta.className)}`}
    >
      {canEdit ? (
        <button type="button" className="min-w-8 whitespace-nowrap rounded-lg px-1.5 py-0.5 font-black hover:bg-blue-500/10" onClick={() => onEdit({ member, day, code })}>
          {code || '-'}
        </button>
      ) : (
        <span className="whitespace-nowrap">{code}</span>
      )}
    </td>
  );
}

function EmptyDutyRow({ days }: { days: number }) {
  return (
    <tr>
      <td className="border-b app-border" colSpan={days + 1}>
        <EmptyState title="등록된 근무표가 없습니다" body="Master Lv.4 이상 계정으로 로그인하면 엑셀 업로드 메뉴에서 근무표를 등록할 수 있습니다." />
      </td>
    </tr>
  );
}

function MemberOrderModal({
  members,
  saving,
  onClose,
  onSave,
}: {
  members: DutyMember[];
  saving: boolean;
  onClose: () => void;
  onSave: (orders: Record<number, string>) => void | Promise<void>;
}) {
  const [orders, setOrders] = useState<Record<number, string>>(() =>
    Object.fromEntries(members.map((member) => [member.id, member.sortOrder === null ? '' : String(member.sortOrder)])),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
      <section className="w-full rounded-t-3xl app-card app-text p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-500">Sort Order</p>
            <h3 className="mt-1 text-xl font-black">근무자 순번 관리</h3>
            <p className="mt-1 text-xs app-muted">숫자가 있으면 순번 우선, 비우면 이름순으로 정렬됩니다.</p>
          </div>
          <button type="button" className="rounded-full app-soft px-3 py-1.5 text-xs font-black" onClick={onClose} disabled={saving}>
            닫기
          </button>
        </div>
        <div className="mt-5 max-h-[55vh] space-y-2 overflow-auto">
          {members.map((member) => (
            <label key={member.id} className="flex items-center gap-3 rounded-2xl border app-border app-panel px-3 py-2">
              <input
                className="h-8 w-16 rounded-lg border app-border app-input px-2 text-center text-xs font-black outline-none ring-blue-500 focus:ring-2"
                type="number"
                min="1"
                value={orders[member.id] ?? ''}
                onChange={(event) => setOrders((current) => ({ ...current, [member.id]: event.target.value }))}
              />
              <span className="text-sm font-black">{member.name}</span>
              <span className="ml-auto text-xs app-muted">현재 {member.sortOrder ?? '이름순'}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="mt-5 h-10 w-full rounded-xl bg-blue-600 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saving}
          onClick={() => void onSave(orders)}
        >
          {saving ? '저장 중' : '순번 저장'}
        </button>
      </section>
    </div>
  );
}

function DutyEditModal({
  editing,
  mode,
  days = [],
  dateKey,
  saving,
  onClose,
  onSaveDate,
  onSaveMember,
}: {
  editing: { member: DutyMember; day: number; code: string };
  mode: 'member' | 'date';
  days?: number[];
  dateKey?: (day: number) => string;
  saving: boolean;
  onClose: () => void;
  onSaveDate?: (code: string) => void | Promise<void>;
  onSaveMember?: (duties: Record<string, string>) => void | Promise<void>;
}) {
  const [code, setCode] = useState(editing.code);
  const [memberCodes, setMemberCodes] = useState<Record<string, string>>(() =>
    Object.fromEntries(days.map((day) => {
      const key = dateKey ? dateKey(day) : String(day);
      return [key, editing.member.duties[key] ?? ''];
    })),
  );
  const presets = ['D6', 'D5', 'E6', 'E5', 'M', 'N', 'OFF', '연차'];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
      <section className="w-full rounded-t-3xl app-card app-text p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-500">{mode === 'member' ? 'Member Monthly Edit' : 'Daily Duty Edit'}</p>
            <h3 className="mt-1 text-xl font-black">
              {mode === 'member' ? `${editing.member.name} 월별 근무 수정` : `${editing.member.name} / ${editing.day}일 근무 수정`}
            </h3>
            <p className="mt-1 text-xs app-muted">
              {mode === 'member' ? '이름 클릭 시 근무자 기준으로 날짜별 근무타입을 조정합니다.' : '일자 셀 클릭 시 해당 날짜의 근무타입만 조정합니다.'}
            </p>
          </div>
          <button type="button" className="rounded-full app-soft px-3 py-1.5 text-xs font-black hover:bg-blue-500/10" onClick={onClose} disabled={saving}>
            닫기
          </button>
        </div>

        {mode === 'member' ? (
          <div className="mt-5 max-h-[55vh] overflow-auto rounded-2xl border app-border">
            <table className="w-full border-separate border-spacing-0 text-xs">
              <tbody>
                {days.map((day) => {
                  const key = dateKey ? dateKey(day) : String(day);
                  const value = memberCodes[key] ?? '';
                  return (
                    <tr key={day}>
                      <th className="w-20 border-b app-border app-soft px-3 py-2 text-left font-black">{day}일</th>
                      <td className="border-b app-border px-3 py-2">
                        <select
                          className="h-8 w-full rounded-lg border app-border app-input px-2 text-xs font-bold"
                          value={value}
                          onChange={(event) => setMemberCodes((current) => ({ ...current, [key]: event.target.value }))}
                        >
                          <option value={value}>{value || '미지정'}</option>
                          {presets.map((preset) => (
                            <option key={preset} value={preset}>
                              {preset}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <label className="mt-5 block text-xs font-bold app-muted">근무 코드</label>
            <input
              className="mt-1.5 h-9 w-full rounded-xl border app-border app-input px-3 text-xs font-bold outline-none ring-blue-500 focus:ring-2"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="rounded-full app-soft px-3 py-1.5 text-xs font-black hover:bg-blue-500/10 hover:text-blue-500"
                  onClick={() => setCode(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          className="mt-5 h-10 w-full rounded-xl bg-blue-600 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saving}
          onClick={() => {
            if (mode === 'member') {
              void onSaveMember?.(memberCodes);
              return;
            }
            void onSaveDate?.(code);
          }}
        >
          {saving ? '저장 중' : '수정 적용'}
        </button>
      </section>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-5 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl app-soft text-xs font-black">Empty</div>
      <h3 className="mt-4 text-base font-black app-text">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 app-muted">{body}</p>
    </div>
  );
}

function getDatePriorityClass(day: number, dutyMonth?: DutyMonth | null) {
  const date = new Date(dutyMonth?.year ?? 2026, (dutyMonth?.month ?? 7) - 1, day);
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const today = new Date();
  if (isKoreanPublicHoliday(dateKey)) return 'date-holiday';
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return 'date-today';
  }
  if (date.getDay() === 6) return 'date-saturday';
  if (date.getDay() === 0) return 'date-sunday';
  return '';
}

function getCalendarDateClass(date: string, weekday: number) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (isKoreanPublicHoliday(date)) return 'date-holiday';
  if (date === todayKey) return 'date-today';
  if (weekday === 6) return 'date-saturday';
  if (weekday === 0) return 'date-sunday';
  return '';
}

function isKoreanPublicHoliday(date: string) {
  return koreanPublicHolidayNames.has(date);
}

function getKoreanPublicHolidayName(date: string) {
  return koreanPublicHolidayNames.get(date) ?? '';
}

function isTodayDate(date: string) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return date === todayKey;
}

function getWeekdayLabel(weekday: number) {
  return ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][weekday] ?? '';
}

function getWeekdayShort(day: number, dutyMonth?: DutyMonth | null) {
  const date = new Date(dutyMonth?.year ?? 2026, (dutyMonth?.month ?? 7) - 1, day);
  return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()] ?? '';
}

function getDutyCellClass(day: number, dutyMonth: DutyMonth | null | undefined, dutyClass: string) {
  const dateClass = getDatePriorityClass(day, dutyMonth);
  const textClass = dutyClass
    .split(' ')
    .filter((className) => !className.startsWith('duty-'))
    .map((className) => dutyTextClassMap[className] ?? className)
    .join(' ');
  const dutyTextClass = dutyClass
    .split(' ')
    .map((className) => dutyTextClassMap[className])
    .filter(Boolean)
    .join(' ');
  return [dateClass, dutyTextClass, textClass].filter(Boolean).join(' ');
}

const dutyTextClassMap: Record<string, string> = {
  'duty-day': 'duty-text-day',
  'duty-evening': 'duty-text-evening',
  'duty-mid': 'duty-text-mid',
  'duty-night': 'duty-text-night',
  'duty-charge': 'duty-text-charge',
  'duty-acting': 'duty-text-acting',
  'duty-off': 'duty-text-off',
  'duty-annual': 'duty-text-annual',
};

function groupDutiesByShift(duties: DutyCalendarDay['duties']) {
  const order = ['day', 'evening', 'mid', 'night', 'off', 'annual', 'etc'];
  const groupMap = new Map<string, { key: string; label: string; className: string; duties: DutyCalendarDay['duties'] }>();
  duties.forEach((duty) => {
    const group = getDutyGroupMeta(duty.dutyCode);
    const current = groupMap.get(group.key) ?? { ...group, duties: [] };
    current.duties.push(duty);
    groupMap.set(group.key, current);
  });
  return Array.from(groupMap.values()).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

function getDutyGroupMeta(code: string) {
  const normalized = code.trim();
  const upper = normalized.toUpperCase();
  if (upper === 'OFF' || normalized === '비번') {
    return { key: 'off', label: 'OFF', className: 'duty-off' };
  }
  if (normalized === '연차' || upper === 'AL' || upper === 'ANNUAL') {
    return { key: 'annual', label: '연차', className: 'duty-annual' };
  }
  const shift = getShift(upper);
  if (shift === 'Day') return { key: 'day', label: 'Day', className: 'duty-day' };
  if (shift === 'Evening') return { key: 'evening', label: 'Evening', className: 'duty-evening' };
  if (shift === 'Mid') return { key: 'mid', label: 'Mid', className: 'duty-mid' };
  if (shift === 'Night') return { key: 'night', label: 'Night', className: 'duty-night' };
  return { key: 'etc', label: '기타', className: 'app-soft' };
}

function DutyLegend() {
  const items = [
    { label: 'Day', className: 'duty-day' },
    { label: 'Evening', className: 'duty-evening' },
    { label: 'Mid', className: 'duty-mid' },
    { label: 'Night', className: 'duty-night' },
    { label: 'Charge', className: 'duty-charge' },
    { label: 'Acting', className: 'duty-acting' },
    { label: 'OFF', className: 'duty-off' },
    { label: '연차', className: 'duty-annual' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b app-border app-panel px-4 py-3">
      <span className="mr-1 text-xs font-bold uppercase tracking-wide app-muted">표식</span>
      {items.map((item) => (
        <span key={item.label} className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${item.className}`}>
          {item.label}
        </span>
      ))}
    </div>
  );
}

function UploadPanel({
  file,
  isLoading,
  progress,
  status,
  lastUpload,
  onFileChange,
  onUpload,
}: {
  file: File | null;
  isLoading: boolean;
  progress: number;
  status: UploadStatus;
  lastUpload: UploadResultSummary | null;
  onFileChange: (file: File | null) => void;
  onUpload: (event: FormEvent) => void;
}) {
  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    onFileChange(event.dataTransfer.files?.[0] ?? null);
  }

  const statusMeta = getUploadStatusMeta(status, progress, file, lastUpload);

  return (
    <section className="rounded-2xl border app-border app-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-blue-500">Excel Import</p>
          <h3 className="mt-1 text-xl font-black tracking-tight app-text">근무표 엑셀 업로드</h3>
          <p className="mt-1 text-sm app-muted">Master Lv.4 이상만 등록할 수 있습니다. `.xlsx`, `.xls`, `.csv`를 지원합니다.</p>
        </div>
        <span className="w-fit rounded-full bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-500">Master Lv.4+</span>
      </div>

      <form className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]" onSubmit={onUpload}>
        <label
          className="group flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed app-border app-soft px-5 text-center transition hover:border-blue-400"
          onDragOver={(event) => event.preventDefault()}
          onDrop={drop}
        >
          <input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} />
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl app-card text-xs font-black text-blue-500 shadow-sm transition group-hover:scale-105">
            XLS
          </span>
          <span className="mt-4 text-sm font-black app-text">{file ? file.name : '파일을 드래그하거나 클릭해서 선택'}</span>
          <span className="mt-1 text-xs app-muted">
            {file ? `${(file.size / 1024).toFixed(1)} KB` : '근무표 날짜 행과 성명 열을 자동 감지합니다.'}
          </span>
        </label>

        <div className="rounded-2xl border app-border app-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black app-text">업로드 상태</p>
              <p className="mt-1 text-xs leading-5 app-muted">파일 등록 후 월별 달력에 자동 반영됩니다.</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${statusMeta.badgeClass}`}>{statusMeta.badge}</span>
          </div>

          <div className={`mt-4 rounded-xl border px-3 py-3 ${statusMeta.panelClass}`}>
            <p className="text-sm font-black">{statusMeta.title}</p>
            <p className="mt-1 text-xs font-semibold leading-5">{statusMeta.description}</p>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full app-soft">
            <div className={`h-full rounded-full transition-all duration-300 ${statusMeta.barClass}`} style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs font-bold app-muted">{statusMeta.progressLabel}</p>
          <button
            className="mt-5 h-10 w-full rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={isLoading || !file}
          >
            {isLoading ? '업로드 중' : '근무표 등록'}
          </button>
          {file && (
            <button
              type="button"
              className="mt-2 h-9 w-full rounded-xl app-soft text-sm font-bold transition hover:bg-blue-500/10"
              onClick={() => onFileChange(null)}
            >
              파일 제거
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function getUploadStatusMeta(status: UploadStatus, progress: number, file: File | null, lastUpload: UploadResultSummary | null) {
  if (status === 'uploading') {
    return {
      badge: '처리 중',
      title: '엑셀 데이터를 등록하는 중입니다.',
      description: file ? `${file.name} 파일을 분석하고 월별 달력을 갱신합니다.` : '파일을 분석하고 월별 달력을 갱신합니다.',
      progressLabel: `${progress}% 진행`,
      badgeClass: 'bg-blue-500/10 text-blue-600',
      panelClass: 'border-blue-200 bg-blue-500/10 text-blue-700',
      barClass: 'bg-blue-600',
    };
  }

  if (status === 'success' && lastUpload) {
    return {
      badge: '등록 완료',
      title: `${lastUpload.savedCount}건 등록 완료`,
      description: `${lastUpload.year}년 ${lastUpload.month}월 근무표가 달력에 반영되었습니다.`,
      progressLabel: '100% 완료',
      badgeClass: 'bg-emerald-500/10 text-emerald-600',
      panelClass: 'border-emerald-200 bg-emerald-500/10 text-emerald-700',
      barClass: 'bg-emerald-600',
    };
  }

  if (status === 'error') {
    return {
      badge: '확인 필요',
      title: '업로드를 완료하지 못했습니다.',
      description: file ? '파일을 확인한 뒤 다시 등록해 주세요.' : '등록할 파일을 먼저 선택해 주세요.',
      progressLabel: '진행 없음',
      badgeClass: 'bg-rose-500/10 text-rose-600',
      panelClass: 'border-rose-200 bg-rose-500/10 text-rose-700',
      barClass: 'bg-rose-600',
    };
  }

  if (status === 'selected' && file) {
    return {
      badge: '준비됨',
      title: '등록할 파일이 선택되었습니다.',
      description: '근무표 등록 버튼을 누르면 날짜 행과 성명 열을 자동 감지합니다.',
      progressLabel: '시작 전',
      badgeClass: 'bg-sky-500/10 text-sky-600',
      panelClass: 'border-sky-200 bg-sky-500/10 text-sky-700',
      barClass: 'bg-sky-600',
    };
  }

  return {
    badge: '대기',
    title: '등록 대기 중',
    description: '엑셀 파일을 선택하면 업로드 준비 상태로 전환됩니다.',
    progressLabel: '대기 중',
    badgeClass: 'app-soft',
    panelClass: 'app-border app-soft',
    barClass: 'bg-blue-600',
  };
}

function UploadLogs({ logs }: { logs: UploadLog[] }) {
  return (
    <section className="rounded-2xl border app-border app-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-blue-500">Audit</p>
          <h3 className="mt-1 text-xl font-black tracking-tight app-text">업로드 기록</h3>
        </div>
        <span className="rounded-full app-soft px-3 py-1 text-xs font-black">최근 30건</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {logs.length ? (
          logs.map((log) => (
            <article key={log.id} className="rounded-2xl border app-border app-panel p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <strong className="block truncate text-sm app-text">{log.originalName}</strong>
              <span className="mt-2 block text-sm app-muted">
                {log.targetYear}.{String(log.targetMonth).padStart(2, '0')} / {log.rowCount}건
              </span>
              <span className="mt-1 block text-xs app-muted">{new Date(log.createdAt).toLocaleString()}</span>
            </article>
          ))
        ) : (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState title="업로드 기록이 없습니다" body="엑셀 업로드가 완료되면 파일명, 대상 월, 등록 건수가 이곳에 쌓입니다." />
          </div>
        )}
      </div>
    </section>
  );
}

function PlaceholderPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border app-border app-card p-6 shadow-sm">
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">준비 중</span>
      <h3 className="mt-4 text-xl font-black tracking-tight app-text">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 app-muted">{body}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {['권한 정책 연결', '입력 폼 설계', '승인 이력 저장'].map((item) => (
          <div key={item} className="rounded-xl app-soft px-3 py-3 text-xs font-bold">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function canAccess(actor: Actor, section: SectionPolicy) {
  if (actor.role === 'master') {
    return section.minMasterLv !== undefined && actor.lv >= section.minMasterLv;
  }
  return section.minMemberLv !== undefined && actor.lv >= section.minMemberLv;
}

function getDutyMeta(code: string) {
  const normalized = code.trim();
  const upper = normalized.toUpperCase();
  if (!normalized) return { label: '', className: 'app-muted' };
  if (upper === 'OFF' || normalized === '비번') {
    return { label: 'OFF', className: 'duty-off' };
  }
  if (normalized === '연차' || upper === 'AL' || upper === 'ANNUAL') {
    return { label: '연차', className: 'duty-annual' };
  }

  const shift = getShift(upper);
  const workType = getWorkType(upper);
  const label = [shift, workType].filter(Boolean).join(' / ') || normalized;
  const className = getShiftClass(shift, workType);
  return { label, className };
}

function getShift(upper: string) {
  if (upper.startsWith('DAY') || upper.startsWith('D')) return 'Day';
  if (upper.startsWith('EVENING') || upper.startsWith('E')) return 'Evening';
  if (upper.startsWith('MID') || upper.startsWith('M')) return 'Mid';
  if (upper.startsWith('NIGHT') || upper.startsWith('N')) return 'Night';
  return '';
}

function getWorkType(upper: string) {
  if (upper.includes('CHARGE') || upper.includes('C')) return 'Charge';
  if (upper.includes('ACTING') || upper.includes('A')) return 'Acting';
  return '';
}

function getShiftClass(shift: string, workType: string) {
  const weight = workType === 'Charge' ? 'font-extrabold' : '';
  if (shift === 'Day') return `duty-day ${weight}`;
  if (shift === 'Evening') return `duty-evening ${weight}`;
  if (shift === 'Mid') return `duty-mid ${weight}`;
  if (shift === 'Night') return `duty-night ${weight}`;
  if (workType === 'Charge') return 'duty-charge font-extrabold';
  if (workType === 'Acting') return 'duty-acting';
  return 'app-text';
}
