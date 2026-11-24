'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Users,
  Map as MapIcon,
  LogOut,
  Key,
  Trophy,
  Edit2,
  UserMinus,
  Sparkles,
  Shield,
  Crown,
  Share2,
  Check,
  Plus,
  Compass,
  Award,
  Flame,
  Beer,
  Wine,
  UserCheck,
  ChevronRight,
  Settings
} from 'lucide-react';
import {
  registerUser,
  loginUser,
  updateUserProfile,
  createTeam,
  joinTeam,
  fetchBarsOSM,
  toggleVisit,
  getTeamVisits,
  getUserVisits,
  getTeamDetails,
  leaveTeam,
  updateTeamDetails,
  setMemberRole,
  kickMember,
  getLeaderboard
} from './actions';

const InteractiveMap = dynamic(() => import('./components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center text-amber-500 font-bold bg-slate-950 gap-3">
      <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
      <p className="tracking-widest text-sm uppercase">Inicjalizacja radaru OpenStreetMap...</p>
    </div>
  )
});

const AVAILABLE_AVATARS = ['🍺', '🍸', '🍷', '🥃', '⚡', '🦁', '🐺', '👑', '🎯', '🚀', '💀', '👾', '🕶️', '🔥', '🐉', '🕺'];
const AVAILABLE_BADGES = ['⚡', '🍺', '👑', '🐺', '🦁', '💀', '🎯', '🚀', '🌪️', '🛡️', '🔥', '🦅'];
const AVAILABLE_COLORS = [
  { id: 'amber', name: 'Złoty Amber', border: 'border-amber-500/50', bg: 'bg-amber-500/10', text: 'text-amber-400', shadow: 'shadow-amber-500/20', from: 'from-amber-400 to-orange-500' },
  { id: 'emerald', name: 'Szmaragd', border: 'border-emerald-500/50', bg: 'bg-emerald-500/10', text: 'text-emerald-400', shadow: 'shadow-emerald-500/20', from: 'from-emerald-400 to-teal-500' },
  { id: 'violet', name: 'Neon Violet', border: 'border-violet-500/50', bg: 'bg-violet-500/10', text: 'text-violet-400', shadow: 'shadow-violet-500/20', from: 'from-violet-400 to-purple-600' },
  { id: 'cyan', name: 'Cyber Cyan', border: 'border-cyan-500/50', bg: 'bg-cyan-500/10', text: 'text-cyan-400', shadow: 'shadow-cyan-500/20', from: 'from-cyan-400 to-blue-500' },
  { id: 'rose', name: 'Neon Rose', border: 'border-rose-500/50', bg: 'bg-rose-500/10', text: 'text-rose-400', shadow: 'shadow-rose-500/20', from: 'from-rose-400 to-red-500' }
];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'login' | 'register' | 'map' | 'profile' | 'team' | 'rankings'>('login');

  const [nick, setNick] = useState('');
  const [pass, setPass] = useState('');
  const [regAvatar, setRegAvatar] = useState('🍺');
  const [regDrink, setRegDrink] = useState('Piwo rzemieślnicze');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [city, setCity] = useState('Rzeszów');
  const [customCityInput, setCustomCityInput] = useState('');
  const [showCustomCity, setShowCustomCity] = useState(false);
  const [bars, setBars] = useState<any[]>([]);
  const [mapCenter, setMapCenter] = useState<any>(null);
  const [teamVisits, setTeamVisits] = useState<string[]>([]);
  const [userVisits, setUserVisits] = useState<string[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);

  const [teamDetails, setTeamDetails] = useState<any>(null);
  const [joinCode, setJoinCode] = useState('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Stany edycji profilu
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState('🍺');
  const [profileTitle, setProfileTitle] = useState('Nowicjusz Barowy');
  const [profileBio, setProfileBio] = useState('Gotowy na nocny szlak!');
  const [profileDrink, setProfileDrink] = useState('Piwo rzemieślnicze');

  // Stany tworzenia/edycji ekipy
  const [createTeamModal, setCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamMotto, setNewTeamMotto] = useState('Nigdy nie pijemy sami!');
  const [newTeamBadge, setNewTeamBadge] = useState('⚡');
  const [newTeamColor, setNewTeamColor] = useState('amber');

  const [editTeamModal, setEditTeamModal] = useState(false);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamMotto, setEditTeamMotto] = useState('');
  const [editTeamBadge, setEditTeamBadge] = useState('⚡');
  const [editTeamColor, setEditTeamColor] = useState('amber');

  const [copiedCode, setCopiedCode] = useState(false);

  // Inicjalizacja sesji z localStorage i geolokalizacji
  useEffect(() => {
    const saved = localStorage.getItem('barpulse_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        setProfileAvatar(u.avatar || '🍺');
        setProfileTitle(u.title || 'Nowicjusz Barowy');
        setProfileBio(u.bio || 'Gotowy na nocny szlak!');
        setProfileDrink(u.favoriteDrink || 'Piwo rzemieślnicze');
        setView('map');
      } catch {}
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => console.log('Brak zgody na GPS')
      );
    }
  }, []);

  const handleAuth = async (isLogin: boolean) => {
    setLoading(true);
    setError('');
    try {
      const res = isLogin
        ? await loginUser(nick, pass)
        : await registerUser(nick, pass, regAvatar, 'Nowicjusz Barowy', regDrink);
      setUser(res);
      setProfileAvatar(res.avatar || '🍺');
      setProfileTitle(res.title || 'Nowicjusz Barowy');
      setProfileBio(res.bio || 'Gotowy na nocny szlak!');
      setProfileDrink(res.favoriteDrink || 'Piwo rzemieślnicze');
      localStorage.setItem('barpulse_user', JSON.stringify(res));
      setView(res.teamId ? 'map' : 'team');
    } catch (e: any) {
      setError(e.message || 'Wystąpił błąd');
    }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('barpulse_user');
    setUser(null);
    setView('login');
  };

  // Pobieranie danych mapy i wizyt
  useEffect(() => {
    if (view === 'map') {
      setLoading(true);
      fetchBarsOSM(city)
        .then(data => {
          setMapCenter(data.center);
          setBars(data.bars);
        })
        .finally(() => setLoading(false));

      if (user?.teamId) {
        getTeamVisits(user.teamId).then(setTeamVisits);
      }
      if (user?.id) {
        getUserVisits(user.id).then(setUserVisits);
      }
    }
  }, [view, city, user]);

  // Pobieranie szczegółów ekipy i rankingu
  useEffect(() => {
    if ((view === 'team' || view === 'profile') && user?.teamId) {
      getTeamDetails(user.teamId).then(data => {
        if (data) {
          setTeamDetails(data);
          setEditTeamName(data.name);
          setEditTeamMotto(data.motto);
          setEditTeamBadge(data.badge);
          setEditTeamColor(data.color);
        }
      });
    }
    if (view === 'rankings') {
      getLeaderboard(city).then(setLeaderboard);
    }
  }, [view, user, city]);

  const handleToggleVisit = async (bar: any) => {
    if (!user) return;
    const isNowVisited = await toggleVisit(user.id, bar.osmId, bar.name);
    setTeamVisits(prev => (isNowVisited ? [...prev, bar.osmId] : prev.filter(id => id !== bar.osmId)));
    setUserVisits(prev => (isNowVisited ? [...prev, bar.osmId] : prev.filter(id => id !== bar.osmId)));
    if (user.teamId) {
      getTeamDetails(user.teamId).then(setTeamDetails);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const updated = await updateUserProfile(user.id, {
        avatar: profileAvatar,
        title: profileTitle,
        bio: profileBio,
        favoriteDrink: profileDrink
      });
      setUser({ ...user, ...updated });
      localStorage.setItem('barpulse_user', JSON.stringify({ ...user, ...updated }));
      setEditProfileModal(false);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  };

  const handleCreateTeam = async () => {
    if (!user || !newTeamName.trim()) return;
    setLoading(true);
    try {
      const t = await createTeam(user.id, newTeamName.trim(), city, newTeamBadge, newTeamColor, newTeamMotto);
      const updatedUser = { ...user, teamId: t.id, teamRole: 'OWNER' };
      setUser(updatedUser);
      localStorage.setItem('barpulse_user', JSON.stringify(updatedUser));
      setTeamDetails(await getTeamDetails(t.id));
      setCreateTeamModal(false);
      setView('team');
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  };

  const handleSaveTeamDetails = async () => {
    if (!user || !user.teamId) return;
    setLoading(true);
    try {
      await updateTeamDetails(user.teamId, user.id, {
        name: editTeamName,
        motto: editTeamMotto,
        badge: editTeamBadge,
        color: editTeamColor
      });
      setTeamDetails(await getTeamDetails(user.teamId));
      setEditTeamModal(false);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  };

  const handleLeaveTeam = async () => {
    if (!confirm('Czy na pewno chcesz opuścić ekipę?')) return;
    await leaveTeam(user.id);
    const updatedUser = { ...user, teamId: null, teamRole: 'MEMBER' };
    setUser(updatedUser);
    localStorage.setItem('barpulse_user', JSON.stringify(updatedUser));
    setTeamDetails(null);
  };

  const handleKick = async (memberId: string) => {
    if (!confirm('Czy na pewno chcesz wyrzucić tego członka z ekipy?')) return;
    await kickMember(user.teamId, user.id, memberId);
    setTeamDetails(await getTeamDetails(user.teamId));
  };

  const handleToggleOfficer = async (memberId: string, currentRole: string) => {
    const newRole = currentRole === 'OFFICER' ? 'MEMBER' : 'OFFICER';
    await setMemberRole(user.teamId, user.id, memberId, newRole);
    setTeamDetails(await getTeamDetails(user.teamId));
  };

  const handleCopyCode = () => {
    if (teamDetails?.code) {
      navigator.clipboard.writeText(teamDetails.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCustomCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customCityInput.trim()) {
      setCity(customCityInput.trim());
      setShowCustomCity(false);
    }
  };

  // Kolorystyka ekipy
  const currentTeamColor = AVAILABLE_COLORS.find(c => c.id === teamDetails?.color) || AVAILABLE_COLORS[0];

  // --- EKRANY AUTORYZACJI ---
  if (view === 'login' || view === 'register') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-2xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          {/* Poświata w tle */}
          <div className="absolute -top-24 -left-24 w-60 h-60 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-orange-600/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="text-center mb-8 relative">
            <span className="text-4xl mb-2 inline-block animate-bounce">⚡</span>
            <h1 className="text-5xl font-black bg-gradient-to-br from-amber-400 via-orange-500 to-amber-300 bg-clip-text text-transparent tracking-tight">
              BARPULSE
            </h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
              Radar Nocnego Życia & Ekip
            </p>
          </div>

          <div className="space-y-4 relative">
            <input
              type="text"
              placeholder="Twój Nick"
              value={nick}
              onChange={e => setNick(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-amber-500 transition"
            />
            <input
              type="password"
              placeholder="Hasło"
              value={pass}
              onChange={e => setPass(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-amber-500 transition"
            />

            {/* Dodatkowa customizacja przy rejestracji */}
            {view === 'register' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1.5">Wybierz swój awatar:</label>
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {AVAILABLE_AVATARS.map(av => (
                      <button
                        key={av}
                        type="button"
                        onClick={() => setRegAvatar(av)}
                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition flex-shrink-0 ${
                          regAvatar === av ? 'bg-amber-500/20 border-2 border-amber-400 scale-110' : 'bg-slate-950/60 border border-white/5'
                        }`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Ulubiony trunek:</label>
                  <input
                    type="text"
                    value={regDrink}
                    onChange={e => setRegDrink(e.target.value)}
                    placeholder="np. Craft IPA, Whisky Sour..."
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-red-400 text-xs text-center font-bold">{error}</p>}

            <button
              onClick={() => handleAuth(view === 'login')}
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black py-4 rounded-2xl shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
            >
              {loading ? 'Przetwarzanie...' : view === 'login' ? 'WEJDŹ DO GRY' : 'STWÓRZ PROFIL'}
            </button>

            <p
              className="text-center text-slate-400 text-xs mt-4 cursor-pointer hover:text-white transition font-semibold"
              onClick={() => {
                setError('');
                setView(view === 'login' ? 'register' : 'login');
              }}
            >
              {view === 'login' ? 'Nie masz jeszcze konta? Zarejestruj się.' : 'Masz już profil? Zaloguj się.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- GŁÓWNA APLIKACJA ---
  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* NAGŁÓWEK GŁÓWNY */}
      <header className="absolute top-0 w-full bg-slate-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex justify-between items-center z-[1000]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <h1 className="font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent text-xl tracking-wider">
            BARPULSE
          </h1>
        </div>

        {/* WYBÓR MIASTA */}
        <div className="flex items-center gap-2">
          {showCustomCity ? (
            <form onSubmit={handleCustomCitySubmit} className="flex items-center gap-1">
              <input
                type="text"
                value={customCityInput}
                onChange={e => setCustomCityInput(e.target.value)}
                placeholder="Wpisz miasto..."
                className="bg-slate-900 border border-amber-500/50 text-white px-3 py-1.5 rounded-xl text-xs font-bold outline-none w-32"
                autoFocus
              />
              <button type="submit" className="px-2.5 py-1.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-black">
                OK
              </button>
              <button
                type="button"
                onClick={() => setShowCustomCity(false)}
                className="px-2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 rounded-xl p-1">
              <select
                value={city}
                onChange={e => {
                  if (e.target.value === '__custom__') {
                    setShowCustomCity(true);
                  } else {
                    setCity(e.target.value);
                  }
                }}
                className="bg-transparent text-amber-400 px-3 py-1 text-xs font-black outline-none cursor-pointer"
              >
                <option value="Rzeszów" className="bg-slate-900 text-white">Rzeszów</option>
                <option value="Kraków" className="bg-slate-900 text-white">Kraków</option>
                <option value="Warszawa" className="bg-slate-900 text-white">Warszawa</option>
                <option value="Wrocław" className="bg-slate-900 text-white">Wrocław</option>
                <option value="Gdańsk" className="bg-slate-900 text-white">Gdańsk</option>
                <option value="Poznań" className="bg-slate-900 text-white">Poznań</option>
                <option value="__custom__" className="bg-slate-900 text-amber-400 font-bold">+ Inne miasto...</option>
              </select>
            </div>
          )}

          {/* Szybki podgląd profilu użytkownika */}
          <button
            onClick={() => setView('profile')}
            className="flex items-center gap-2 bg-slate-900/90 border border-white/10 hover:border-amber-500/40 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
            title="Twój profil"
          >
            <span className="text-base">{user?.avatar || '🍺'}</span>
            <span className="text-xs font-bold text-slate-300 hidden sm:inline">{user?.nickname}</span>
          </button>
        </div>
      </header>

      {/* GŁÓWNA ZAWARTOŚĆ STRONY */}
      <main className="flex-1 relative pt-[60px]">
        {/* WIDOK: RADAR / MAPA OSM */}
        {view === 'map' && (
          <div className="absolute inset-0">
            {loading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur text-amber-500 font-bold text-sm gap-2">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                Skanowanie obiektów w {city}...
              </div>
            )}
            <InteractiveMap
              bars={bars}
              center={mapCenter}
              teamVisits={teamVisits}
              onToggleVisit={handleToggleVisit}
              userLoc={userLoc}
              cityName={city}
            />
          </div>
        )}

        {/* WIDOK: PROFIL UŻYTKOWNIKA */}
        {view === 'profile' && (
          <div className="h-full overflow-y-auto p-4 sm:p-8 max-w-2xl mx-auto pb-24 space-y-6">
            {/* Karta Główna Profilu */}
            <div className="bg-slate-900/80 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-600 rounded-3xl flex items-center justify-center text-4xl shadow-xl shadow-amber-500/20 flex-shrink-0">
                    {user?.avatar || '🍺'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-2xl font-black text-white">{user?.nickname}</h2>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {user?.title || 'Nowicjusz Barowy'}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs italic mb-2">&ldquo;{user?.bio || 'Gotowy na nocny szlak!'}&rdquo;</p>
                    <div className="flex items-center gap-2 text-xs text-amber-400 font-bold">
                      <Beer size={14} /> Ulubiony trunek: <span className="text-white font-medium">{user?.favoriteDrink || 'Piwo rzemieślnicze'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:self-start">
                  <button
                    onClick={() => setEditProfileModal(true)}
                    className="p-3 bg-slate-800 text-amber-400 hover:bg-slate-700 rounded-2xl border border-white/5 transition flex items-center gap-1.5 text-xs font-bold"
                  >
                    <Edit2 size={16} /> Edytuj
                  </button>
                  <button
                    onClick={logout}
                    className="p-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-2xl transition"
                    title="Wyloguj się"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>

              {/* Pasek Osobistych Osiągnięć */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800">
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 text-center">
                  <div className="text-2xl font-black text-amber-400">{userVisits.length}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Odwiedzonych barów</div>
                </div>
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 text-center">
                  <div className="text-2xl font-black text-emerald-400">
                    {teamDetails?.totalScore ? Math.round((userVisits.length / Math.max(teamDetails.totalScore, 1)) * 100) : 100}%
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Wkład w ekipę</div>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 text-center">
                  <div className="text-2xl font-black text-purple-400">{city}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Aktywny rewir</div>
                </div>
              </div>
            </div>

            {/* Sekcja Odznak i Rangi */}
            <div className="bg-slate-900/60 border border-white/5 rounded-[2rem] p-6">
              <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Award className="text-amber-500" size={18} /> Twoje Odznaki Barowe
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { title: 'Pierwszy Kufel', desc: 'Oznacz 1 bar', unlocked: userVisits.length >= 1, icon: '🍺' },
                  { title: 'Nocny Szlak', desc: 'Oznacz 5 barów', unlocked: userVisits.length >= 5, icon: '⚡' },
                  { title: 'Mistrz Miasta', desc: 'Oznacz 10 barów', unlocked: userVisits.length >= 10, icon: '👑' },
                  { title: 'Legenda Nocy', desc: 'Oznacz 20 barów', unlocked: userVisits.length >= 20, icon: '🔥' }
                ].map((badge, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border text-center transition ${
                      badge.unlocked
                        ? 'bg-amber-500/10 border-amber-500/30 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-600 opacity-60'
                    }`}
                  >
                    <div className="text-2xl mb-1">{badge.icon}</div>
                    <div className="text-xs font-black">{badge.title}</div>
                    <div className="text-[9px] text-slate-400">{badge.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skrót do Ekipy */}
            {user?.teamId && teamDetails && (
              <div
                onClick={() => setView('team')}
                className="bg-slate-900/60 hover:bg-slate-900 border border-white/5 p-5 rounded-2xl flex items-center justify-between cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{teamDetails.badge}</span>
                  <div>
                    <h4 className="font-black text-white text-base">{teamDetails.name}</h4>
                    <p className="text-xs text-slate-400">Poziom {teamDetails.level} • {teamDetails.members.length} członków</p>
                  </div>
                </div>
                <ChevronRight className="text-amber-500" />
              </div>
            )}
          </div>
        )}

        {/* WIDOK: EKIPA (CUSTOMIZACJA & ZARZĄDZANIE) */}
        {view === 'team' && (
          <div className="h-full overflow-y-auto p-4 sm:p-8 max-w-2xl mx-auto pb-24 space-y-6">
            {user?.teamId && teamDetails ? (
              <>
                {/* Baner Ekipy z wybranym motywem */}
                <div className={`p-6 rounded-[2.5rem] border ${currentTeamColor.border} ${currentTeamColor.bg} shadow-2xl relative overflow-hidden`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-center text-3xl shadow-lg">
                        {teamDetails.badge}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl sm:text-3xl font-black text-white">{teamDetails.name}</h2>
                          {teamDetails.ownerId === user.id && (
                            <button
                              onClick={() => setEditTeamModal(true)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 transition rounded-lg"
                              title="Edytuj ekipę"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 italic">&ldquo;{teamDetails.motto}&rdquo;</p>
                        <div className="text-[11px] font-bold text-amber-400 mt-1 uppercase tracking-wider">
                          Rewir: {teamDetails.region} • Poziom {teamDetails.level}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KOD ZAPROSZENIA Z KOPIOWANIEM */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-950/70 rounded-2xl border border-white/10 mt-4">
                    <div className="flex items-center gap-2">
                      <Key className="text-amber-400" size={18} />
                      <span className="text-xs text-slate-300 font-medium">Kod zaproszenia ekipy:</span>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-2 font-mono font-black text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/30 text-sm tracking-widest transition"
                    >
                      {teamDetails.code}
                      {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                    </button>
                  </div>
                </div>

                {/* STATYSTYKI EKIPY */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 text-center">
                    <div className="text-2xl font-black text-amber-400">{teamDetails.totalScore}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Zdobyte bary</div>
                  </div>
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 text-center">
                    <div className="text-2xl font-black text-white">{teamDetails.members.length}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Członków ekipy</div>
                  </div>
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 text-center">
                    <div className="text-2xl font-black text-emerald-400">Lvl {teamDetails.level}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ranga ekipy</div>
                  </div>
                </div>

                {/* SKŁAD EKIPY Z ROLAMI I CUSTOMIZACJĄ */}
                <div className="bg-slate-900/60 border border-white/5 rounded-[2rem] p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider">
                      SKŁAD EKIPY ({teamDetails.members.length})
                    </h3>
                    {teamDetails.ownerId === user.id && (
                      <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                        <Crown size={13} /> Jesteś Liderem
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {teamDetails.members.map((member: any) => {
                      const isOwner = member.teamRole === 'OWNER';
                      const isOfficer = member.teamRole === 'OFFICER';
                      const isMe = member.id === user.id;
                      const canManage = teamDetails.ownerId === user.id && !isMe;

                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl flex-shrink-0">
                              {member.avatar || '🍺'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm text-white">{member.nickname}</span>
                                {isMe && <span className="text-[10px] text-amber-400 font-bold">(Ty)</span>}
                                {isOwner && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                                    <Crown size={10} /> Lider
                                  </span>
                                )}
                                {isOfficer && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-0.5">
                                    <Shield size={10} /> Oficer
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                <span>{member.title}</span>
                                <span>•</span>
                                <span className="text-amber-400 font-bold">{member.visitsCount} wizyt</span>
                              </div>
                            </div>
                          </div>

                          {/* Opcje zarządzania członkiem */}
                          {canManage && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleToggleOfficer(member.id, member.teamRole)}
                                className={`p-2 rounded-xl transition ${
                                  isOfficer ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-500 hover:text-white'
                                }`}
                                title={isOfficer ? 'Zdegraduj z oficera' : 'Awansuj na oficera'}
                              >
                                <Shield size={16} />
                              </button>
                              <button
                                onClick={() => handleKick(member.id)}
                                className="p-2 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
                                title="Wyrzuć z ekipy"
                              >
                                <UserMinus size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleLeaveTeam}
                    className="w-full mt-6 py-3.5 bg-slate-950 text-slate-400 border border-slate-800 rounded-2xl text-xs font-bold hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition"
                  >
                    {teamDetails.ownerId === user.id ? 'Rozwiąż lub opuść ekipę' : 'Opuść ekipę'}
                  </button>
                </div>
              </>
            ) : (
              /* KIEDY UŻYTKOWNIK NIE MA EKIPY */
              <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-6 space-y-6">
                <div className="text-center py-4">
                  <span className="text-4xl mb-2 inline-block">🍻</span>
                  <h3 className="text-2xl font-black text-white">Dołącz do Ekipy lub Stwórz Własną</h3>
                  <p className="text-slate-400 text-xs mt-1">Razem zdobywacie bary i pniecie się w rankingu miasta.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Masz kod od znajomych?</h4>
                  <div className="flex gap-2">
                    <input
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value)}
                      placeholder="Wpisz 6-znakowy kod..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white font-mono uppercase tracking-widest text-center text-sm outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={async () => {
                        if (!joinCode.trim()) return;
                        try {
                          const t = await joinTeam(user.id, joinCode);
                          const updated = { ...user, teamId: t.id, teamRole: 'MEMBER' };
                          setUser(updated);
                          localStorage.setItem('barpulse_user', JSON.stringify(updated));
                          setTeamDetails(await getTeamDetails(t.id));
                        } catch (e: any) {
                          alert(e.message);
                        }
                      }}
                      className="px-6 bg-amber-500 text-slate-950 rounded-2xl font-black text-xs hover:bg-amber-400 transition"
                    >
                      DOŁĄCZ
                    </button>
                  </div>
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-600 text-xs font-bold">LUB</span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>

                <div>
                  <button
                    onClick={() => {
                      setNewTeamName(`Ekipa ${user.nickname}`);
                      setCreateTeamModal(true);
                    }}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 rounded-2xl font-black text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.01] transition"
                  >
                    + Załóż nową ekipę
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WIDOK: RANKINGI */}
        {view === 'rankings' && (
          <div className="h-full overflow-y-auto p-4 sm:p-8 max-w-2xl mx-auto pb-24">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-amber-500 flex items-center gap-2">
                <Trophy /> RANKING: {city}
              </h2>
            </div>

            <div className="space-y-3">
              {leaderboard.map((team, index) => {
                const colorConfig = AVAILABLE_COLORS.find(c => c.id === team.color) || AVAILABLE_COLORS[0];
                return (
                  <div
                    key={team.id}
                    className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition ${
                      index === 0
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.15)]'
                        : index === 1
                        ? 'bg-slate-900/80 border-slate-400/30'
                        : index === 2
                        ? 'bg-slate-900/80 border-orange-700/30'
                        : 'bg-slate-900/60 border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`text-2xl font-black w-8 text-center ${
                          index === 0
                            ? 'text-amber-400'
                            : index === 1
                            ? 'text-slate-300'
                            : index === 2
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        #{index + 1}
                      </div>

                      <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                        {team.badge || '⚡'}
                      </div>

                      <div>
                        <h3 className="font-black text-base text-white flex items-center gap-2">
                          {team.name}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            Lvl {team.level}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 italic">&ldquo;{team.motto}&rdquo;</p>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          Członków: {team.memberCount}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-black text-amber-400">{team.score}</div>
                      <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Odwiedzonych</div>
                    </div>
                  </div>
                );
              })}

              {leaderboard.length === 0 && (
                <div className="text-center py-16 bg-slate-900/30 rounded-3xl border border-white/5 p-8">
                  <span className="text-4xl mb-2 inline-block">🏆</span>
                  <h4 className="text-lg font-bold text-white mb-1">Brak zarejestrowanych ekip w {city}</h4>
                  <p className="text-xs text-slate-500 mb-4">Bądźcie pierwsi i zdominujcie nocny radar!</p>
                  <button
                    onClick={() => setView('team')}
                    className="px-6 py-2.5 bg-amber-500 text-slate-950 font-black text-xs rounded-xl"
                  >
                    STWÓRZ EKIPĘ
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL EDYCJI PROFILU */}
      {editProfileModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[2000] animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Edit2 className="text-amber-500" size={20} /> Edytuj Profil
            </h3>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1.5">Wybierz swój awatar:</label>
              <div className="grid grid-cols-6 gap-2">
                {AVAILABLE_AVATARS.map(av => (
                  <button
                    key={av}
                    onClick={() => setProfileAvatar(av)}
                    className={`h-11 rounded-xl text-2xl flex items-center justify-center transition ${
                      profileAvatar === av ? 'bg-amber-500/20 border-2 border-amber-400 scale-105' : 'bg-slate-950 border border-slate-800'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Tytuł / Ranga:</label>
              <select
                value={profileTitle}
                onChange={e => setProfileTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-amber-500"
              >
                <option value="Nowicjusz Barowy">Nowicjusz Barowy</option>
                <option value="Agent Nocny">Agent Nocny</option>
                <option value="Koneser Chmielu">Koneser Chmielu</option>
                <option value="Weteran Szlaku">Weteran Szlaku</option>
                <option value="Legenda Melanżu">Legenda Melanżu</option>
                <option value="Kapitan Ekipy">Kapitan Ekipy</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">O mnie / Status:</label>
              <input
                type="text"
                value={profileBio}
                onChange={e => setProfileBio(e.target.value)}
                maxLength={60}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Ulubiony trunek:</label>
              <input
                type="text"
                value={profileDrink}
                onChange={e => setProfileDrink(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditProfileModal(false)}
                className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="flex-1 py-3 bg-amber-500 text-slate-950 font-black rounded-xl text-xs hover:bg-amber-400 transition"
              >
                Zapisz zmiany
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TWORZENIA EKIPY */}
      {createTeamModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[2000] animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Plus className="text-amber-500" size={20} /> Stwórz Nową Ekipę
            </h3>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Nazwa ekipy:</label>
              <input
                type="text"
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                placeholder="np. Nocne Wilki"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1.5">Herb / Emblemat:</label>
              <div className="grid grid-cols-6 gap-2">
                {AVAILABLE_BADGES.map(badge => (
                  <button
                    key={badge}
                    onClick={() => setNewTeamBadge(badge)}
                    className={`h-11 rounded-xl text-2xl flex items-center justify-center transition ${
                      newTeamBadge === badge ? 'bg-amber-500/20 border-2 border-amber-400 scale-105' : 'bg-slate-950 border border-slate-800'
                    }`}
                  >
                    {badge}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1.5">Kolor przewodni:</label>
              <div className="flex gap-2">
                {AVAILABLE_COLORS.map(color => (
                  <button
                    key={color.id}
                    onClick={() => setNewTeamColor(color.id)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition ${
                      newTeamColor === color.id ? `${color.border} ${color.bg} ${color.text} scale-105` : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    {color.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Motto ekipy:</label>
              <input
                type="text"
                value={newTeamMotto}
                onChange={e => setNewTeamMotto(e.target.value)}
                placeholder="np. Nigdy nie wracamy przed świtem!"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setCreateTeamModal(false)}
                className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs"
              >
                Anuluj
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={loading || !newTeamName.trim()}
                className="flex-1 py-3 bg-amber-500 text-slate-950 font-black rounded-xl text-xs hover:bg-amber-400 transition"
              >
                Utwórz ekipę
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDYCJI EKIPY */}
      {editTeamModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[2000] animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Settings className="text-amber-500" size={20} /> Ustawienia Ekipy
            </h3>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Nazwa ekipy:</label>
              <input
                type="text"
                value={editTeamName}
                onChange={e => setEditTeamName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1.5">Herb ekipy:</label>
              <div className="grid grid-cols-6 gap-2">
                {AVAILABLE_BADGES.map(badge => (
                  <button
                    key={badge}
                    onClick={() => setEditTeamBadge(badge)}
                    className={`h-11 rounded-xl text-2xl flex items-center justify-center transition ${
                      editTeamBadge === badge ? 'bg-amber-500/20 border-2 border-amber-400 scale-105' : 'bg-slate-950 border border-slate-800'
                    }`}
                  >
                    {badge}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1.5">Kolor przewodni:</label>
              <div className="flex gap-2">
                {AVAILABLE_COLORS.map(color => (
                  <button
                    key={color.id}
                    onClick={() => setEditTeamColor(color.id)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition ${
                      editTeamColor === color.id ? `${color.border} ${color.bg} ${color.text} scale-105` : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    {color.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Motto ekipy:</label>
              <input
                type="text"
                value={editTeamMotto}
                onChange={e => setEditTeamMotto(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditTeamModal(false)}
                className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveTeamDetails}
                disabled={loading}
                className="flex-1 py-3 bg-amber-500 text-slate-950 font-black rounded-xl text-xs hover:bg-amber-400 transition"
              >
                Zapisz zmiany
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOLNY PASEK NAWIGACJI (DOCK) */}
      <nav className="absolute bottom-0 w-full bg-slate-950/90 backdrop-blur-xl border-t border-white/10 p-3 flex justify-around items-center z-[1000]">
        <button
          onClick={() => setView('map')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            view === 'map' ? 'text-amber-500 font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <MapIcon size={22} />
          <span className="text-[10px] tracking-wider uppercase">RADAR</span>
        </button>

        <button
          onClick={() => setView('rankings')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            view === 'rankings' ? 'text-amber-500 font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Trophy size={22} />
          <span className="text-[10px] tracking-wider uppercase">RANKING</span>
        </button>

        <button
          onClick={() => setView('team')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            view === 'team' ? 'text-amber-500 font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Users size={22} />
          <span className="text-[10px] tracking-wider uppercase">EKIPA</span>
        </button>

        <button
          onClick={() => setView('profile')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            view === 'profile' ? 'text-amber-500 font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <span className="text-xl leading-none">{user?.avatar || '🍺'}</span>
          <span className="text-[10px] tracking-wider uppercase">PROFIL</span>
        </button>
      </nav>
    </div>
  );
}
