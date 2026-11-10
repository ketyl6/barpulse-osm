'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Users, Map as MapIcon, LogOut, Key, Trophy, Edit2, UserMinus } from 'lucide-react';
import { registerUser, loginUser, createTeam, joinTeam, fetchBarsOSM, toggleVisit, getTeamVisits, getTeamDetails, leaveTeam, updateTeamName, kickMember, getLeaderboard } from './actions';

const InteractiveMap = dynamic(() => import('./components/Map'), { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center text-amber-500 font-bold bg-slate-950">Ładowanie mapy...</div> });

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'login' | 'register' | 'map' | 'profile' | 'rankings'>('login');

  const [nick, setNick] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [city, setCity] = useState('Rzeszów');
  const [bars, setBars] = useState<any[]>([]);
  const [mapCenter, setMapCenter] = useState<any>(null);
  const [teamVisits, setTeamVisits] = useState<string[]>([]);
  const [userLoc, setUserLoc] = useState<{lat: number, lon: number} | null>(null);

  const [teamDetails, setTeamDetails] = useState<any>(null);
  const [joinCode, setJoinCode] = useState('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('barpulse_user');
    if (saved) {
      setUser(JSON.parse(saved));
      setView('map');
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }));
    }
  }, []);

  const handleAuth = async (isLogin: boolean) => {
    setLoading(true); setError('');
    try {
      const res = isLogin ? await loginUser(nick, pass) : await registerUser(nick, pass);
      setUser(res);
      localStorage.setItem('barpulse_user', JSON.stringify(res));
      setView(res.teamId ? 'map' : 'profile');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('barpulse_user');
    setUser(null); setView('login');
  };

  useEffect(() => {
    if (view === 'map' && user?.teamId) {
      setLoading(true);
      fetchBarsOSM(city).then(data => { setMapCenter(data.center); setBars(data.bars); }).finally(() => setLoading(false));
      getTeamVisits(user.teamId).then(setTeamVisits);
    }
  }, [view, city, user]);

  useEffect(() => {
    if (view === 'profile' && user?.teamId) {
      getTeamDetails(user.teamId).then(setTeamDetails);
    } else if (view === 'rankings') {
      getLeaderboard(city).then(setLeaderboard);
    }
  }, [view, user, city]);

  const handleToggleVisit = async (bar: any) => {
    if (!user) return;
    const isNowVisited = await toggleVisit(user.id, bar.osmId, bar.name);
    setTeamVisits(prev => isNowVisited ? [...prev, bar.osmId] : prev.filter(id => id !== bar.osmId));
  };

  const handleLeaveTeam = async () => {
    await leaveTeam(user.id);
    const updatedUser = { ...user, teamId: null };
    setUser(updatedUser); localStorage.setItem('barpulse_user', JSON.stringify(updatedUser));
    setTeamDetails(null);
  };

  const handleKick = async (memberId: string) => {
    await kickMember(user.teamId, user.id, memberId);
    getTeamDetails(user.teamId).then(setTeamDetails); // refresh
  };

  const handleRenameTeam = async () => {
    const newName = prompt("Podaj nową nazwę ekipy:", teamDetails.name);
    if (newName && newName.trim() !== "") {
      await updateTeamName(user.teamId, user.id, newName);
      getTeamDetails(user.teamId).then(setTeamDetails);
    }
  };

  // --- EKRAN LOGOWANIA ---
  if (view === 'login' || view === 'register') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-[2rem] shadow-2xl">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black bg-gradient-to-br from-amber-400 to-orange-600 bg-clip-text text-transparent mb-2">BARPULSE</h1>
          </div>
          <div className="space-y-4">
            <input type="text" placeholder="Twój Nick" value={nick} onChange={e => setNick(e.target.value)} className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-white outline-none focus:border-amber-500 transition" />
            <input type="password" placeholder="Hasło" value={pass} onChange={e => setPass(e.target.value)} className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-white outline-none focus:border-amber-500 transition" />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button onClick={() => handleAuth(view === 'login')} disabled={loading} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black py-4 rounded-2xl shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition">
              {view === 'login' ? 'WEJDŹ' : 'DOŁĄCZ'}
            </button>
            <p className="text-center text-slate-500 text-sm mt-4 cursor-pointer hover:text-white transition" onClick={() => setView(view === 'login' ? 'register' : 'login')}>
              {view === 'login' ? 'Nie masz konta? Utwórz je.' : 'Masz konto? Zaloguj się.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- APLIKACJA ---
  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* HEADER */}
      <header className="absolute top-0 w-full bg-slate-950/80 backdrop-blur-md border-b border-white/5 p-4 flex justify-between items-center z-[1000]">
        <h1 className="font-black text-amber-500 text-xl tracking-widest">BARPULSE</h1>
        <select value={city} onChange={e => setCity(e.target.value)} className="bg-slate-900 border border-slate-700 text-amber-500 px-4 py-2 rounded-xl text-sm font-bold outline-none cursor-pointer">
          <option value="Rzeszów">Rzeszów</option>
          <option value="Kraków">Kraków</option>
          <option value="Warszawa">Warszawa</option>
          <option value="Wrocław">Wrocław</option>
        </select>
      </header>

      {/* GŁÓWNY OBSZAR */}
      <main className="flex-1 relative pt-[72px]">
        {view === 'map' && (
          <div className="absolute inset-0">
            {loading && <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur text-amber-500 font-bold text-lg">Skanowanie radarów...</div>}
            <InteractiveMap bars={bars} center={mapCenter} teamVisits={teamVisits} onToggleVisit={handleToggleVisit} userLoc={userLoc} />
          </div>
        )}

        {view === 'profile' && (
          <div className="h-full overflow-y-auto p-4 sm:p-8 max-w-2xl mx-auto pb-24">
            {/* Karta Użytkownika */}
            <div className="bg-slate-900/60 border border-white/5 rounded-[2rem] p-6 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-2xl font-black text-slate-950 shadow-lg shadow-amber-500/20">
                  {user.nickname.substring(0,2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{user.nickname}</h2>
                  <p className="text-slate-400 text-sm">Agent Terenowy</p>
                </div>
              </div>
              <button onClick={logout} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition"><LogOut size={20}/></button>
            </div>

            {user.teamId && teamDetails ? (
              <div className="bg-slate-900/60 border border-white/5 rounded-[2rem] p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Twoja Ekipa</h3>
                    <div className="flex items-center gap-3">
                      <h2 className="text-3xl font-black text-white">{teamDetails.name}</h2>
                      {teamDetails.ownerId === user.id && (
                        <button onClick={handleRenameTeam} className="text-slate-500 hover:text-amber-500 transition"><Edit2 size={18}/></button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-8 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Key className="text-amber-500" />
                    <span className="text-slate-400 text-sm font-medium">Kod zaproszenia:</span>
                  </div>
                  <span className="font-mono font-bold text-amber-500 text-lg tracking-widest bg-amber-500/10 px-3 py-1 rounded-lg">{teamDetails.code}</span>
                </div>

                <h4 className="font-bold text-sm text-slate-500 mb-4 tracking-wider">SKŁAD EKIPY ({teamDetails.members.length}):</h4>
                <div className="space-y-3 mb-8">
                  {teamDetails.members.map((m: any) => {
                    const isOwner = m.id === teamDetails.ownerId;
                    const isMe = m.id === user.id;
                    return (
                      <div key={m.id} className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isOwner ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                            {m.nickname.substring(0,2).toUpperCase()}
                          </div>
                          <span className="font-bold">{m.nickname} {isMe && <span className="text-amber-500 ml-1 text-xs">(Ty)</span>}</span>
                        </div>
                        {teamDetails.ownerId === user.id && !isMe && (
                          <button onClick={() => handleKick(m.id)} className="text-red-500/50 hover:text-red-500 transition p-2"><UserMinus size={18}/></button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button onClick={handleLeaveTeam} className="w-full py-4 bg-slate-950 text-slate-400 border border-slate-800 rounded-2xl font-bold hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition">
                  {teamDetails.ownerId === user.id ? 'Rozwiąż / Opuść Ekipę' : 'Opuść Ekipę'}
                </button>
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-white/5 rounded-[2rem] p-6 space-y-8">
                <div>
                  <h3 className="font-bold text-lg mb-3">Dołącz do ekipy</h3>
                  <div className="flex gap-3">
                    <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Wpisz kod..." className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white font-mono uppercase text-center outline-none focus:border-amber-500" />
                    <button onClick={async () => {
                      try {
                        const t = await joinTeam(user.id, joinCode);
                        setUser({...user, teamId: t.id}); localStorage.setItem('barpulse_user', JSON.stringify({...user, teamId: t.id}));
                      } catch (e: any) { alert(e.message); }
                    }} className="px-8 bg-amber-500 text-slate-950 rounded-2xl font-black">DOŁĄCZ</button>
                  </div>
                </div>
                <div className="relative flex py-2 items-center"><div className="flex-grow border-t border-slate-800"></div><span className="flex-shrink-0 mx-4 text-slate-600 text-sm font-bold">ALBO</span><div className="flex-grow border-t border-slate-800"></div></div>
                <div>
                  <h3 className="font-bold text-lg mb-3">Załóż nową</h3>
                  <button onClick={async () => {
                    const t = await createTeam(user.id, `Ekipa ${user.nickname}`, city);
                    setUser({...user, teamId: t.id}); localStorage.setItem('barpulse_user', JSON.stringify({...user, teamId: t.id}));
                  }} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition">Utwórz własną ekipę</button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'rankings' && (
          <div className="h-full overflow-y-auto p-4 sm:p-8 max-w-2xl mx-auto pb-24">
            <h2 className="text-2xl font-black text-amber-500 mb-6 flex items-center gap-3"><Trophy /> RANKING: {city}</h2>
            <div className="space-y-4">
              {leaderboard.map((team, index) => (
                <div key={team.id} className={`flex items-center justify-between p-5 rounded-2xl border ${index === 0 ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.1)]' : 'bg-slate-900/60 border-white/5'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`text-2xl font-black ${index === 0 ? 'text-amber-500' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-orange-700' : 'text-slate-700'}`}>#{index + 1}</div>
                    <div>
                      <h3 className={`font-bold text-lg ${index === 0 ? 'text-amber-400' : 'text-white'}`}>{team.name}</h3>
                      <p className="text-xs text-slate-500 font-medium">Członków: {team.memberCount}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-white">{team.score}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest">Odwiedzonych</div>
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && <p className="text-slate-500 text-center py-10">Brak ekip w tym mieście. Bądź pierwszy!</p>}
            </div>
          </div>
        )}
      </main>

      {/* NAWIGACJA BOTTOM */}
      <nav className="absolute bottom-0 w-full bg-slate-950/90 backdrop-blur-xl border-t border-white/10 p-4 flex justify-around items-center z-[1000] pb-safe">
        <button onClick={() => { if(user.teamId) setView('map'); else alert('Najpierw dołącz do ekipy!'); }} className={`flex flex-col items-center gap-1.5 transition-colors ${view === 'map' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>
          <MapIcon size={24} />
          <span className="text-[10px] font-bold tracking-widest">RADAR</span>
        </button>
        <button onClick={() => setView('rankings')} className={`flex flex-col items-center gap-1.5 transition-colors ${view === 'rankings' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>
          <Trophy size={24} />
          <span className="text-[10px] font-bold tracking-widest">RANKING</span>
        </button>
        <button onClick={() => setView('profile')} className={`flex flex-col items-center gap-1.5 transition-colors ${view === 'profile' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>
          <Users size={24} />
          <span className="text-[10px] font-bold tracking-widest">EKIPA</span>
        </button>
      </nav>
    </div>
  );
}
